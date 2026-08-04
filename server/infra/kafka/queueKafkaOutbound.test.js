jest.mock("../redis/redisStreamQueue", () => ({
  ensureKafkaOutboundGroup: jest.fn().mockResolvedValue(undefined),
  enqueueKafkaOutbound: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("../../service/LoggingService.js", () => ({
  getLogger: jest.fn(() => ({
    error: jest.fn()
  }))
}));

jest.mock("../elasticSearch/kafkaPayloadStore", () => ({
  storeKafkaPayload: jest.fn().mockResolvedValue("payload-ref-1"),
  deleteKafkaPayload: jest.fn().mockResolvedValue(undefined)
}));

const redisQueue = require("../redis/redisStreamQueue");
const queueKafkaOutbound = require("./queueKafkaOutbound");
const kafkaPayloadStore = require("../elasticSearch/kafkaPayloadStore");

describe("queueKafkaOutbound", () => {
  beforeEach(() => {
    delete process.env.MAX_REDIS_KAFKA_PAYLOAD_BYTES;
    redisQueue.ensureKafkaOutboundGroup.mockClear();
    redisQueue.enqueueKafkaOutbound.mockClear();
    kafkaPayloadStore.storeKafkaPayload.mockClear();
    kafkaPayloadStore.deleteKafkaPayload.mockClear();
  });

  it("queues messages with payload size less than or equal to 1MB", async () => {
    const logger = { error: jest.fn() };

    const result = await queueKafkaOutbound.run({
      logger,
      output: {
        targetConsumer: "APT",
        mountName: "device-1",
        payload: {
          value: "ok"
        }
      }
    });

    expect(redisQueue.enqueueKafkaOutbound).toHaveBeenCalledTimes(1);
    expect(result.queuedResultList).toEqual([
      expect.objectContaining({
        targetConsumer: "APT",
        mountName: "device-1",
        payloadStorage: "REDIS",
        status: "QUEUED"
      })
    ]);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("offloads a serialized 1MB payload to Elasticsearch", async () => {
    const oneMbStringPayload = "x".repeat((1024 * 1024) - 2);

    const queueMessage = await queueKafkaOutbound.buildRedisQueueMessage({
      targetConsumer: "APT",
      messageType: "PERFORMANCE_OUTPUT",
      mountName: "device-exact",
      correlationId: null,
      payloadVersion: "1.0",
      eventTime: "2026-07-08T00:00:00.000Z",
      payload: oneMbStringPayload
    }, { "index-alias": "datastore" }, {});

    expect(queueMessage).toMatchObject({
      targetConsumer: "APT",
      mountName: "device-exact",
      payloadStorage: "ES",
      payloadRefId: "payload-ref-1",
      payloadBytes: 1024 * 1024
    });
  });

  it("queues large messages by Elasticsearch reference instead of storing them in Redis", async () => {
    const logger = { error: jest.fn() };

    const result = await queueKafkaOutbound.run({
      logger,
      dataStoreEsClient: { "index-alias": "datastore" },
      output: {
        targetConsumer: "APT",
        mountName: "device-oversized",
        payload: {
          data: "x".repeat(1024 * 1024)
        }
      }
    });

    expect(redisQueue.enqueueKafkaOutbound).toHaveBeenCalledTimes(1);
    expect(redisQueue.enqueueKafkaOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        targetConsumer: "APT",
        mountName: "device-oversized",
        payloadStorage: "ES",
        payload: "",
        payloadRefId: "payload-ref-1",
        payloadBytes: expect.any(Number)
      }),
      logger
    );
    expect(logger.error).not.toHaveBeenCalled();
    expect(result.queuedResultList).toEqual([
      expect.objectContaining({
        targetConsumer: "APT",
        mountName: "device-oversized",
        payloadStorage: "ES",
        status: "QUEUED",
        payloadBytes: expect.any(Number)
      })
    ]);
  });
});
