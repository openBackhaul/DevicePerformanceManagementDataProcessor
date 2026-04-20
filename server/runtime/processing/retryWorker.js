const redisQueue = require("../../infra/redis/redisStreamQueue");
const { sleep } = require("../../utils/retry");

async function handleRetryMessage(message, context) {
  const { id, message: fields } = message;
  const mountName = fields.mountName;
  const retryDelayMs = context.retryDelayMs || 10000;

  try {
    await sleep(retryDelayMs);

    await redisQueue.enqueueMountNames(
      [mountName],
      {
        batchSize: 1,
        pauseMs: 0
      },
      context.logger
    );

    await redisQueue.ackRetryMessage(id, context.logger);
    await redisQueue.deleteRetryMessage(id, context.logger);

    context.logger.warn(
      { mountName, retryDelayMs },
      "Requeued mountName from retry stream"
    );
  } catch (error) {
    context.logger.error(
      {
        mountName,
        error: error.message || error
      },
      "Retry worker failed to requeue mountName"
    );
  }
}

async function retryWorkerLoop(context, consumerName) {
  await redisQueue.ensureRetryGroup(context.logger);

  while (!context.appState.isShuttingDown) {
    const reclaimed = await redisQueue.reclaimStaleRetry(
      consumerName,
      context.staleMessageIdleMs || 60000,
      context.logger
    );

    for (const message of reclaimed) {
      if (context.appState.isShuttingDown) {
        break;
      }
      await handleRetryMessage(message, context);
    }

    const streams = await redisQueue.readNextRetry(
      consumerName,
      5000,
      10,
      context.logger
    );

    for (const stream of streams) {
      for (const message of stream.messages || []) {
        if (context.appState.isShuttingDown) {
          break;
        }
        await handleRetryMessage(message, context);
      }
    }

    if (!streams.length && !reclaimed.length) {
      await sleep(1000);
    }
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