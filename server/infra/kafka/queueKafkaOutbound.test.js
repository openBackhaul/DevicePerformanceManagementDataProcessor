jest.mock("../redis/redisStreamQueue", () => ({
  ensureKafkaOutboundGroup: jest.fn().mockResolvedValue(undefined),
  enqueueKafkaOutbound: jest.fn().mockResolvedValue(undefined),
  updateKafkaDailyMetrics: jest.fn().mockResolvedValue(undefined)
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
    delete process.env.KAFKA_MAX_SINGLE_MESSAGE_BYTES;
    delete global.KAFKA_MAX_SINGLE_MESSAGE_BYTES;
    redisQueue.ensureKafkaOutboundGroup.mockClear();
    redisQueue.enqueueKafkaOutbound.mockClear();
    redisQueue.updateKafkaDailyMetrics.mockClear();
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

  it("stores an oversized payload in Elasticsearch as evidence", async () => {
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
      payloadBytes: 1024 * 1024,
      status: "STORED_NOT_QUEUED",
      reason: "KAFKA_MESSAGE_SIZE_TOO_LARGE"
    });
    expect(kafkaPayloadStore.storeKafkaPayload).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryState: "oversized-evidence" })
    );
  });

  it("does not put Elasticsearch evidence references into the Redis queue", async () => {
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

    expect(redisQueue.enqueueKafkaOutbound).not.toHaveBeenCalled();
    expect(redisQueue.ensureKafkaOutboundGroup).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(result.queuedResultList).toEqual([
      expect.objectContaining({
        targetConsumer: "APT",
        mountName: "device-oversized",
        payloadStorage: "ES",
        status: "STORED_NOT_QUEUED",
        reason: "KAFKA_MESSAGE_SIZE_TOO_LARGE",
        payloadBytes: expect.any(Number)
      })
    ]);
    expect(logger.warn).toHaveBeenCalled();
    expect(redisQueue.updateKafkaDailyMetrics).toHaveBeenCalledWith(
      "oversized", "APT", 1, logger
    );
  });
});
