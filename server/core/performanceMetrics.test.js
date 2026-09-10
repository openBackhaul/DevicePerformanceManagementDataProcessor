jest.mock("perf_hooks", () => ({ performance: { now: () => Date.now() } }));
jest.mock("./dailyPerformanceMetrics", () => ({ DailyPerformanceMetrics: jest.fn(() => ({
  record: jest.fn(), addActivity: jest.fn(), summary: jest.fn().mockResolvedValue({})
})) }));
jest.mock("../infra/redis/redisStreamQueue", () => ({
  recordPerformanceTimings: jest.fn(),
  getPerformanceQueueStats: jest.fn(),
  writePerformanceMetricsSnapshot: jest.fn()
}));

describe("bounded performance timing evidence", () => {
  let metrics;
  let queue;
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.setSystemTime(1000000);
    metrics = require("./performanceMetrics");
    queue = require("../infra/redis/redisStreamQueue");
    queue.recordPerformanceTimings.mockImplementation(async entries => entries.length);
    queue.getPerformanceQueueStats.mockResolvedValue([{ stage: "device", entries: 20, pending: 2, lag: null }]);
    queue.writePerformanceMetricsSnapshot.mockResolvedValue(undefined);
  });
  afterEach(() => { metrics.configure({ enabled: false }); jest.useRealTimers(); });

  test.each([
    { pending: 0, lag: 0, retryPending: 0, expected: "0.000" },
    { pending: 1, lag: 0, retryPending: 0, expected: "15.000" },
    { pending: 0, lag: 2, retryPending: 0, expected: "15.000" },
    { pending: 0, lag: null, retryPending: 0, expected: "15.000" },
    { pending: null, lag: 0, retryPending: 0, expected: "15.000" },
    { pending: 0, lag: 0, retryPending: 1, expected: "15.000" }
  ])("idle accounting uses group work, not retained entries: %j", async state => {
    queue.getPerformanceQueueStats.mockResolvedValue([{ stage: "device", entries: 24, ...state }]);
    await metrics.sampleQueues();
    jest.advanceTimersByTime(15000);
    await metrics.sampleQueues();
    expect(queue.writePerformanceMetricsSnapshot.mock.calls.at(-1)[0].deviceActiveSeconds).toBe(state.expected);
  });

  test("active worker keeps time running even with a drained group", async () => {
    queue.getPerformanceQueueStats.mockResolvedValue([{ stage: "device", entries: 0, pending: 0, lag: 0, retryPending: 0 }]);
    metrics.active("device", 1);
    await metrics.sampleQueues();
    jest.advanceTimersByTime(15000);
    await metrics.sampleQueues();
    expect(queue.writePerformanceMetricsSnapshot.mock.calls.at(-1)[0].deviceActiveSeconds).toBe("15.000");
  });

  test("separates Redis wait from time waiting behind prefetched messages", () => {
    jest.setSystemTime(10000);
    const timing = metrics.begin({ id: "1000-0", message: { mountName: "device-1" } }, 4000);
    expect(timing.fields.queueWaitingMs).toBe(3000);
    expect(timing.fields.workerWaitingMs).toBe(6000);
    expect(metrics.begin({ id: "invalid" }).fields.queueWaitingMs).toBe("");
  });

  test("buffers without delaying processing and never stores payloads", async () => {
    metrics.configure({ streamsEnabled: true }, {});
    metrics.record("device", metrics.begin({ id: "1000-0", message: { mountName: "cc", payload: "large" } }), { outcome: "SUCCESS" });
    expect(queue.recordPerformanceTimings).not.toHaveBeenCalled();
    await metrics.flush();
    expect(queue.recordPerformanceTimings.mock.calls[0][0][0].fields).toEqual(expect.objectContaining({ mountName: "cc", outcome: "SUCCESS" }));
    expect(JSON.stringify(queue.recordPerformanceTimings.mock.calls)).not.toContain("large");
  });

  test("bounds the buffer and absorbs Redis failures without throwing", async () => {
    metrics.configure({ streamsEnabled: true, bufferMaxEntries: 1 }, { warn: jest.fn() });
    metrics.record("device", metrics.begin({ id: "1000-0" }));
    metrics.record("device", metrics.begin({ id: "1000-0" }));
    expect(metrics.render()).toContain("dpmdp_timing_records_dropped_total 1");
    queue.recordPerformanceTimings.mockRejectedValue(new Error("Redis unavailable"));
    await expect(metrics.flush()).resolves.toBeUndefined();
    expect(metrics.render()).toContain("dpmdp_timing_records_dropped_total 2");
  });

  test("exports cumulative histograms with bounded labels and no fake linger", () => {
    metrics.record("kafka", metrics.begin({ id: "1000-0", message: { mountName: "secret-mount" } }), {
      outcome: "SUCCESS", targetConsumer: "APT", sendToAckMs: 50, actualLingerMs: "unavailable"
    });
    const output = metrics.render();
    expect(output).toContain('dpmdp_send_to_ack_seconds_sum{stage="kafka",outcome="SUCCESS",target="APT"} 0.05');
    expect(output).not.toContain("secret-mount");
    expect(output).not.toContain("linger_seconds");
  });

  test("publishes only five success rates and two freshness fields", async () => {
    metrics.setWorkers("device", 20);
    metrics.enqueue("device", 6);
    const timing = metrics.begin({ id: "1000-0" });
    metrics.record("device", timing, { outcome: "SUCCESS", processingMs: 2000, queueWaitingMs: 100, workerWaitingMs: 20 });
    metrics.record("device", timing, { outcome: "SUCCESS", processingMs: 4000, queueWaitingMs: "", workerWaitingMs: 40 });
    metrics.record("device", timing, { outcome: "FAILED", processingMs: 90000 });
    metrics.record("kafka", timing, { outcome: "SUCCESS", targetConsumer: "APT", sendToAckMs: 50, configuredLingerMs: 50 });
    jest.advanceTimersByTime(15000);
    await metrics.sampleQueues();
    const fields = queue.writePerformanceMetricsSnapshot.mock.calls[0][0];
    expect(fields).toMatchObject({
      "device:updatesPerSec": "0.1333",
      "kafka:messagesPerSec": "0.0667",
      "kafka:APT:messagesPerSec": "0.0667",
      "kafka:MYCOM:messagesPerSec": "0.0000",
      "kafka:NETEXPLORER:messagesPerSec": "0.0000",
      measurementWindowSeconds: "15"
    });
    expect(Object.keys(fields)).toHaveLength(10);
    jest.advanceTimersByTime(15000);
    await metrics.sampleQueues();
    expect(queue.writePerformanceMetricsSnapshot.mock.calls[1][0]["device:updatesPerSec"]).toBe("0.0667");
    jest.advanceTimersByTime(300000);
    await metrics.sampleQueues();
    expect(queue.writePerformanceMetricsSnapshot.mock.calls[2][0]).toMatchObject({
      "device:updatesPerSec": "0.0000", measurementWindowSeconds: "300"
    });
  });

  test("hash publication failures do not throw or block later attempts", async () => {
    metrics.configure({ enabled: false }, { warn: jest.fn() });
    queue.writePerformanceMetricsSnapshot.mockRejectedValueOnce(new Error("Redis unavailable"));
    await expect(metrics.sampleQueues()).resolves.toBeUndefined();
    await metrics.sampleQueues();
    expect(queue.writePerformanceMetricsSnapshot).toHaveBeenCalledTimes(2);
  });

  test("publishes local rates even if queue sampling fails", async () => {
    queue.getPerformanceQueueStats.mockRejectedValue(new Error("Redis queue lookup failed"));
    await metrics.sampleQueues();
    expect(queue.writePerformanceMetricsSnapshot.mock.calls[0][0]).toMatchObject({
      measurementWindowSeconds: "0", "device:updatesPerSec": "unavailable"
    });
  });

  test("publishes automatically every 15 seconds when enabled", async () => {
    metrics.configure({ enabled: true });
    await jest.advanceTimersByTimeAsync(15000);
    expect(queue.writePerformanceMetricsSnapshot).toHaveBeenCalledTimes(1);
  });

  test("disables detailed streams by default but keeps summary publishing enabled", async () => {
    metrics.configure({ enabled: true });
    metrics.record("device", metrics.begin({ id: "1000-0" }), { outcome: "SUCCESS" });
    await jest.advanceTimersByTimeAsync(15000);
    expect(queue.recordPerformanceTimings).not.toHaveBeenCalled();
    expect(queue.writePerformanceMetricsSnapshot).toHaveBeenCalledTimes(1);
    expect(queue.writePerformanceMetricsSnapshot.mock.calls[0][0]["device:updatesPerSec"]).toBe("0.0667");
  });

  test("includes daily rates in the summary and excludes failed observations", async () => {
    const daily = require("./dailyPerformanceMetrics").DailyPerformanceMetrics.mock.results[0].value;
    daily.summary.mockResolvedValue({ "device:daily:updatesPerSec": "1.0000" });
    metrics.record("device", metrics.begin({ id: "1000-0" }), { outcome: "FAILED" });
    expect(daily.record).not.toHaveBeenCalled();
    metrics.record("device", metrics.begin({ id: "1000-0" }), { outcome: "SUCCESS" });
    expect(daily.record).toHaveBeenCalledWith("device", "UNKNOWN");
    await metrics.sampleQueues();
    expect(queue.writePerformanceMetricsSnapshot.mock.calls[0][0]["device:daily:updatesPerSec"]).toBe("1.0000");
  });

  test("excludes empty time but includes retry waits and concurrent workers only once", async () => {
    queue.getPerformanceQueueStats.mockResolvedValue([
      { stage: "device", entries: 24, pending: 0, lag: 0, retryPending: 0 },
      { stage: "kafka", entries: 33, pending: 0, lag: 0, retryPending: 0 }
    ]);
    await metrics.sampleQueues();
    jest.advanceTimersByTime(60000);
    metrics.active("device", 1); metrics.active("device", 1);
    metrics.enqueue("kafka");
    jest.advanceTimersByTime(10000);
    metrics.record("device", metrics.begin({}));
    metrics.record("kafka", metrics.begin({}), { targetConsumer: "APT", sendToAckMs: 50 });
    metrics.active("device", -2);
    queue.getPerformanceQueueStats.mockResolvedValue([
      { stage: "device", entries: 0, pending: 0, retryPending: 1 },
      { stage: "kafka", entries: 1, pending: 1, retryPending: 0 }
    ]);
    await metrics.sampleQueues();
    jest.advanceTimersByTime(10000);
    await metrics.sampleQueues();
    expect(queue.writePerformanceMetricsSnapshot.mock.calls.at(-1)[0]).toMatchObject({
      "device:updatesPerSec": "0.0500", "kafka:messagesPerSec": "0.0500",
      deviceActiveSeconds: "20.000", kafkaActiveSeconds: "20.000"
    });
  });
});
