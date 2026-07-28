const redisQueue = require("../../infra/redis/redisStreamQueue");
const { sleep } = require("../../utils/retry");
const logger = require('../../service/LoggingService.js').getLogger();
const { acquireLock, releaseLock } = require("../../infra/redis/redisLock");

function shouldEnqueueRetry(error) {
  return !error || error.retryable !== false;
}

function buildNonRetryableRetryResult(mountName, error) {
  return {
    status: "SKIPPED",
    reason: "NON_RETRYABLE_ERROR",
    mountName,
    stage: error.stage || "p1ProcessDevice",
    lastError: error.message || String(error)
  };
}

async function handleMessage(message, context) {
  const { id, message: fields } = message;
  const mountName = fields.mountName;
  const lockKey = `dpmdp:lock:process:${mountName}`;
  const lockTtlMs = Number(context.deviceProcessingLockTtlMs || 30 * 60 * 1000);

  const lockToken = await acquireLock(lockKey, lockTtlMs, context.logger);
   if (!lockToken) {
    logger.warn(
      { mountName },
      "Skipped processing because another worker is already processing this mountName"
    );

    return;
  }
  try{
    try {
        const processDevice = context.processDevice || require("../../specificFunctions/p1StreamPmData/p1ProcessDevice/P1ProcessDevice");
        await processDevice.run({
          mountName,
          parameters: context.processDeviceParameters,
          configFile: context.configFile,
          mwdiReplicaEsClient: context.mwdiReplicaEsClient,
          dataStoreEsClient: context.dataStoreEsClient,
          kafkaConsumerTypes: context.kafkaConsumerTypes
        });

        await redisQueue.clearRetryState(mountName, context.logger);
        
        await redisQueue.ackMessage(id, context.logger);
        await redisQueue.removeFromDedupSet(mountName, context.logger);
        await redisQueue.deleteMessage(id, context.logger);
    } catch (error) {
        let retryResult;

        if (shouldEnqueueRetry(error)) {
          retryResult = await redisQueue.enqueueRetry(
          mountName,
          error.stage || "p1ProcessDevice",
          error.message || String(error),
          context.maxRetryCount || 1,
          context.logger
          );
        } else {
          retryResult = buildNonRetryableRetryResult(mountName, error);

          logger.warn(
            {
              mountName,
              stage: error.stage || "unknown",
              retryable: error.retryable,
              error: error.message || error
            },
            "Processing failed with non-retryable error; retry enqueue skipped"
          );
        }

        logger.error(
        {
            mountName,
            stage: error.stage || "unknown",
            retryable: error.retryable,
            error: error.message || error,
            retryResult
        },
        "Processing failed; retry decision completed"
        );

        await redisQueue.ackMessage(id, context.logger);
        await redisQueue.removeFromDedupSet(mountName, context.logger);
        await redisQueue.deleteMessage(id, context.logger);
    }
   } finally {
        await releaseLock(lockKey, lockToken, context.logger).catch(() => {});
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

module.exports = {
  startProcessingWorkerPoolRedis,
  /* _internal: {
    handleMessage,
    shouldEnqueueRetry
  } */
};
