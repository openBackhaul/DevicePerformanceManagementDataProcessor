const { Kafka } = require("@confluentinc/kafka-javascript").KafkaJS;
const { withRetry } = require("../../utils/retry");

let producer = null;
let producerConfigKey = null;

function asNumber(value, defaultValue) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : defaultValue;
}

function buildProducerConfig(options) {
  const brokers =
    options && Array.isArray(options.brokers) && options.brokers.length > 0
      ? options.brokers
      : String(global.KAFKA_BROKERS || "127.0.0.1:9092")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);

  const config = {
    "bootstrap.servers": brokers.join(","),
    "client.id":
      (options && options.clientId) ||
      global.KAFKA_CLIENT_ID ||
      "dpmdp-producer",

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

async function initProducer(options) {
  const logger = (options && options.logger) || console;
  const config = buildProducerConfig(options || {});
  const key = getConfigKey(config);

  if (producer && producerConfigKey === key) {
    return producer;
  }

  if (producer) {
    await producer.disconnect().catch(() => {});
    producer = null;
  }

  const kafka = new Kafka();

  producer = kafka.producer(config);

  await withRetry(
    async () => {
      await producer.connect();
    },
    {
      label: "confluentKafkaProducer.connect",
      retryIntervalMs: 10000,
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
}

async function sendBatch(topic, messages, logger) {
  if (!topic) {
    throw new Error("Kafka topic is mandatory");
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return { topic, sent: 0 };
  }

  const kafkaProducer = await initProducer({ logger });

  await withRetry(
    async () => {
      await kafkaProducer.send({
        topic,
        messages
      });
    },
    {
      label: `confluentKafkaProducer.sendBatch:${topic}`,
      retryIntervalMs: 10000,
      logger
    }
  );

  return {
    topic,
    sent: messages.length
  };
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
  disconnectProducer
};