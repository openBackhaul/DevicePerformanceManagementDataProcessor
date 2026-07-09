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

  it("logs and skips messages with payload size greater than 1MB", async () => {
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

    expect(redisQueue.enqueueKafkaOutbound).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "kafka-outbound-message-size-exceeded",
        mountName: "device-oversized",
        targetConsumer: "APT",
        payloadBytes: expect.any(Number),
        maxBytes: 1024 * 1024
      }),
      "Kafka outbound message skipped because payload exceeds 1MB"
    );
    expect(result.queuedResultList).toEqual([
      expect.objectContaining({
        targetConsumer: "APT",
        mountName: "device-oversized",
        status: "SKIPPED",
        reason: "KAFKA_MESSAGE_SIZE_EXCEEDED_1MB",
        payloadBytes: expect.any(Number)
      })
    ]);
  });
});
