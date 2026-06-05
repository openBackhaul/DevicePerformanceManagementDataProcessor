const { Kafka } = require("@confluentinc/kafka-javascript").KafkaJS;
const { withRetry } = require("../../utils/retry");

let producer = null;
let producerConfigKey = null;

function asNumber(value, defaultValue) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : defaultValue;
}

function getConfiguredBrokers(options) {
  const params = (options && options.p1TransmittingKafkaParameters) || {};

  const host =
    params["ipv-4-address"] ||
    "127.0.0.1";

  const port =
    params["remote-port"] ||
    "29092";

  return [`${host}:${port}`];
}

function buildProducerConfig(options) {
  const brokers = getConfiguredBrokers(options || {});
  const params = (options && options.p1TransmittingKafkaParameters) || {};

  const config = {
    "bootstrap.servers": brokers.join(","),
    "client.id": params["client-id"] || "dpmdp-producer",

    // Reliability
    "acks": global.KAFKA_ACKS || "all",
    "enable.idempotence":
      String(global.KAFKA_ENABLE_IDEMPOTENCE || "true") === "true",

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

async function sendBatch(topic, messages, logger, p1TransmittingKafkaParameters) {
  if (!topic) {
    throw new Error("Kafka topic is mandatory");
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return { topic, sent: 0 };
  }

  try {
    const kafkaProducer = await initProducer({
      logger,
      p1TransmittingKafkaParameters
    });

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

    logger &&
      logger.error &&
      logger.error(
        {
          label: "confluentKafkaProducer.sendBatch.failed",
          topic,
          messageCount: messages.length,
          error: error.message || error,
          code: error.code,
          type: error.type
        },
        "Kafka send failed; producer reset for reconnect"
      );

    throw error;
  }
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