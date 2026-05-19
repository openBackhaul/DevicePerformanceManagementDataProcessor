const redisQueue = require("../../infra/redis/redisStreamQueue");
const { sleep } = require("../../utils/retry");

function getRetryIntervalMs(context) {
  return Number(context.retryIntervalMs || 2 * 60 * 60 * 1000);
}

function getRetryReadCount(context) {
  return Number(context.retryReadCount || 500);
}

function getRetryMaxRequeuePerCycle(context) {
  return Number(context.retryMaxRequeuePerCycle || 20000);
}

async function requeueRetryMessage(message, context) {
  const { id, message: fields } = message;
  const mountName = fields.mountName;

  const result = await redisQueue.enqueueMountNames(
    [mountName],
    {
      batchSize: 1,
      pauseMs: 0,
      extraFields: {
        retryCount: fields.retryCount || "1",
        retryStage: fields.stage || "",
        retryLastError: fields.lastError || "",
        retriedAt: new Date().toISOString()
      }
    },
    context.logger
  );

  /*
   * If skipped, it means the mountName is already in device-processing queue.
   * In that case, retry stream entry can still be cleared.
   */
  if (result.enqueued > 0 || result.skipped > 0) {
    await redisQueue.ackRetryMessage(id, context.logger);
    await redisQueue.deleteRetryMessage(id, context.logger);
    await redisQueue.completeRetryRequeue(mountName, context.logger);

    context.logger.warn(
      {
        mountName,
        retryCount: fields.retryCount || "1",
        enqueued: result.enqueued,
        skipped: result.skipped
      },
      "Requeued mountName from retry stream"
    );

    return true;
  }

  context.logger.error(
    {
      mountName,
      retryCount: fields.retryCount || "1",
      result
    },
    "Retry worker could not requeue mountName"
  );

  return false;
}

async function processRetryBatch(messages, context, counter) {
  for (const message of messages) {
    if (context.appState.isShuttingDown) {
      break;
    }

    if (counter.requeued >= getRetryMaxRequeuePerCycle(context)) {
      break;
    }

    const success = await requeueRetryMessage(message, context);

    if (success) {
      counter.requeued += 1;
    }
  }
}

async function processRetryCycle(context, consumerName) {
  await redisQueue.ensureRetryGroup(context.logger);

  const counter = {
    requeued: 0
  };

  const retryQueueLength = await redisQueue.getRetryQueueLength(context.logger);

  context.logger.warn(
    {
      retryQueueLength,
      maxRequeuePerCycle: getRetryMaxRequeuePerCycle(context),
      readCount: getRetryReadCount(context)
    },
    "Retry cycle started"
  );

  while (
    !context.appState.isShuttingDown &&
    counter.requeued < getRetryMaxRequeuePerCycle(context)
  ) {
    const reclaimed = await redisQueue.reclaimStaleRetry(
      consumerName,
      context.staleMessageIdleMs || 60000,
      context.logger
    );

    if (reclaimed.length > 0) {
      await processRetryBatch(reclaimed, context, counter);
      continue;
    }

    const streams = await redisQueue.readNextRetry(
      consumerName,
      1000,
      getRetryReadCount(context),
      context.logger
    );

    let foundMessage = false;

    for (const stream of streams) {
      const messages = stream.messages || [];

      if (messages.length > 0) {
        foundMessage = true;
      }

      await processRetryBatch(messages, context, counter);
    }

    if (!foundMessage) {
      break;
    }
  }

  context.logger.warn(
    {
      requeued: counter.requeued
    },
    "Retry cycle completed"
  );
}

async function retryWorkerLoop(context, consumerName) {
  await redisQueue.ensureRetryGroup(context.logger);

  if (!context.retryRunImmediately) {
    await sleep(getRetryIntervalMs(context));
  }

  while (!context.appState.isShuttingDown) {
    try {
      await processRetryCycle(context, consumerName);
    } catch (error) {
      context.logger.error(
        {
          error: error.message || error
        },
        "Retry cycle failed"
      );
    }

    await sleep(getRetryIntervalMs(context));
  }
}

async function startRetryWorkerPool(context) {
  const workers = [];
  const workerCount = context.workerCount || 1;

  for (let i = 0; i < workerCount; i += 1) {
    const consumerName = `${context.instanceId}-retry-${i + 1}`;
    workers.push(retryWorkerLoop(context, consumerName));
  }

  await Promise.all(workers);
}

module.exports = {
  startRetryWorkerPool
};