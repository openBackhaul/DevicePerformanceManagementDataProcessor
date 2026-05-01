const redisQueue = require("../../infra/redis/redisStreamQueue");
const p1TransmittingKafka = require("../../specificFunctions/p1StreamPmData/p1TransmittingKafka/P1TransmittingKafka");
const { sleep } = require("../../utils/retry");

function parseRedisPayload(rawPayload) {
  if (!rawPayload) {
    return {};
  }

  try {
    return JSON.parse(rawPayload);
  } catch (error) {
    return {};
  }
}

function parseRedisMessage(redisMessage) {
  const fields = redisMessage.message || {};

  return {
    redisMessageId: redisMessage.id,
    targetConsumer: fields.targetConsumer,
    messageType: fields.messageType,
    mountName: fields.mountName || null,
    correlationId: fields.correlationId || null,
    payloadVersion: fields.payloadVersion || "1.0",
    eventTime: fields.eventTime,
    payload: parseRedisPayload(fields.payload)
  };
}

async function processKafkaOutboundBatch(messages, context) {
  if (!messages || messages.length === 0) {
    return;
  }

  const outputMessages = messages.map(parseRedisMessage);

  await p1TransmittingKafka.run({
    outputMessages,
    logger: context.logger
  });

  for (const msg of messages) {
    await redisQueue.ackKafkaOutbound(msg.id, context.logger);
    await redisQueue.deleteKafkaOutboundMessage(msg.id, context.logger);
  }

  context.logger.info(
    { messageCount: messages.length },
    "Kafka outbound batch sent successfully"
  );
}

async function kafkaOutboundWorkerLoop(context, consumerName) {
  await redisQueue.ensureKafkaOutboundGroup(context.logger);

  while (!context.appState.isShuttingDown) {
    const reclaimed = await redisQueue.reclaimStaleKafkaOutbound(
      consumerName,
      context.staleMessageIdleMs || 60000,
      context.logger
    );

    if (reclaimed.length > 0) {
      await processKafkaOutboundBatch(reclaimed, context);
      continue;
    }

    const streams = await redisQueue.readNextKafkaOutbound(
      consumerName,
      5000,
      context.batchSize || 500,
      context.logger
    );

    let batch = [];

    for (const stream of streams) {
      batch = batch.concat(stream.messages || []);
    }

    if (batch.length > 0) {
      await processKafkaOutboundBatch(batch, context);
    } else {
      await sleep(1000);
    }
  }
}

async function startKafkaOutboundWorkerPool(context) {
  const workers = [];
  const workerCount = context.workerCount || 1;

  for (let i = 0; i < workerCount; i += 1) {
    const consumerName = `${context.instanceId}-kafka-outbound-${i + 1}`;
    workers.push(kafkaOutboundWorkerLoop(context, consumerName));
  }

  await Promise.all(workers);
}

module.exports = {
  startKafkaOutboundWorkerPool
};