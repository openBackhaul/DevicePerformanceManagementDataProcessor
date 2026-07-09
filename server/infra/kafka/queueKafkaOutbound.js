const redisQueue = require("../redis/redisStreamQueue");
// const kafkaPayloadStore = require("../elasticSearch/kafkaPayloadStore");
const defaultLogger = require('../../service/LoggingService.js').getLogger();

const MAX_KAFKA_MESSAGE_BYTES = 1024 * 1024;

function getMaxKafkaMessageBytes() {
  const configured = Number(process.env.MAX_REDIS_KAFKA_PAYLOAD_BYTES);

  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, MAX_KAFKA_MESSAGE_BYTES)
    : MAX_KAFKA_MESSAGE_BYTES;
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
  const maxKafkaMessageBytes = getMaxKafkaMessageBytes();

  if (payloadBytes <= maxKafkaMessageBytes) {
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

  /*
   * Future fallback if payloads larger than 1MB are allowed again:
   *
   * const payloadRefId = await kafkaPayloadStore.storeKafkaPayload({
   *   dataStoreEsClient,
   *   targetConsumer: normalized.targetConsumer,
   *   mountName: normalized.mountName,
   *   payload: normalized.payload,
   *   payloadBytes,
   *   logger
   * });
   *
   * return {
   *   targetConsumer: normalized.targetConsumer,
   *   messageType: normalized.messageType,
   *   mountName: normalized.mountName,
   *   correlationId: normalized.correlationId,
   *   payloadVersion: normalized.payloadVersion,
   *   eventTime: normalized.eventTime,
   *   payloadStorage: "ES",
   *   payload: "",
   *   payloadRefId,
   *   payloadBytes
   * };
   */

  return {
    targetConsumer: normalized.targetConsumer,
    messageType: normalized.messageType,
    mountName: normalized.mountName,
    correlationId: normalized.correlationId,
    payloadVersion: normalized.payloadVersion,
    eventTime: normalized.eventTime,
    status: "SKIPPED",
    reason: "KAFKA_MESSAGE_SIZE_EXCEEDED_1MB",
    payloadBytes
  };
}

/**
 * Request:
 * {
 *   output or outputs,
 *   dataStoreEsClient,
 *   logger
 * }
 */
async function run(request) {
  const activeLogger = defaultLogger;
  const { dataStoreEsClient } = request;
  const outputs = normalizeOutputs(request);
  const queuedResultList = [];

  await redisQueue.ensureKafkaOutboundGroup(activeLogger);

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
      activeLogger
    );

    if (queueMessage.status === "SKIPPED") {
      activeLogger.error(
        {
          label: "kafka-outbound-message-size-exceeded",
          mountName: queueMessage.mountName,
          targetConsumer: queueMessage.targetConsumer,
          messageType: queueMessage.messageType,
          payloadBytes: queueMessage.payloadBytes,
          maxBytes: getMaxKafkaMessageBytes(),
          payloadMb: Number((queueMessage.payloadBytes / (1024 * 1024)).toFixed(3))
        },
        "Kafka outbound message skipped because payload exceeds 1MB"
      );

      queuedResultList.push(queueMessage);
      continue;
    }

    await redisQueue.enqueueKafkaOutbound(queueMessage, activeLogger);

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

module.exports = { run, buildRedisQueueMessage };
