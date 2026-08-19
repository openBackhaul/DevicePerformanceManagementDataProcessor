global.mockProducer = {
  connect: jest.fn().mockResolvedValue(undefined),
  send: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  flush: jest.fn().mockResolvedValue(undefined)
};

global.mockKafkaInstance = {
  producer: jest.fn((config) => {
    global.mockKafkaInstance.config = config;
    return global.mockProducer;
  })
};

jest.mock("@confluentinc/kafka-javascript", () => {
  global.mockKafka = jest.fn(() => {
    return global.mockKafkaInstance;
  });

  return {
    KafkaJS: {
      Kafka: global.mockKafka
    }
  };
});

const { initProducer, resetProducer, sendBatch } = require("./confluentKafkaProducer");

describe("confluentKafkaProducer TLS config", () => {
  beforeEach(async () => {
    await resetProducer({ warn: jest.fn() }, "TEST_RESET");
    global.mockKafka.mockClear();
    global.mockKafkaInstance.producer.mockClear();
    global.mockProducer.connect.mockClear();
    global.mockProducer.send.mockClear();
    global.mockProducer.disconnect.mockClear();
    global.mockProducer.flush.mockClear();
    global.mockKafkaInstance.config = undefined;
    delete global.KAFKA_BOOTSTRAP_SERVERS;
    delete global.KAFKA_CLIENT_ID;
    delete global.KAFKA_SECURITY_PROTOCOL;
    delete global.KAFKA_SSL_CA_LOCATION;
    delete global.KAFKA_SSL_CERTIFICATE_LOCATION;
    delete global.KAFKA_SSL_KEY_LOCATION;
    delete global.KAFKA_DEBUG;
  });

  it("passes PEM file location fields through to Kafka producer config", async () => {
    const logger = { info: jest.fn(), error: jest.fn() };

    await initProducer({
      clientId: "test-client",
      brokers: ["broker1:9092"],
      logger,
      auth: {
        "ssl.ca.location": "/tmp/ca.pem",
        "ssl.certificate.location": "/tmp/client.crt",
        "ssl.key.location": "/tmp/client.key",
        "ssl.key.password": "secret",
        enableSslCertificateVerification: false
      }
    });

    expect(global.mockKafka).toHaveBeenCalledTimes(1);
    expect(global.mockKafkaInstance.config).toMatchObject({
      "ssl.ca.location": "/tmp/ca.pem",
      "ssl.certificate.location": "/tmp/client.crt",
      "ssl.key.location": "/tmp/client.key",
      "ssl.key.password": "secret"
    });
    expect(global.mockKafkaInstance.config).not.toHaveProperty("ssl");
    expect(global.mockKafkaInstance.config).not.toHaveProperty("enable.ssl.certificate.verification");
  });

  it("uses runtime globals when options do not provide broker or TLS settings", async () => {
    const logger = { info: jest.fn(), error: jest.fn() };
    global.KAFKA_BOOTSTRAP_SERVERS = "localhost:9092";
    global.KAFKA_CLIENT_ID = "dpmdp-local";
    global.KAFKA_SECURITY_PROTOCOL = "ssl";
    global.KAFKA_SSL_CA_LOCATION = "C:/cmd/acls/secrets/prod/trust.pem";
    global.KAFKA_SSL_CERTIFICATE_LOCATION = "C:/cmd/acls/secrets/prod/cert.pem";
    global.KAFKA_SSL_KEY_LOCATION = "C:/cmd/acls/secrets/prod/key.pem";
    global.KAFKA_DEBUG = "broker,admin";

    await initProducer({ logger });

    expect(global.mockKafka).toHaveBeenCalledTimes(1);
    expect(global.mockKafkaInstance.config).toMatchObject({
      "bootstrap.servers": "localhost:9092",
      "client.id": "dpmdp-local",
      "security.protocol": "ssl",
      "ssl.ca.location": "C:/cmd/acls/secrets/prod/trust.pem",
      "ssl.certificate.location": "C:/cmd/acls/secrets/prod/cert.pem",
      "ssl.key.location": "C:/cmd/acls/secrets/prod/key.pem"
    });
    expect(global.mockKafkaInstance.config).not.toHaveProperty("debug");
  });

  it("marks Kafka message-size failures as non-retryable", async () => {
    const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const sendError = new Error("Broker: Message size too large");

    global.mockProducer.send.mockRejectedValueOnce(sendError);

    await expect(
      sendBatch(
        "raw.mw-sdnc-dpmdp.apt",
        [{ key: "device-1", value: "{\"payload\":\"large\"}" }],
        logger,
        {
          clientId: "test-client",
          brokers: ["broker1:9092"]
        }
      )
    ).rejects.toMatchObject({
      reason: "KAFKA_MESSAGE_SIZE_TOO_LARGE",
      retryable: false,
      stage: "confluentKafkaProducer.sendBatch"
    });
  });
});
