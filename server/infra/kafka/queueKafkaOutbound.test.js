jest.mock("../redis/redisStreamQueue", () => ({
  ensureKafkaOutboundGroup: jest.fn().mockResolvedValue(undefined),
  enqueueKafkaOutbound: jest.fn().mockResolvedValue(undefined),
  updateKafkaDailyMetrics: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("../elasticSearch/kafkaPayloadStore", () => ({
  storeKafkaPayload: jest.fn().mockResolvedValue("payload-ref-1"),
  deleteKafkaPayload: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("../../service/LoggingService.js", () => ({
  getLogger: jest.fn(() => ({
    error: jest.fn()
  }))
}));

const redisQueue = require("../redis/redisStreamQueue");
const kafkaPayloadStore = require("../elasticSearch/kafkaPayloadStore");
const queueKafkaOutbound = require("./queueKafkaOutbound");

describe("queueKafkaOutbound", () => {
  beforeEach(() => {
    delete process.env.KAFKA_MAX_SINGLE_MESSAGE_BYTES;
    delete global.KAFKA_MAX_SINGLE_MESSAGE_BYTES;
    redisQueue.ensureKafkaOutboundGroup.mockClear();
    redisQueue.enqueueKafkaOutbound.mockClear();
    redisQueue.updateKafkaDailyMetrics.mockClear();
    kafkaPayloadStore.storeKafkaPayload.mockClear();
    kafkaPayloadStore.deleteKafkaPayload.mockClear();
  });

  it("stores even small payloads in Elasticsearch and queues only a reference", async () => {
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
        payloadStorage: "ES",
        status: "QUEUED"
      })
    ]);
    expect(kafkaPayloadStore.storeKafkaPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        mountName: "device-1",
        deliveryState: "pending"
      })
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("builds a Redis queue message without pre-rejecting a large payload", async () => {
    const oneMbStringPayload = "x".repeat((1024 * 1024) - 2);

    const queueMessage = await queueKafkaOutbound.buildRedisQueueMessage({
      targetConsumer: "APT",
      messageType: "PERFORMANCE_OUTPUT",
      mountName: "device-exact",
      correlationId: null,
      payloadVersion: "1.0",
      eventTime: "2026-07-08T00:00:00.000Z",
      payload: oneMbStringPayload
    });

    expect(queueMessage).toMatchObject({
      targetConsumer: "APT",
      mountName: "device-exact",
      payloadStorage: "REDIS",
      payloadBytes: 1024 * 1024
    });
  });

  it("stores a payload over 1MB in Elasticsearch and queues only its reference", async () => {
    const logger = { error: jest.fn(), warn: jest.fn() };

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
    expect(kafkaPayloadStore.storeKafkaPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        targetConsumer: "APT",
        mountName: "device-oversized",
        deliveryState: "pending"
      })
    );
    expect(redisQueue.enqueueKafkaOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        payloadStorage: "ES",
        payload: "",
        payloadRefId: "payload-ref-1"
      }),
      logger
    );
    expect(redisQueue.ensureKafkaOutboundGroup).toHaveBeenCalledTimes(1);
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
    expect(redisQueue.updateKafkaDailyMetrics).not.toHaveBeenCalled();
  });
});
