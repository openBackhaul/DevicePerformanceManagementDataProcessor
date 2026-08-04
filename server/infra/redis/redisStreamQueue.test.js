const mockRedis = {
  eval: jest.fn()
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
