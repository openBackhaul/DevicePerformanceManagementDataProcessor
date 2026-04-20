const redisQueue = require("../../infra/redis/redisStreamQueue");
const p1TransmittingKafka = require("../../specificFunctions/p1StreamPmData/p1ProcessDevice/p1TransmittingKafka/P1TransmittingKafka");
const { sleep } = require("../../utils/retry");

async function handleKafkaOutboundMessage(message, context) {
  const { id, message: fields } = message;

  try {
    await p1TransmittingKafka.run({
      parameters: context.transmitKafkaParameters,
      configFile: context.configFile,
      outputFormat: {
        formatName: fields.formatName,
        outputFormat: JSON.parse(fields.message)
      },
      logger: context.logger
    });

    await redisQueue.ackKafkaOutbound(id, context.logger);
    await redisQueue.deleteKafkaOutboundMessage(id, context.logger);
  } catch (error) {
    context.logger.error(
      {
        messageId: id,
        error: error.message || error
      },
      "Kafka outbound send failed"
    );

    await sleep(5000);
  }
}

async function kafkaOutboundWorkerLoop(context, consumerName) {
  await redisQueue.ensureKafkaOutboundGroup(context.logger);

  while (!context.appState.isShuttingDown) {
    const reclaimed = await redisQueue.reclaimStaleKafkaOutbound(
      consumerName,
      context.staleMessageIdleMs || 60000,
      context.logger
    );

    for (const message of reclaimed) {
      if (context.appState.isShuttingDown) break;
      await handleKafkaOutboundMessage(message, context);
    }

    const streams = await redisQueue.readNextKafkaOutbound(
      consumerName,
      5000,
      10,
      context.logger
    );

    for (const stream of streams) {
      for (const message of stream.messages || []) {
        if (context.appState.isShuttingDown) break;
        await handleKafkaOutboundMessage(message, context);
      }
    }

    if (!streams.length && !reclaimed.length) {
      await sleep(1000);
    }
  }
}

async function startKafkaOutboundWorkerPool(context) {
  const workers = [];
  const workerCount = context.workerCount || 2;

  for (let i = 0; i < workerCount; i += 1) {
    const consumerName = `${context.instanceId}-kafka-outbound-${i + 1}`;
    workers.push(kafkaOutboundWorkerLoop(context, consumerName));
  }

  await Promise.all(workers);
}

module.exports = {
  startKafkaOutboundWorkerPool
};