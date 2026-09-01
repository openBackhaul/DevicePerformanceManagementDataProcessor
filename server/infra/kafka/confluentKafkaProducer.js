const { Kafka } = require("@confluentinc/kafka-javascript").KafkaJS;
const { withRetry } = require("../../utils/retry");
const logger = require('../../service/LoggingService.js').getLogger();

// A DPMDP instance can publish to several Kafka provider configurations at the
// same time. Keep one producer per configuration; replacing one global producer
// caused concurrent workers to disconnect a producer that was still connecting.
const producerEntries = new Map();

function asNumber(value, defaultValue) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : defaultValue;
}

function getStringValue(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  const normalized = String(value).trim();
  return normalized === "" ? undefined : normalized;
}

function getTlsConfig(options) {
  const params = (options && options.p1TransmittingKafkaParameters) || {};
  const auth = (options && options.auth) || params.auth || {};

  const caLocation =
    getStringValue(options && options.sslCaLocation) ||
    getStringValue(params && params.sslCaLocation) ||
    getStringValue(auth["ssl.ca.location"]) ||
    getStringValue(auth.sslCaLocation) ||
    getStringValue(global.KAFKA_SSL_CA_LOCATION) ||
    getStringValue(process.env.KAFKA_SSL_CA_LOCATION);
  const certLocation =
    getStringValue(options && options.sslCertificateLocation) ||
    getStringValue(params && params.sslCertificateLocation) ||
    getStringValue(auth["ssl.certificate.location"]) ||
    getStringValue(auth.sslCertificateLocation) ||
    getStringValue(global.KAFKA_SSL_CERTIFICATE_LOCATION) ||
    getStringValue(process.env.KAFKA_SSL_CERTIFICATE_LOCATION);
  const keyLocation =
    getStringValue(options && options.sslKeyLocation) ||
    getStringValue(params && params.sslKeyLocation) ||
    getStringValue(auth["ssl.key.location"]) ||
    getStringValue(auth.sslKeyLocation) ||
    getStringValue(global.KAFKA_SSL_KEY_LOCATION) ||
    getStringValue(process.env.KAFKA_SSL_KEY_LOCATION);
  const keyPassword =
    getStringValue(options && options.sslKeyPassword) ||
    getStringValue(params && params.sslKeyPassword) ||
    getStringValue(auth["ssl.key.password"]) ||
    getStringValue(auth.sslKeyPassword) ||
    getStringValue(global.KAFKA_SSL_KEY_PASSWORD) ||
    getStringValue(process.env.KAFKA_SSL_KEY_PASSWORD);

  const tlsConfig = {};

  if (caLocation) {
    tlsConfig["ssl.ca.location"] = caLocation;
  }
  if (certLocation) {
    tlsConfig["ssl.certificate.location"] = certLocation;
  }
  if (keyLocation) {
    tlsConfig["ssl.key.location"] = keyLocation;
  }
  if (keyPassword) {
    tlsConfig["ssl.key.password"] = keyPassword;
  }

  return tlsConfig;
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

  const runtimeBrokers = normalizeBrokerList(
    (options && options.kafkaBootstrapServers) ||
    global.KAFKA_BOOTSTRAP_SERVERS ||
    process.env.KAFKA_BOOTSTRAP_SERVERS
  );

  if (runtimeBrokers.length > 0) {
    return runtimeBrokers;
  }

  throw new Error(
    "Kafka broker configuration missing. Expected options.brokers, options.brokerList, p1TransmittingKafkaParameters with brokerList/brokers or ipv-4-address + remote-port, or KAFKA_BOOTSTRAP_SERVERS/runtime kafkaBootstrapServers."
  );
}

function getConfiguredClientId(options) {
  const params = (options && options.p1TransmittingKafkaParameters) || {};

  return (
    getStringValue(options && options.clientId) ||
    getStringValue(params.clientId) ||
    getStringValue(global.KAFKA_CLIENT_ID) ||
    getStringValue(process.env.KAFKA_CLIENT_ID) ||
    "dpmdp-producer"
  );
}

function buildProducerConfig(options) {
  const params = (options && options.p1TransmittingKafkaParameters) || {};
  const brokers = getConfiguredBrokers(options || {});
  const clientId = getConfiguredClientId(options || {});

  const securityProtocol =
    getStringValue(options && options.securityProtocol) ||
    getStringValue(params.securityProtocol) ||
    getStringValue(global.KAFKA_SECURITY_PROTOCOL) ||
    getStringValue(process.env.KAFKA_SECURITY_PROTOCOL);

  const auth = (options && options.auth) || params.auth || {};
  const debug =
    getStringValue(options && options.debug) ||
    getStringValue(params.debug) ||
    getStringValue(auth.debug) ||
    getStringValue(global.KAFKA_DEBUG) ||
    getStringValue(process.env.KAFKA_DEBUG);

  const config = {
    "bootstrap.servers": brokers.join(","),
    "client.id": clientId,

    // Reliability
    "acks": global.KAFKA_ACKS || "all",
    "enable.idempotence":
      String(global.KAFKA_ENABLE_IDEMPOTENCE || "true") === "true",

    // Message/request size
    "message.max.bytes": asNumber(global.KAFKA_PRODUCER_MESSAGE_MAX_BYTES, 5242880),
    // Bound native delivery waits so a failed broker/topic cannot block every
    // Redis outbound worker indefinitely. Failed entries remain pending and
    // are reclaimed after the configured stale-message interval.
    "delivery.timeout.ms": asNumber(global.KAFKA_DELIVERY_TIMEOUT_MS, 60000),
    "request.timeout.ms": asNumber(global.KAFKA_REQUEST_TIMEOUT_MS, 30000),
    "socket.timeout.ms": asNumber(global.KAFKA_SOCKET_TIMEOUT_MS, 30000),

    // Throughput optimization
    "linger.ms": asNumber(global.KAFKA_LINGER_MS, 50),
    "batch.size": asNumber(global.KAFKA_BATCH_SIZE, 1048576),
    "batch.num.messages": asNumber(global.KAFKA_BATCH_NUM_MESSAGES, 500),

    // Compression
    "compression.type": global.KAFKA_COMPRESSION_TYPE || "lz4"
  };

  if (securityProtocol) {
    config["security.protocol"] = securityProtocol;
  }

  if (debug) {
    //config.debug = debug;
  }

  const tlsConfig = getTlsConfig(options);
  return {
    ...config,
    ...tlsConfig
  };
}

function getConfigKey(config) {
  return JSON.stringify({
    bootstrapServers: config["bootstrap.servers"],
    clientId: config["client.id"],
    securityProtocol: config["security.protocol"],
    debug: config.debug,
    sslCaLocation: config["ssl.ca.location"],
    sslCertificateLocation: config["ssl.certificate.location"],
    sslKeyLocation: config["ssl.key.location"],
    sslKeyPassword: config["ssl.key.password"],
    messageMaxBytes: config["message.max.bytes"],
    deliveryTimeoutMs: config["delivery.timeout.ms"],
    requestTimeoutMs: config["request.timeout.ms"],
    socketTimeoutMs: config["socket.timeout.ms"]
  });
}

async function resetProducerEntry(key, logger, reason) {
  const entry = producerEntries.get(key);
  if (!entry) return;

  // Remove first so no new sender receives an entry that is being closed.
  producerEntries.delete(key);

  try {
    // If connection is still being established, let that lifecycle settle
    // before disconnecting. This prevents a late native ready callback from
    // arriving after disconnect has moved the producer to another state.
    await entry.connectPromise.catch(() => {});
    if (entry.connected) {
      await entry.producer.disconnect();
    }
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

}

async function resetProducer(logger, reason) {
  const keys = Array.from(producerEntries.keys());
  await Promise.all(keys.map((key) => resetProducerEntry(key, logger, reason)));
}

async function initProducer(options) {
  const logger = (options && options.logger) || console;
  const config = buildProducerConfig(options || {});
  const key = getConfigKey(config);

  const existing = producerEntries.get(key);
  if (existing) {
    await existing.connectPromise;
    return existing.producer;
  }

  const kafka = new Kafka();
  const kafkaProducer = kafka.producer(config);
  const entry = {
    producer: kafkaProducer,
    connectPromise: null,
    connected: false
  };

  entry.connectPromise = withRetry(
      async () => {
        await kafkaProducer.connect();
      },
      {
        label: "confluentKafkaProducer.connect",
        retryIntervalMs: Number(global.KAFKA_CONNECT_RETRY_INTERVAL_MS || 10000),
        logger
      }
    );
  producerEntries.set(key, entry);

  try {
    await entry.connectPromise;
    entry.connected = true;

    logger.info(
      {
        bootstrapServers: config["bootstrap.servers"],
        clientId: config["client.id"]
      },
      "Confluent Kafka producer connected"
    );

    return kafkaProducer;
  } catch (error) {
    if (producerEntries.get(key) === entry) {
      await resetProducerEntry(key, logger, "CONNECT_FAILED");
    }

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
    const failedConfig = buildProducerConfig(
      buildInitOptionsFromSendArgument(kafkaOptions, logger)
    );
    await resetProducerEntry(getConfigKey(failedConfig), logger, "SEND_FAILED");

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
  await Promise.all(Array.from(producerEntries.values()).map(async (entry) => {
    await entry.connectPromise.catch(() => {});
    if (typeof entry.producer.flush === "function") {
      await entry.producer.flush({ timeout: 10000 }).catch((error) => {
        logger && logger.error && logger.error({ error }, "Kafka producer flush failed");
      });
    }
  }));
}

async function disconnectProducer(logger) {
  await flushProducer(logger);
  await resetProducer(logger, "SHUTDOWN");
}

module.exports = {
  initProducer,
  sendBatch,
  flushProducer,
  disconnectProducer,
  resetProducer
};
