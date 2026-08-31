const mockRedis = {
  eval: jest.fn(),
  xAdd: jest.fn(),
  xAck: jest.fn(),
  xDel: jest.fn(),
  xLen: jest.fn(),
  unlink: jest.fn()
};

jest.mock("./redisClient", () => ({
  getRedisClient: jest.fn(async () => mockRedis)
}));

jest.mock("../../service/LoggingService.js", () => ({
  getLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() })
}));

const queue = require("./redisStreamQueue");

describe("redisStreamQueue batched device enqueue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.eval.mockResolvedValue([2, 1]);
  });

  test("enqueues an entire batch with one atomic Redis script call", async () => {
    const result = await queue.enqueueMountNames(
      ["device-1", "device-2", "device-3"],
      { batchSize: 500, pauseMs: 0 },
      {}
    );

    expect(result).toEqual({ enqueued: 2, skipped: 1, failed: 0 });
    expect(mockRedis.eval).toHaveBeenCalledTimes(1);
    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        keys: expect.arrayContaining([
          "dpmdp:stream:device-processing",
          "dpmdp:set:device-processing"
        ]),
        arguments: expect.arrayContaining(["device-1", "device-2", "device-3"])
      })
    );
  });

  test("reports the whole batch as failed when the atomic call fails", async () => {
    mockRedis.eval.mockRejectedValue(new Error("Redis unavailable"));

    const result = await queue.enqueueMountNames(
      ["device-1", "device-2"],
      { batchSize: 500, pauseMs: 0 },
      { error: jest.fn() }
    );

    expect(result).toEqual({ enqueued: 0, skipped: 0, failed: 2 });
  });
});

describe("Kafka outbound dead-letter metadata", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.xAdd.mockResolvedValue("2-0");
    mockRedis.xAck.mockResolvedValue(1);
    mockRedis.xDel.mockResolvedValue(1);
    mockRedis.xLen.mockResolvedValue(4);
    mockRedis.unlink.mockResolvedValue(1);
  });

  test("moves only compact failure metadata and never copies the payload", async () => {
    mockRedis.eval
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(1);
    await queue.moveKafkaOutboundToDeadLetter({
      id: "1-0",
      message: {
        mountName: "device-1",
        targetConsumer: "NETEXPLORER",
        payloadBytes: "1856279",
        payload: "very-large-payload"
      }
    }, {
      reason: "KAFKA_MESSAGE_SIZE_TOO_LARGE",
      message: "Kafka message exceeds permitted size"
    }, "oversized", "worker-1", {});

    expect(mockRedis.eval).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        keys: [
          "dpmdp:stream:kafka-outbound",
          "dpmdp:stream:kafka-outbound-dead-letter",
          "dpmdp:hash:kafka-daily-metrics"
        ],
        arguments: expect.arrayContaining([
          "1-0", "worker-1", "NETEXPLORER", "device-1", "1856279", "1.770",
          "KAFKA_MESSAGE_SIZE_TOO_LARGE",
          "Kafka message exceeds permitted size", "oversized"
        ])
      })
    );
  });

  test("renews ownership only for message IDs still owned by the worker", async () => {
    mockRedis.eval.mockResolvedValueOnce(["1-0", "2-0"]);

    await expect(
      queue.renewKafkaOutboundOwnership(["1-0", "2-0"], "worker-1", {})
    ).resolves.toEqual(["1-0", "2-0"]);
    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        keys: ["dpmdp:stream:kafka-outbound"],
        arguments: [
          "dpmdp:group:kafka-outbound", "worker-1", "1-0", "2-0"
        ]
      })
    );
  });

  test("clears the dead-letter stream and returns its previous entry count", async () => {
    await expect(queue.clearKafkaOutboundDeadLetter({})).resolves.toBe(4);
    expect(mockRedis.unlink).toHaveBeenCalledWith(
      "dpmdp:stream:kafka-outbound-dead-letter"
    );
  });

  test("records compact successful-delivery metadata with payload size in MB", async () => {
    await queue.recordKafkaOutboundSuccess([{
      id: "3-0",
      message: {
        mountName: "device-2",
        targetConsumer: "APT",
        payloadBytes: "2097152",
        payload: "must-not-be-copied"
      }
    }], {});

    expect(mockRedis.xAdd).toHaveBeenCalledWith(
      "dpmdp:stream:kafka-outbound-success",
      "*",
      expect.objectContaining({
        originalMessageId: "3-0",
        mountName: "device-2",
        targetConsumer: "APT",
        payloadBytes: "2097152",
        payloadSizeMb: "2.000",
        deliveredAt: expect.any(String)
      })
    );
    expect(mockRedis.xAdd.mock.calls[0][2]).not.toHaveProperty("payload");
  });

  test("clears the success stream and returns its previous entry count", async () => {
    await expect(queue.clearKafkaOutboundSuccess({})).resolves.toBe(4);
    expect(mockRedis.unlink).toHaveBeenCalledWith(
      "dpmdp:stream:kafka-outbound-success"
    );
  });
});

describe("Redis Kafka daily metrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.eval.mockResolvedValue([]);
  });

  test("increments total and consumer metric atomically", async () => {
    await queue.updateKafkaDailyMetrics("successful", "NetExplorer", 3, {});

    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        keys: [
          "dpmdp:hash:kafka-daily-metrics",
          "dpmdp:stream:kafka-outbound-success",
          "dpmdp:stream:kafka-outbound-dead-letter"
        ],
        arguments: expect.arrayContaining([
          "Europe/Berlin",
          "successful",
          "NETEXPLORER",
          "3"
        ])
      })
    );
  });

  test("rejects unsupported metric names", async () => {
    await expect(
      queue.updateKafkaDailyMetrics("retried", "APT", 1, {})
    ).rejects.toThrow("Unsupported Kafka daily metric");
  });
});
