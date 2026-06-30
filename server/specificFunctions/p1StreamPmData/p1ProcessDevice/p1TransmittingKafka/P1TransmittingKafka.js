const crypto = require("crypto");
const { sendBatch } = require("../../../../infra/kafka/confluentKafkaProducer");
const ERRORS = require("./ErrorsEnum");
const logger = require('../../../../service/LoggingService.js').getLogger();

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function buildProcessingError(message) {
  const error = new Error(message);

  error.stage = "p1TransmittingKafka";
  error.retryable = false;

  return error;
}

function buildWrappedProcessingError(error) {
  const wrappedError = buildProcessingError(ERRORS.GENERAL_PROCESSING_ERROR);

  if (error) {
    wrappedError.cause = error;
    wrappedError.originalMessage = error.message || String(error);
  }

  return wrappedError;
}


function isProducerConnectionError(error) {
  const description = [
    error && error.message,
    error && error.type,
    error && error.code,
    error && error.name
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    description.includes("connect") ||
    description.includes("connection") ||
    description.includes("bootstrap") ||
    description.includes("broker") ||
    description.includes("econnrefused") ||
    description.includes("socket")
  );
}

function normalizeTransmissionError(error) {
  if (!error) {
    return buildProcessingError(ERRORS.GENERAL_PROCESSING_ERROR);
  }

  if (ERRORS.knownErrors.has(error.message)) {
    return error;
  }

  if (isProducerConnectionError(error)) {
    const normalizedError = buildProcessingError(ERRORS.PRODUCER_CONNECTION_ERROR);
    normalizedError.cause = error;
    return normalizedError;
  }

  const normalizedError = buildProcessingError(ERRORS.OTHER_TRANSMISSION_ERROR);
  normalizedError.cause = error;
  return normalizedError;
}

function normalizeTargetConsumer(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeParameterName(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/PROVIDER$/, "")
    .replace(/CONSUMER$/, "")
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeTopicSuffix(value) {
  const topic = String(value || "").trim();
  const lastPart = topic.split(".").pop();

  return normalizeTargetConsumer(lastPart);
}

function findKafkaConnection(targetConsumer, kafkaConnectionList) {
  const normalizedTarget = normalizeTargetConsumer(targetConsumer);

  if (!normalizedTarget) {
    throw new Error("targetConsumer is mandatory for Kafka topic resolution");
  }

  const connections = Array.isArray(kafkaConnectionList)
    ? kafkaConnectionList
    : [];

  const providerConnections = connections.filter((connection) => {
    return String(connection.type || "").toLowerCase() === "provider";
  });

  /*
   * First preference:
   * Match targetConsumer with parameterName.
   *
   * Example:
   * targetConsumer = APT
   * parameterName  = aptProvider
   */
  let connection = providerConnections.find((item) => {
    return normalizeParameterName(item.parameterName) === normalizedTarget;
  });

  if (connection) {
    return connection;
  }

  /*
   * Second preference:
   * Match targetConsumer with topic suffix.
   *
   * Example:
   * targetConsumer = APT
   * topicName      = raw.mw-sdnc-dpmdp.apt
   */
  connection = providerConnections.find((item) => {
    return normalizeTopicSuffix(item.topicName) === normalizedTarget;
  });

  if (connection) {
    return connection;
  }

  /*
   * Third preference:
   * Match targetConsumer with kafkaClientUuid or topicName text.
   */
  connection = providerConnections.find((item) => {
    const searchText = [
      item.kafkaClientUuid,
      item.topicName,
      item.parameterName
    ]
      .filter(Boolean)
      .join(" ")
      .toUpperCase();

    return searchText.includes(normalizedTarget);
  });

  if (connection) {
    return connection;
  }

  throw new Error(
    `No Kafka provider connection configured for targetConsumer=${targetConsumer}`
  );
}

function getKafkaConnection(targetConsumer, kafkaConnectionList) {
  const connection = findKafkaConnection(
    targetConsumer,
    kafkaConnectionList
  );

  if (!connection.topicName) {
    throw new Error(
      `Kafka topicName missing for targetConsumer=${targetConsumer}`
    );
  }

  if (!connection.clientId) {
    throw new Error(
      `Kafka clientId missing for targetConsumer=${targetConsumer}`
    );
  }

  if (!Array.isArray(connection.brokerList) || connection.brokerList.length === 0) {
    throw new Error(
      `Kafka brokerList missing for targetConsumer=${targetConsumer}`
    );
  }

  return {
    topicName: connection.topicName,
    clientId: connection.clientId,
    brokers: connection.brokerList,
    kafkaClientUuid: connection.kafkaClientUuid,
    parameterName: connection.parameterName,
    type: connection.type
  };
}

/* function getKafkaSendOptions(targetConsumer, kafkaConnectionList) {
  const connection = findKafkaConnection(
    targetConsumer,
    kafkaConnectionList
  );

  return {
    clientId: connection.clientId,
    brokers: connection.brokerList,
    kafkaClientUuid: connection.kafkaClientUuid,
    parameterName: connection.parameterName
  };
} */

function buildEnvelope(item) {
  const now = new Date().toJSON();

  return {
    messageId: item.messageId || crypto.randomUUID(),
    producer: "DPMDP",
    targetConsumer: String(item.targetConsumer || "").toUpperCase(),
    messageType: item.messageType || "PERFORMANCE_OUTPUT",
    eventTime: item.eventTime || now,
    sourceSystem: "DPMDP",
    mountName: item.mountName || item.deviceId || item.devicId || null,
    correlationId: item.correlationId || null,
    payloadVersion: item.payloadVersion || item.version || "1.0",
    payload: item.payload === undefined ? {} : item.payload
  };
}

function validateEnvelope(envelope) {
  const mandatoryFields = [
    "messageId",
    "producer",
    "targetConsumer",
    "messageType",
    "eventTime",
    "sourceSystem",
    "payload"
  ];

  for (const field of mandatoryFields) {
    if (envelope[field] === undefined || envelope[field] === null) {
      throw new Error(`Mandatory Kafka envelope field missing: ${field}`);
    }
  }

  if (
    envelope.messageType !== "DATA_QUALITY_RESULT" &&
    (!envelope.mountName || String(envelope.mountName).trim() === "")
  ) {
    throw new Error("mountName is mandatory for device-specific Kafka messages");
  }
}

function normalizeInput(request) {
  if (Array.isArray(request.outputMessages)) {

    if (request.outputMessages.length === 0) {
      throw new Error("outputMessages must not be empty");
      //logger.error("outputMessages must not be empty");
    }

    return request.outputMessages;
  }

  if (request.outputMessage) {
    return [request.outputMessage];
  }

  throw new Error("outputMessages or outputMessage is mandatory");
}

function getKafkaMessageBytes(message) {
  const keyBytes = Buffer.byteLength(String(message.key || ""), "utf8");
  const valueBytes = Buffer.byteLength(String(message.value || ""), "utf8");

  return keyBytes + valueBytes;
}

function getMaxSingleKafkaMessageBytes() {
  return Number(global.KAFKA_MAX_SINGLE_MESSAGE_BYTES || 4500000);
}

function validateKafkaMessageSize(message, context) {
  const messageBytes = getKafkaMessageBytes(message);
  const maxBytes = getMaxSingleKafkaMessageBytes();

  if (messageBytes <= maxBytes) {
    return;
  }

  const error = new Error(
    `Kafka message too large. messageBytes=${messageBytes}, maxBytes=${maxBytes}`
  );

  error.stage = "p1TransmittingKafka";
  error.reason = "KAFKA_MESSAGE_SIZE_TOO_LARGE";
  error.retryable = false;
  error.messageBytes = messageBytes;
  error.maxBytes = maxBytes;
  error.topic = context.topic;
  error.targetConsumer = context.targetConsumer;
  error.mountName = context.mountName;

  throw error;
}

async function run(request) {
  let isTransmitting = false;

  try {

    if(!request || typeof request !== "object") {
      throw buildProcessingError(ERRORS.GENERAL_PROCESSING_ERROR);
    }

    const { logger, kafkaConnectionList } = request;

     if(kafkaConnectionList=== undefined) {
        throw buildProcessingError(ERRORS.KAFKA_CONNECTION_LIST_NOT_PROVIDED);
    }

    if(!Array.isArray(kafkaConnectionList)) {
        throw buildProcessingError(ERRORS.KAFKA_CONNECTION_LIST_INVALID);
    }

    if(kafkaConnectionList.length === 0) {
        throw buildProcessingError(ERRORS.KAFKA_CONNECTION_LIST_NOT_PROVIDED);
    }

    

    const outputMessages = normalizeInput(request);
    const topicMessageMap = new Map();

    for (const item of outputMessages) {
      const envelope = buildEnvelope(item);
      validateEnvelope(envelope);

      const kafkaConnection = getKafkaConnection(
        envelope.targetConsumer,
        kafkaConnectionList
      );

      const kafkaMessage = {
        key: envelope.mountName || envelope.messageId,
        value: JSON.stringify(envelope)
      };

      validateKafkaMessageSize(kafkaMessage, {
        topic: kafkaConnection.topicName,
        targetConsumer: envelope.targetConsumer,
        mountName: envelope.mountName
      });

      /*
       * Group by topic + clientId + brokerList.
       * Do not group only by topic, because different Kafka clients may point
       * to different broker/client configurations.
       */
      const mapKey = JSON.stringify({
        topicName: kafkaConnection.topicName,
        clientId: kafkaConnection.clientId,
        brokers: kafkaConnection.brokers
      });

      if (!topicMessageMap.has(mapKey)) {
        topicMessageMap.set(mapKey, {
          topicName: kafkaConnection.topicName,
          kafkaOptions: {
            clientId: kafkaConnection.clientId,
            brokers: kafkaConnection.brokers,
            kafkaClientUuid: kafkaConnection.kafkaClientUuid,
            parameterName: kafkaConnection.parameterName
          },
          messages: []
        });
      }

      topicMessageMap.get(mapKey).messages.push(kafkaMessage);
    }

    const transmissionResultList = [];

    for (const item of topicMessageMap.values()) {
      logger &&
        logger.info &&
        logger.info(
          {
            topic: item.topicName,
            messageCount: item.messages.length,
            maxMessageBytes: Math.max(
              ...item.messages.map((message) => getKafkaMessageBytes(message))
            ),
            totalBatchBytes: item.messages.reduce(
              (sum, message) => sum + getKafkaMessageBytes(message),
              0
            )
          },
          "Kafka message size summary before send"
        );
      isTransmitting = true;

      await sendBatch(
        item.topicName,
        item.messages,
        logger,
        item.kafkaOptions
      );

      isTransmitting = false;

      transmissionResultList.push({
        topic: item.topicName,
        clientId: item.kafkaOptions.clientId,
        brokers: item.kafkaOptions.brokers,
        messageCount: item.messages.length,
        status: "SENT"
      });
    }

    return { transmissionResultList };
  } catch (error) {
    if (error && ERRORS.knownErrors.has(error.message)) {
      throw error;
    }

    if (error && error.reason === "KAFKA_MESSAGE_SIZE_TOO_LARGE") {
      throw error;
    }

    if (
      error &&
      error.stage === "p1TransmittingKafka" &&
      typeof error.retryable === "boolean"
    ) {
      throw error;
    }

    if (!isTransmitting) {
      // logger && logger.error && logger.error({ err: error }, "Unexpected pre-transmission error");
      throw buildWrappedProcessingError(error);
    }

    throw normalizeTransmissionError(error);
  }
}

module.exports = { run };

