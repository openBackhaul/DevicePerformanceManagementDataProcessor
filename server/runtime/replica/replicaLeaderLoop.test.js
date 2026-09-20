jest.mock("../../utils/retry", () => ({ sleep: jest.fn() }));
jest.mock("../../infra/redis/redisStreamQueue", () => ({ getQueueLength: jest.fn() }));
jest.mock("../../infra/redis/redisLock", () => ({
  acquireLock: jest.fn(),
  renewLock: jest.fn(),
  releaseLock: jest.fn()
}));
jest.mock("../../specificFunctions/p1StreamPmData/p1UpdateMwdiReplica/P1UpdateMwdiReplica", () => ({
  run: jest.fn()
}));

const { calculateNextCycleDelayMs } = require("./replicaLeaderLoop");

describe("replica fixed-rate scheduling", () => {
  test("subtracts cycle execution time from the configured interval", () => {
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now);

    expect(calculateNextCycleDelayMs(now - 120000, 480000, 1000)).toBe(360000);

    Date.now.mockRestore();
  });

  test("starts the next cycle after only the safety delay when execution exceeds the interval", () => {
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now);

    expect(calculateNextCycleDelayMs(now - 600000, 480000, 1000)).toBe(1000);

    Date.now.mockRestore();
  });
});
