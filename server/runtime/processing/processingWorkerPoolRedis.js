const redisQueue = require("../../infra/redis/redisStreamQueue");
const p1ProcessDevice = require("../../specificFunctions/p1StreamPmData/p1ProcessDevice/P1ProcessDevice");
const { sleep } = require("../../utils/retry");

function getErrorMessage(error) {
  return error && error.message ? error.message : String(error);
}

function getRetryCountFromMessage(fields) {
  const retryCount = Number(fields.retryCount || 0);
  return Number.isFinite(retryCount) ? retryCount : 0;
}

function isRetryableError(error) {
  return !(error && error.retryable === false);
}

async function moveToRetryOrDeadLetter(message, error, context) {
  const { message: fields } = message;
  const mountName = fields.mountName;

  const currentRetryCount = getRetryCountFromMessage(fields);
  const nextRetryCount = currentRetryCount + 1;
  const maxRetryCount = Number(context.maxRetryCount || 1);

  const retryable = isRetryableError(error);
  const stage = error.stage || "p1ProcessDevice";
  const lastError = getErrorMessage(error);

  if (retryable && nextRetryCount <= maxRetryCount) {
    await redisQueue.enqueueRetry(
      mountName,
      stage,
      lastError,
      nextRetryCount,
      context.logger
    );

    context.logger.warn(
      {
        mountName,
        stage,
        retryCount: nextRetryCount,
        maxRetryCount
      },
      "Processing failed; item moved to retry stream"
    );

    return;
  }

  await redisQueue.enqueueRetryDeadLetter(
    mountName,
    stage,
    lastError,
    currentRetryCount,
    retryable ? "MAX_RETRY_EXCEEDED" : "NON_RETRYABLE_ERROR",
    context.logger
  );

  context.logger.error(
    {
      mountName,
      stage,
      retryCount: currentRetryCount,
      maxRetryCount,
      retryable,
      error: lastError
    },
    "Processing failed; item moved to retry dead-letter stream"
  );
}

async function handleMessage(message, context) {
  const { id, message: fields } = message;
  const mountName = fields.mountName;

  try {
    await p1ProcessDevice.run({
      mountName,
      parameters: context.processDeviceParameters,
      configFile: context.configFile,
      mwdiReplicaEsClient: context.mwdiReplicaEsClient,
      dataStoreEsClient: context.dataStoreEsClient,
      logger: context.logger
    });

    await redisQueue.ackMessage(id, context.logger);
    await redisQueue.removeFromDedupSet(mountName, context.logger);
    await redisQueue.deleteMessage(id, context.logger);
  } catch (error) {
    await moveToRetryOrDeadLetter(message, error, context);

    await redisQueue.ackMessage(id, context.logger);
    await redisQueue.removeFromDedupSet(mountName, context.logger);
    await redisQueue.deleteMessage(id, context.logger);
  }
}

async function workerLoop(context, consumerName) {
  await redisQueue.ensureGroup(context.logger);

  while (!context.appState.isShuttingDown) {
    const reclaimed = await redisQueue.reclaimStale(
      consumerName,
      context.staleMessageIdleMs || 60000,
      context.logger
    );

    for (const message of reclaimed) {
      if (context.appState.isShuttingDown) break;
      await handleMessage(message, context);
    }

    const streams = await redisQueue.readNext(
      consumerName,
      5000,
      10,
      context.logger
    );

    for (const stream of streams) {
      for (const message of stream.messages || []) {
        if (context.appState.isShuttingDown) break;
        await handleMessage(message, context);
      }
    }

    if (!streams.length && !reclaimed.length) {
      await sleep(context.workerIdleSleepMs || 1000);
    }
  }
}

async function startProcessingWorkerPoolRedis(context) {
  const workers = [];
  const workerCount = context.workerCount || 2;

  for (let i = 0; i < workerCount; i += 1) {
    const consumerName = `${context.instanceId}-consumer-${i + 1}`;
    workers.push(workerLoop(context, consumerName));
  }

  await Promise.all(workers);
}

module.exports = { startProcessingWorkerPoolRedis };