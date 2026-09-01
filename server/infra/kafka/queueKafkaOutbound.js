const redisQueue = require("../redis/redisStreamQueue");
const kafkaPayloadStore = require("../elasticSearch/kafkaPayloadStore");
const defaultLogger = require('../../service/LoggingService.js').getLogger();

const DEFAULT_MAX_KAFKA_MESSAGE_BYTES = 900000;

function getMaxKafkaMessageBytes() {
  const configured = Number(
    global.KAFKA_MAX_SINGLE_MESSAGE_BYTES ||
    process.env.KAFKA_MAX_SINGLE_MESSAGE_BYTES
  );

  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_KAFKA_MESSAGE_BYTES;
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
  // Include the Kafka envelope and key in the decision. A payload below the
  // broker limit can still exceed it once envelope metadata is serialized.
  const estimatedEnvelope = {
    messageId: "00000000-0000-4000-8000-000000000000",
    producer: "DPMDP",
    targetConsumer: normalized.targetConsumer,
    messageType: normalized.messageType,
    eventTime: normalized.eventTime,
    sourceSystem: "DPMDP",
    mountName: normalized.mountName,
    correlationId: normalized.correlationId,
    payloadVersion: normalized.payloadVersion,
    payload: normalized.payload
  };
  const estimatedMessageBytes =
    Buffer.byteLength(String(normalized.mountName || ""), "utf8") +
    Buffer.byteLength(JSON.stringify(estimatedEnvelope), "utf8");

  if (estimatedMessageBytes > getMaxKafkaMessageBytes()) {
    const payloadRefId = await kafkaPayloadStore.storeKafkaPayload({
      dataStoreEsClient,
      targetConsumer: normalized.targetConsumer,
      mountName: normalized.mountName,
      payload: normalized.payload,
      payloadBytes,
      deliveryState: "oversized-evidence",
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
      payloadBytes,
      estimatedMessageBytes,
      status: "STORED_NOT_QUEUED",
      reason: "KAFKA_MESSAGE_SIZE_TOO_LARGE"
    };
  }

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
  const { dataStoreEsClient } = request;
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

    const queueMessage = await buildRedisQueueMessage(
      normalized,
      dataStoreEsClient,
      activeLogger
    );

    if (queueMessage.status === "STORED_NOT_QUEUED") {
      await redisQueue.updateKafkaDailyMetrics(
        "oversized",
        queueMessage.targetConsumer,
        1,
        activeLogger
      ).catch((error) => {
        activeLogger.error?.(
          { error: error.message || error },
          "Failed to increment oversized Kafka daily metric"
        );
      });
      activeLogger.warn?.(
        {
          label: "kafka-outbound-oversized-evidence-stored",
          mountName: queueMessage.mountName,
          targetConsumer: queueMessage.targetConsumer,
          payloadRefId: queueMessage.payloadRefId,
          payloadBytes: queueMessage.payloadBytes,
          estimatedMessageBytes: queueMessage.estimatedMessageBytes,
          maxBytes: getMaxKafkaMessageBytes()
        },
        "Oversized Kafka output stored in Elasticsearch as evidence and not queued"
      );
      queuedResultList.push(queueMessage);
      continue;
    }

    if (!kafkaGroupEnsured) {
      await redisQueue.ensureKafkaOutboundGroup(activeLogger);
      kafkaGroupEnsured = true;
    }

    try {
      await redisQueue.enqueueKafkaOutbound(queueMessage, activeLogger);
    } catch (error) {
      if (queueMessage.payloadStorage === "ES" && queueMessage.payloadRefId) {
        await kafkaPayloadStore.deleteKafkaPayload({
          dataStoreEsClient,
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

module.exports = { run, buildRedisQueueMessage };
