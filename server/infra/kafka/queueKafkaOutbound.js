const redisQueue = require("../redis/redisStreamQueue");
const kafkaPayloadStore = require("../elasticSearch/kafkaPayloadStore");
const defaultLogger = require('../../service/LoggingService.js').getLogger();

const MAX_REDIS_KAFKA_PAYLOAD_BYTES = 1024 * 1024;

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

async function buildRedisQueueMessage(normalized) {
  const serializedPayload = JSON.stringify(normalized.payload);
  const payloadBytes = Buffer.byteLength(serializedPayload, "utf8");

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

/**
 * Request:
 * {
 *   output or outputs,
 *   dataStoreEsClient,
 *   logger
 * }
 */
async function run(request) {
  const activeLogger = request.logger || defaultLogger;
  const outputs = normalizeOutputs(request);
  const queuedResultList = [];
  let kafkaGroupEnsured = false;

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

    const queueMessage = await buildRedisQueueMessage(normalized);

    // Keep small payloads directly in Redis. Store larger payloads in
    // Elasticsearch and put only their reference in the Redis stream, so a
    // Kafka slowdown cannot fill Redis with multi-megabyte JSON documents.
    if (queueMessage.payloadBytes > MAX_REDIS_KAFKA_PAYLOAD_BYTES) {
      queueMessage.payloadRefId = await kafkaPayloadStore.storeKafkaPayload({
        dataStoreEsClient: request.dataStoreEsClient,
        targetConsumer: queueMessage.targetConsumer,
        mountName: queueMessage.mountName,
        payload: normalized.payload,
        payloadBytes: queueMessage.payloadBytes,
        deliveryState: "pending",
        logger: activeLogger
      });
      queueMessage.payloadStorage = "ES";
      queueMessage.payload = "";
    }

    if (!kafkaGroupEnsured) {
      await redisQueue.ensureKafkaOutboundGroup(activeLogger);
      kafkaGroupEnsured = true;
    }

    try {
      await redisQueue.enqueueKafkaOutbound(queueMessage, activeLogger);
    } catch (error) {
      // Avoid leaving an unreachable pending document when creation of the
      // corresponding Redis reference fails.
      if (queueMessage.payloadStorage === "ES" && queueMessage.payloadRefId) {
        await kafkaPayloadStore.deleteKafkaPayload({
          dataStoreEsClient: request.dataStoreEsClient,
          payloadRefId: queueMessage.payloadRefId,
          logger: activeLogger
        });
      }
      throw error;
    }

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

module.exports = {
  run,
  buildRedisQueueMessage,
  MAX_REDIS_KAFKA_PAYLOAD_BYTES
};
