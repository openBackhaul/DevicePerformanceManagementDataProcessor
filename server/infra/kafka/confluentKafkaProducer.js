const { Kafka } = require("@confluentinc/kafka-javascript").KafkaJS;
const { withRetry } = require("../../utils/retry");
const logger = require('../../service/LoggingService.js').getLogger();

let producer = null;
let producerConfigKey = null;

function asNumber(value, defaultValue) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : defaultValue;
}

function normalizeBrokerList(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getConfiguredBrokers(options) {
  const params = (options && options.p1TransmittingKafkaParameters) || {};

  /*
   * Local/runtime override.
   * Useful only for local Docker testing, for example 127.0.0.1:29092.
   * In production, do not set global.KAFKA_BOOTSTRAP_SERVERS if the broker
   * must come strictly from the KafkaClient LTP in configFile.
   */
  /* const runtimeOverride =
    options.kafkaBootstrapServers ||
    global.KAFKA_BOOTSTRAP_SERVERS ||
    process.env.KAFKA_BOOTSTRAP_SERVERS;

  if (runtimeOverride) {
    const brokers = normalizeBrokerList(runtimeOverride);

    if (brokers.length > 0) {
      return brokers;
    }
  } */

  /*
   * This is the p1InitKafka/onfAdapter path:
   * initProducer({ clientId, brokers, logger })
   */
  const directBrokers =
    normalizeBrokerList(options && options.brokers);

  if (directBrokers.length > 0) {
    return directBrokers;
  }

  /*
   * Optional alternative naming.
   */
  const directBrokerList =
    normalizeBrokerList(options && options.brokerList);

  if (directBrokerList.length > 0) {
    return directBrokerList;
  }

  /*
   * This is the p1TransmittingKafka path, if already resolved Kafka
   * parameters are passed directly.
   */
  const paramBrokerList =
    normalizeBrokerList(
      params.brokers ||
      params.brokerList 
    );

  if (paramBrokerList.length > 0) {
    return paramBrokerList;
  }

  const host =
    params["ipv-4-address"] ||
    params["domain-name"] ||
    params.host;

  const port =
    params["remote-port"] ||
    params.port;

  if (host && port) {
    return [`${host}:${port}`];
  }

  throw new Error(
    "Kafka broker configuration missing. Expected options.brokers, options.brokerList, or p1TransmittingKafkaParameters with brokerList/brokers or ipv-4-address + remote-port."
  );
}

function getConfiguredClientId(options) {
  const params = (options && options.p1TransmittingKafkaParameters) || {};

  return (
    (options && options.clientId) ||
    params.clientId ||
    "dpmdp-producer"
  );
}

function buildProducerConfig(options) {
  const brokers = getConfiguredBrokers(options || {});
  const clientId = getConfiguredClientId(options || {});

  const config = {
    "bootstrap.servers": brokers.join(","),
    "client.id": clientId,

    // Reliability
    "acks": global.KAFKA_ACKS || "all",
    "enable.idempotence":
      String(global.KAFKA_ENABLE_IDEMPOTENCE || "true") === "true",

    // Message/request size
    "message.max.bytes": asNumber(global.KAFKA_PRODUCER_MESSAGE_MAX_BYTES, 5242880),
    //"socket.request.max.bytes": asNumber(global.KAFKA_SOCKET_REQUEST_MAX_BYTES, 10485760),

    // Throughput optimization
    "linger.ms": asNumber(global.KAFKA_LINGER_MS, 50),
    "batch.size": asNumber(global.KAFKA_BATCH_SIZE, 1048576),
    "batch.num.messages": asNumber(global.KAFKA_BATCH_NUM_MESSAGES, 500),

    // Compression
    "compression.type": global.KAFKA_COMPRESSION_TYPE || "lz4"
  };

  if (global.KAFKA_SECURITY_PROTOCOL) {
    config["security.protocol"] = global.KAFKA_SECURITY_PROTOCOL;
  }

  if (global.KAFKA_SASL_MECHANISMS) {
    config["sasl.mechanisms"] = global.KAFKA_SASL_MECHANISMS;
  }

  if (global.KAFKA_USERNAME) {
    config["sasl.username"] = global.KAFKA_USERNAME;
  }

  if (global.KAFKA_PASSWORD) {
    config["sasl.password"] = global.KAFKA_PASSWORD;
  }

  return config;
}

function getConfigKey(config) {
  return JSON.stringify({
    bootstrapServers: config["bootstrap.servers"],
    clientId: config["client.id"],
    securityProtocol: config["security.protocol"],
    saslMechanisms: config["sasl.mechanisms"]
  });
}

async function resetProducer(logger, reason) {
  if (!producer) {
    producerConfigKey = null;
    return;
  }

  try {
    await producer.disconnect();
  } catch (error) {
    logger &&
      logger.warn &&
      logger.warn(
        {
          reason,
          error: error.message || error
        },
        "Kafka producer disconnect during reset failed"
      );
  }

  producer = null;
  producerConfigKey = null;
}

async function initProducer(options) {
  const logger = (options && options.logger) || console;
  const config = buildProducerConfig(options || {});
  const key = getConfigKey(config);

  if (producer && producerConfigKey === key) {
    return producer;
  }

  if (producer) {
    await resetProducer(logger, "CONFIG_CHANGED");
  }

  const kafka = new Kafka();
  producer = kafka.producer(config);

  try {
    await withRetry(
      async () => {
        await producer.connect();
      },
      {
        label: "confluentKafkaProducer.connect",
        retryIntervalMs: Number(global.KAFKA_CONNECT_RETRY_INTERVAL_MS || 10000),
        logger
      }
    );

    producerConfigKey = key;

    logger.info(
      {
        bootstrapServers: config["bootstrap.servers"],
        clientId: config["client.id"]
      },
      "Confluent Kafka producer connected"
    );

    return producer;
  } catch (error) {
    await resetProducer(logger, "CONNECT_FAILED");

    logger.error(
      {
        label: "confluentKafkaProducer.connect.failed",
        bootstrapServers: config["bootstrap.servers"],
        clientId: config["client.id"],
        error: error.message || error,
        code: error.code,
        type: error.type
      },
      "Kafka producer connection failed; producer reset for reconnect"
    );

    throw error;
  }
}

function buildInitOptionsFromSendArgument(kafkaOptions, logger) {
  /*
   * Case 1:
   * sendBatch(topic, messages, logger, { clientId, brokers })
   */
  if (
    kafkaOptions &&
    typeof kafkaOptions === "object" &&
    (
      kafkaOptions.clientId ||
      kafkaOptions.brokers ||
      kafkaOptions.brokerList
    )
  ) {
    return {
      ...kafkaOptions,
      logger
    };
  }

  /*
   * Case 2:
   * sendBatch(topic, messages, logger, p1TransmittingKafkaParameters)
   */
  return {
    logger,
    p1TransmittingKafkaParameters: kafkaOptions || {}
  };
}

async function sendBatch(topic, messages, logger, kafkaOptions) {
  if (!topic) {
    throw new Error("Kafka topic is mandatory");
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return { topic, sent: 0 };
  }

  try {
    const kafkaProducer = await initProducer(
      buildInitOptionsFromSendArgument(kafkaOptions, logger)
    );

    await withRetry(
      async () => {
        await kafkaProducer.send({
          topic,
          messages
        });
      },
      {
        label: `confluentKafkaProducer.sendBatch:${topic}`,
        retryIntervalMs: Number(global.KAFKA_SEND_RETRY_INTERVAL_MS || 10000),
        logger
      }
    );

    return {
      topic,
      sent: messages.length
    };
  } catch (error) {
    await resetProducer(logger, "SEND_FAILED");

    if (isKafkaMessageTooLargeError(error)) {
      error.retryable = false;
      error.stage = "confluentKafkaProducer.sendBatch";
      error.reason = "KAFKA_MESSAGE_SIZE_TOO_LARGE";
    }

    logger &&
      logger.error &&
      logger.error(
        {
          label: "confluentKafkaProducer.sendBatch.failed",
          topic,
          messageCount: messages.length,
          error: error.message || error,
          code: error.code,
          type: error.type,
          retryable: error.retryable,
          reason: error.reason
        },
        "Kafka send failed; producer reset for reconnect"
      );

    throw error;
  }
}

function isKafkaMessageTooLargeError(error) {
  const text = [
    error && error.message,
    error && error.type,
    error && error.code,
    error && error.name
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("message size too large") ||
    text.includes("msg_size_too_large") ||
    text.includes("record too large") ||
    text.includes("too large")
  );
}

async function flushProducer(logger) {
  if (!producer) {
    return;
  }

  if (typeof producer.flush === "function") {
    await producer.flush({ timeout: 10000 }).catch((error) => {
      logger && logger.error && logger.error({ error }, "Kafka producer flush failed");
    });
  }
}

async function disconnectProducer(logger) {
  if (!producer) {
    return;
  }

  await flushProducer(logger);

  await producer.disconnect().catch((error) => {
    logger && logger.error && logger.error({ error }, "Kafka producer disconnect failed");
  });

  producer = null;
  producerConfigKey = null;
}

module.exports = {
  initProducer,
  sendBatch,
  flushProducer,
  disconnectProducer,
  resetProducer
};