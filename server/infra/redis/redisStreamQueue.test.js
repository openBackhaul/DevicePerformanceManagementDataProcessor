const mockRedis = {
  eval: jest.fn(),
  xAdd: jest.fn(),
  xAck: jest.fn(),
  xDel: jest.fn(),
  xLen: jest.fn(),
  xReadGroup: jest.fn(),
  unlink: jest.fn(),
  xRange: jest.fn(),
  sRem: jest.fn(),
  sCard: jest.fn().mockResolvedValue(0),
  hDel: jest.fn(),
  xInfoGroups: jest.fn(),
  multi: jest.fn()
};

jest.mock("./redisClient", () => ({
  getRedisClient: jest.fn(async () => mockRedis)
}));

jest.mock("../../service/LoggingService.js", () => ({
  getLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() })
}));

const queue = require("./redisStreamQueue");

describe("atomic acknowledgement and deletion", () => {
  test.each([0, 1])("device acknowledgement returns %i without a separate deletion", async count => {
    mockRedis.eval.mockReset().mockResolvedValue(count);
    expect(await queue.ackMessage("1-0", {})).toBe(count);
    const [script, options] = mockRedis.eval.mock.calls[0];
    expect(script).toContain("if acknowledged == 1 then redis.call('XDEL'");
    expect(options.arguments).toEqual(["dpmdp:group:device-processing", "1-0"]);
  });
  test("Kafka script checks ownership before atomic acknowledgement/deletion", async () => {
    mockRedis.eval.mockReset().mockResolvedValue(1);
    expect(await queue.ackKafkaOutbound("1-0", "worker", {})).toBe(1);
    const [script] = mockRedis.eval.mock.calls[0];
    expect(script).toContain("pending[1][2] ~= ARGV[3]");
    expect(script).toContain("if acknowledged == 1 then redis.call('XDEL'");
    expect(script.indexOf("pending[1][2]")).toBeLessThan(script.indexOf("'XACK'"));
  });
});

describe("blocking reads use isolated Redis connections", () => {
  test.each(["readNext", "readNextRetry", "readNextKafkaOutbound"])("%s isolates BLOCK from shared commands", async method => {
    mockRedis.xReadGroup.mockReset().mockResolvedValue(null);
    expect(await queue[method]("worker", 5000, 10, {})).toEqual([]);
    const args = mockRedis.xReadGroup.mock.calls[0];
    expect(args[0].isolated).toBe(true);
    expect(args[2]).toBe("worker");
    expect(args[4]).toEqual({ COUNT: 10, BLOCK: 5000 });
  });
});

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
          "dpmdp:set:device-processing",
          "dpmdp:hash:retry-count",
          "dpmdp:hash:retry-state"
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

describe("replica retry-state cleanup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.sRem.mockResolvedValue(1);
    mockRedis.hDel.mockResolvedValue(1);
  });

  test("atomically resets replica retry eligibility while enqueueing", async () => {
    mockRedis.eval.mockResolvedValue([2, 0]);

    await queue.enqueueMountNames(
      ["device-1", "device-2"],
      {
        batchSize: 500,
        pauseMs: 0,
        resetRetryEligibilityBeforeEnqueue: true
      },
      {}
    );

    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        keys: [
          "dpmdp:stream:device-processing",
          "dpmdp:set:device-processing",
          "dpmdp:set:retry-dead-letter",
          "dpmdp:set:retry-pending",
          "dpmdp:hash:retry-count",
          "dpmdp:hash:retry-state"
        ],
        arguments: expect.arrayContaining(["0", "0", "1", "device-1", "device-2"])
      })
    );
  });

  test("clears authoritative retry state without scanning complete streams", async () => {
    const result = await queue.clearRetryAndDeadLetterForReplicaUpdates(
      ["device-1", "device-2", "device-1", ""],
      { info: jest.fn() }
    );

    expect(result).toEqual({
      mountNameCount: 2,
      retryStreamDeleted: 0,
      deadLetterStreamDeleted: 0,
      staleStreamEntriesDeferred: true
    });
    expect(mockRedis.xRange).not.toHaveBeenCalled();
    expect(mockRedis.sRem).toHaveBeenCalledTimes(2);
    expect(mockRedis.hDel).toHaveBeenCalledTimes(2);
    expect(mockRedis.sRem).toHaveBeenCalledWith(
      "dpmdp:set:retry-pending",
      ["device-1", "device-2"]
    );
    expect(mockRedis.sRem).toHaveBeenCalledWith(
      "dpmdp:set:retry-dead-letter",
      ["device-1", "device-2"]
    );
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
  test("writes the performance hash and expiry atomically without changing daily counters", async () => {
    const transaction = { del: jest.fn().mockReturnThis(), hSet: jest.fn().mockReturnThis(), expire: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([]) };
    mockRedis.multi.mockReturnValue(transaction);
    const fields = { "device:updatesPerSec": "3.1700", updatedAt: "2026-09-09T12:00:00Z" };
    await queue.writePerformanceMetricsSnapshot(fields, {});
    expect(transaction.hSet).toHaveBeenCalledWith("dpmdp:hash:performance-metrics", fields);
    expect(transaction.del).toHaveBeenCalledWith("dpmdp:hash:performance-metrics");
    expect(transaction.expire).toHaveBeenCalledWith("dpmdp:hash:performance-metrics", 120);
    expect(transaction.exec).toHaveBeenCalledTimes(1);
    expect(mockRedis.eval).not.toHaveBeenCalled();
  });
  test("keeps unknown group lag unknown and samples entries independently of pending", async () => {
    mockRedis.xLen.mockResolvedValue(100);
    mockRedis.xInfoGroups.mockImplementation(async key => [{
      name: key.includes("kafka") ? "dpmdp:group:kafka-outbound" : "dpmdp:group:device-processing",
      pending: 3, lag: null
    }]);
    const result = await queue.getPerformanceQueueStats({});
    expect(result).toEqual([
      { stage: "device", entries: 100, pending: 3, lag: null, retryPending: 0 },
      { stage: "kafka", entries: 100, pending: 3, lag: null, retryPending: 0 }
    ]);
  });
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
          "dpmdp:stream:kafka-outbound-dead-letter",
          "dpmdp:stream:device-processing-timing",
          "dpmdp:stream:kafka-outbound-timing"
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

  test("writes bounded timing evidence through the same daily reset script", async () => {
    await queue.recordPerformanceTimings([{ stage: "device", fields: {
      mountName: "cc", completedAt: "2026-09-09T10:00:00.000Z", processingMs: "12"
    } }], 200000, {});
    const [script, args] = mockRedis.eval.mock.calls[0];
    expect(script).toContain("record.date == ARGV[1]");
    expect(script).toContain("'MAXLEN', '~'");
    expect(script).toContain("'UNLINK', KEYS[2], KEYS[3], KEYS[4], KEYS[5]");
    expect(args.arguments[7]).toBe("200000");
    expect(JSON.parse(args.arguments[6])[0].date).toBe("2026-09-09");
  });
});
