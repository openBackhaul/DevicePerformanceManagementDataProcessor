const redisQueue = require("../redis/redisStreamQueue");
const kafkaPayloadStore = require("../elasticSearch/kafkaPayloadStore");

const DEFAULT_MAX_REDIS_PAYLOAD_BYTES = 512 * 1024;

function getMaxRedisPayloadBytes() {
  const configured = Number(process.env.MAX_REDIS_KAFKA_PAYLOAD_BYTES);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_REDIS_PAYLOAD_BYTES;
}

function normalizeOutputs(request) {
  const output = request.outputs || request.output;

  if (!output) {
    throw new Error("output or outputs is mandatory");
  }

  return Array.isArray(output) ? output : [output];
}

function normalizeOutputMessage(output) {
  const mountName =
    output.mountName ||
    output.deviceId ||
    output.devicId ||
    output["mount-name"] ||
    null;

  return {
    targetConsumer: String(output.targetConsumer || "").toUpperCase(),
    messageType: output.messageType || "PERFORMANCE_OUTPUT",
    mountName,
    correlationId: output.correlationId || null,
    payloadVersion: output.payloadVersion || output.version || "1.0",
    eventTime: output.eventTime || output.batchTimestamp || new Date().toJSON(),
    payload: output.payload === undefined ? {} : output.payload
  };
}

async function buildRedisQueueMessage(normalized, dataStoreEsClient, logger) {
  const serializedPayload = JSON.stringify(normalized.payload);
  const payloadBytes = Buffer.byteLength(serializedPayload, "utf8");
  const maxRedisPayloadBytes = getMaxRedisPayloadBytes();

  if (payloadBytes <= maxRedisPayloadBytes) {
    return {
      targetConsumer: normalized.targetConsumer,
      messageType: normalized.messageType,
      mountName: normalized.mountName,
      correlationId: normalized.correlationId,
      payloadVersion: normalized.payloadVersion,
      eventTime: normalized.eventTime,
      payloadStorage: "REDIS",
      payload: serializedPayload,
      payloadRefId: "",
      payloadBytes
    };
  }

  const payloadRefId = await kafkaPayloadStore.storeKafkaPayload({
    dataStoreEsClient,
    targetConsumer: normalized.targetConsumer,
    mountName: normalized.mountName,
    payload: normalized.payload,
    payloadBytes,
    logger
  });

  return {
    targetConsumer: normalized.targetConsumer,
    messageType: normalized.messageType,
    mountName: normalized.mountName,
    correlationId: normalized.correlationId,
    payloadVersion: normalized.payloadVersion,
    eventTime: normalized.eventTime,
    payloadStorage: "ES",
    payload: "",
    payloadRefId,
    payloadBytes
  };
}

/**
 * Request:
 * {
 *   output or outputs,
 *   dataStoreEsClient, // mandatory only when payload is larger than MAX_REDIS_KAFKA_PAYLOAD_BYTES
 *   logger
 * }
 */
async function run(request) {
  const { logger, dataStoreEsClient } = request;
  const outputs = normalizeOutputs(request);
  const queuedResultList = [];

  await redisQueue.ensureKafkaOutboundGroup(logger);

  for (const output of outputs) {
    const normalized = normalizeOutputMessage(output);

    if (!normalized.targetConsumer) {
      queuedResultList.push({
        status: "SKIPPED",
        reason: "targetConsumer is mandatory",
        mountName: normalized.mountName
      });
      continue;
    }

    const queueMessage = await buildRedisQueueMessage(
      normalized,
      dataStoreEsClient,
      logger
    );

    await redisQueue.enqueueKafkaOutbound(queueMessage, logger);

    queuedResultList.push({
      targetConsumer: queueMessage.targetConsumer,
      messageType: queueMessage.messageType,
      mountName: queueMessage.mountName,
      payloadStorage: queueMessage.payloadStorage,
      payloadBytes: queueMessage.payloadBytes,
      status: "QUEUED"
    });
  }

  return { queuedResultList };
}

module.exports = { run };