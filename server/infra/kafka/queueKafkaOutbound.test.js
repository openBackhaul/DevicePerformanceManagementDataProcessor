jest.mock("../redis/redisStreamQueue", () => ({
  ensureKafkaOutboundGroup: jest.fn().mockResolvedValue(undefined),
  enqueueKafkaOutbound: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("../../service/LoggingService.js", () => ({
  getLogger: jest.fn(() => ({
    error: jest.fn()
  }))
}));

const redisQueue = require("../redis/redisStreamQueue");
const queueKafkaOutbound = require("./queueKafkaOutbound");

describe("queueKafkaOutbound", () => {
  beforeEach(() => {
    delete process.env.MAX_REDIS_KAFKA_PAYLOAD_BYTES;
    redisQueue.ensureKafkaOutboundGroup.mockClear();
    redisQueue.enqueueKafkaOutbound.mockClear();
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

  it("allows a serialized payload that is exactly 1MB", async () => {
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

  it("queues messages with payload size greater than 1MB so EMP Kafka can reject them", async () => {
    const logger = { error: jest.fn() };

    const result = await queueKafkaOutbound.run({
      logger,
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
        payloadStorage: "REDIS",
        payload: expect.any(String),
        payloadBytes: expect.any(Number)
      }),
      logger
    );
    expect(logger.error).not.toHaveBeenCalled();
    expect(result.queuedResultList).toEqual([
      expect.objectContaining({
        targetConsumer: "APT",
        mountName: "device-oversized",
        payloadStorage: "REDIS",
        status: "QUEUED",
        payloadBytes: expect.any(Number)
      })
    ]);
  });
});
