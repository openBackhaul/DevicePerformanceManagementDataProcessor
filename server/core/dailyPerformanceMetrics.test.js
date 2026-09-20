const mockRedis = { eval: jest.fn() };
jest.mock("../infra/redis/redisClient", () => ({ getRedisClient: jest.fn(async () => mockRedis) }));
const { DailyPerformanceMetrics, dayWindow, persistScript } = require("./dailyPerformanceMetrics");

describe("calendar-day performance rates", () => {
  let savedDays;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-09T22:00:00Z")); // Berlin midnight
    savedDays = new Map();
    mockRedis.eval.mockReset();
    // Model the script's snapshot-difference contract without a live Redis.
    mockRedis.eval.mockImplementation(async (_, request) => {
      const key = request.keys[0];
      if (!savedDays.has(key)) savedDays.set(key, { checkpoints: new Map(), counts: Array(7).fill(0), tracked: Infinity });
      const state = savedDays.get(key);
      const [id, json, tracked] = request.arguments;
      const counts = JSON.parse(json), previous = state.checkpoints.get(id) || Array(7).fill(0);
      counts.forEach((value, index) => { state.counts[index] += Math.max(0, value - previous[index]); });
      state.checkpoints.set(id, counts);
      state.tracked = Math.min(state.tracked, Number(tracked));
      return [...state.counts, state.tracked];
    });
  });
  afterEach(() => jest.useRealTimers());

  test("uses stage active time and persists totals across a restart", async () => {
    const first = new DailyPerformanceMetrics();
    first.record("device");
    first.record("kafka", "APT");
    jest.advanceTimersByTime(60000);
    first.addActivity("device", Date.now() - 60000, Date.now());
    first.addActivity("kafka", Date.now() - 60000, Date.now());
    const result = await first.summary({});
    expect(result).toMatchObject({
      "device:daily:updatesPerSec": "0.0167", "kafka:daily:APT:messagesPerSec": "0.0167",
      dailyDate: "2026-09-10", dailyElapsedSeconds: "60", dailyCoverage: "monitored-time-only; excludes-process-downtime"
    });
    await first.summary({});
    const restarted = new DailyPerformanceMetrics();
    restarted.record("device");
    jest.advanceTimersByTime(60000);
    restarted.addActivity("device", Date.now() - 60000, Date.now());
    expect(await restarted.summary({})).toMatchObject({
      "device:daily:updatesPerSec": "0.0167", dailyElapsedSeconds: "120"
    });
    expect([...savedDays.values()][0].counts[0]).toBe(2);
  });

  test("attributes completions to their own day and resets the new day even when idle", async () => {
    const metrics = new DailyPerformanceMetrics();
    metrics.record("device");
    jest.advanceTimersByTime(86400000 + 60000);
    const result = await metrics.summary({});
    expect(result).toMatchObject({ dailyDate: "2026-09-11", "device:daily:updatesPerSec": "unavailable" });
    const previous = mockRedis.eval.mock.calls.find(call => call[1].keys[0].endsWith("2026-09-10"));
    expect(previous[1].arguments[4]).toBe("86400");
    expect(savedDays.size).toBe(2);
  });

  test("marks first installation midday as partial rather than claiming full-day coverage", async () => {
    jest.advanceTimersByTime(3600000);
    const metrics = new DailyPerformanceMetrics();
    metrics.record("device");
    expect(await metrics.summary({})).toMatchObject({ dailyCoverage: "monitored-time-only; excludes-process-downtime", dailyElapsedSeconds: "3600" });
  });

  test("retains local observations for retry when persistence fails", async () => {
    const metrics = new DailyPerformanceMetrics();
    metrics.record("device");
    mockRedis.eval.mockRejectedValueOnce(new Error("Redis down"));
    await expect(metrics.summary({})).rejects.toThrow("Redis down");
    jest.advanceTimersByTime(1000);
    metrics.addActivity("device", Date.now() - 1000, Date.now());
    expect((await metrics.summary({}))["device:daily:updatesPerSec"]).toBe("1.0000");
  });

  test("handles Berlin summer/winter time and 23/25-hour calendar days", () => {
    const summer = dayWindow(Date.parse("2026-09-10T10:00:00Z"));
    expect(new Date(summer.start).toISOString()).toBe("2026-09-09T22:00:00.000Z");
    const spring = dayWindow(Date.parse("2026-03-29T10:00:00Z"));
    const autumn = dayWindow(Date.parse("2026-10-25T10:00:00Z"));
    expect(spring.end - spring.start).toBe(23 * 3600000);
    expect(autumn.end - autumn.start).toBe(25 * 3600000);
  });

  test("splits active durations at midnight and excludes later idle time", async () => {
    const metrics = new DailyPerformanceMetrics();
    const midnight = Date.now() + 86400000;
    metrics.addActivity("device", midnight - 10000, midnight + 10000);
    metrics.record("device", undefined, midnight + 5000);
    jest.setSystemTime(midnight + 60000);
    const result = await metrics.summary({});
    expect(result["device:daily:updatesPerSec"]).toBe("0.1000");
    expect(result.dailyDeviceActiveSeconds).toBe("10");
    expect([...savedDays.values()].map(day => day.counts[5])).toEqual([10000, 10000]);
  });

  test("script uses cumulative checkpoints, bounded retention and stores archive rates", () => {
    expect(persistScript).toContain("value - previous");
    expect(persistScript).toContain("if value > previous");
    expect(persistScript).toContain("604800");
    expect(persistScript).toContain("totals[i] / elapsed");
  });
});
