const { performance } = require("perf_hooks");
const daily = new (require("./dailyPerformanceMetrics").DailyPerformanceMetrics)();
const rateStartSecond = Math.floor(performance.now() / 1000);
const recentCounts = new Map();
const recentActivity = new Map();
const busy = { device: true, kafka: true }; // Unknown is conservatively counted.
const generation = { device: 0, kafka: 0 };
let activityAt = Date.now();
let activityClock = performance.now();

function accountActivity() {
  const now = Date.now(), clock = performance.now();
  for (const stage of ["device", "kafka"]) if (busy[stage]) {
    daily.addActivity(stage, activityAt, now);
    for (let cursor = Math.max(activityClock, clock - 301000); cursor < clock;) {
      const second = Math.floor(cursor / 1000);
      const end = Math.min(clock, (second + 1) * 1000);
      if (!recentActivity.has(second)) recentActivity.set(second, { device: 0, kafka: 0 });
      recentActivity.get(second)[stage] += (end - cursor) / 1000;
      cursor = end;
    }
  }
  activityAt = now; activityClock = clock;
  for (const second of recentActivity.keys()) if (second < Math.floor(clock / 1000) - 301) recentActivity.delete(second);
}

function markBusy(stage) {
  accountActivity(); busy[stage] = true; generation[stage]++;
}
const rateFields = ["device:updatesPerSec", "kafka:messagesPerSec",
  "kafka:APT:messagesPerSec", "kafka:MYCOM:messagesPerSec", "kafka:NETEXPLORER:messagesPerSec"];

// No mount names/correlation IDs in Prometheus labels: cardinality stays bounded.
const buckets = [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30, 60, 300, 900];
const observations = new Map();
const workers = { device: { configured: 0, active: 0 }, kafka: { configured: 0, active: 0 } };
const enqueued = { device: 0, kafka: 0 };
let options = { enabled: false, maxLen: 200000, maxBuffer: 2000 };
let buffer = [];
let timer;
let queueTimer;
let sampling = false;
let queueSnapshot = [];
let queueSampleAt = 0;
let flushing = false;
let dropped = 0;
let log;

function configure(config = {}, logger) {
  const positive = (value, fallback) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
  options = {
    enabled: config.enabled !== false,
    // Detailed per-mount streams are opt-in; summary rates remain enabled.
    streamsEnabled: config.streamsEnabled === true,
    compactStreamsEnabled: config.compactStreamsEnabled === true,
    maxLen: positive(config.streamMaxLen, 200000),
    maxBuffer: positive(config.bufferMaxEntries, 2000)
  };
  log = logger;
  clearInterval(timer);
  clearInterval(queueTimer);
  if (options.enabled) {
    if (options.streamsEnabled || options.compactStreamsEnabled) {
      timer = setInterval(flush, positive(config.flushIntervalMs, 1000));
      timer.unref();
    }
    queueTimer = setInterval(sampleQueues, 15000);
    queueTimer.unref();
  }
}

function begin(message, pickedAt = Date.now()) {
  const idTime = Number(String(message.id || "").split("-")[0]);
  const startedAt = Date.now();
  return {
    clock: performance.now(),
    fields: {
      originalMessageId: String(message.id || ""),
      mountName: String(message.message?.mountName || ""),
      correlationId: String(message.message?.correlationId || ""),
      pickedAt: new Date(pickedAt).toISOString(),
      processingStartedAt: new Date(startedAt).toISOString(),
      queueWaitingMs: Number.isFinite(idTime) && idTime > 0 ? Math.max(0, pickedAt - idTime) : "",
      workerWaitingMs: Math.max(0, startedAt - pickedAt)
    }
  };
}

function observe(stage, outcome, target, field, milliseconds) {
  if (milliseconds === "" || milliseconds == null || !Number.isFinite(Number(milliseconds))) return;
  const key = JSON.stringify([stage, outcome, target, field]);
  let item = observations.get(key);
  if (!item) {
    item = { stage, outcome, target, field, count: 0, sum: 0, buckets: buckets.map(() => 0) };
    observations.set(key, item);
  }
  const seconds = Number(milliseconds) / 1000;
  item.count++;
  item.sum += seconds;
  buckets.forEach((limit, index) => { if (seconds <= limit) item.buckets[index]++; });
}

function record(stage, timing, extra = {}) {
  const target = ["APT", "MYCOM", "NETEXPLORER"].includes(extra.targetConsumer) ? extra.targetConsumer : "UNKNOWN";
  const record = {
    ...timing.fields,
    processingMs: Math.max(0, performance.now() - timing.clock).toFixed(3),
    completedAt: new Date().toISOString(),
    ...extra
  };
  const outcome = record.outcome || "SUCCESS";
  const second = Math.floor(performance.now() / 1000);
  for (const key of recentCounts.keys()) if (key < second - 300) recentCounts.delete(key);
  const acknowledged = stage === "kafka" && record.sendToAckMs !== "" &&
    record.sendToAckMs != null && Number.isFinite(Number(record.sendToAckMs));
  if (outcome === "SUCCESS" && (stage === "device" || acknowledged)) {
    daily.record(stage, target);
    if (!recentCounts.has(second)) recentCounts.set(second, Object.fromEntries(rateFields.map(key => [key, 0])));
    const counts = recentCounts.get(second);
    if (stage === "device") counts["device:updatesPerSec"]++;
    else {
      counts["kafka:messagesPerSec"]++;
      const key = `kafka:${target}:messagesPerSec`;
      if (key in counts) counts[key]++;
    }
  }
  for (const field of ["queueWaitingMs", "workerWaitingMs", "processingMs", "payloadLoadMs", "sendToAckMs"]) {
    observe(stage, outcome, target, field, record[field]);
  }
  if (!options.enabled || !options.streamsEnabled || options.compactStreamsEnabled) return;
  if (buffer.length >= options.maxBuffer) { dropped++; return; }
  buffer.push({ stage, fields: Object.fromEntries(Object.entries(record).map(([key, value]) => [key, String(value ?? "")])) });
}

// Bounded, best-effort evidence. Never await Redis timing writes on delivery paths.
async function flush() {
  if (!options.enabled || !(options.streamsEnabled || options.compactStreamsEnabled) || flushing || !buffer.length) return;
  flushing = true;
  const entries = buffer.splice(0, 100);
  try {
    const { recordPerformanceTimings } = require("../infra/redis/redisStreamQueue");
    const written = await recordPerformanceTimings(entries, options.maxLen, log);
    dropped += entries.length - Number(written);
  } catch (error) {
    dropped += entries.length;
    log?.warn?.({ error: error.message, count: entries.length }, "Performance timing evidence could not be saved; processing is unaffected");
  } finally {
    flushing = false;
  }
}

// Called immediately after Redis completion. Does not alter rate counters.
function recordCompleted(stage, timing, extra = {}) {
  if (!options.enabled || !options.compactStreamsEnabled) return;
  if (buffer.length >= options.maxBuffer) { dropped++; return; }
  const fields = {
    mountName: String(timing.fields.mountName || ""),
    processingSeconds: (Math.max(0, performance.now() - timing.clock) / 1000).toFixed(3)
  };
  if (stage === "kafka") Object.assign(fields, {
    targetConsumer: String(extra.targetConsumer || "UNKNOWN"),
    beforeCompressionMB: Number.isFinite(Number(extra.payloadBytes)) ? (Number(extra.payloadBytes) / 1000000).toFixed(6) : "unavailable",
    afterCompressionMB: "unavailable",
    status: extra.status || "SUCCESS"
  });
  buffer.push({ stage, completedAt: new Date().toISOString(), fields });
}

async function sampleQueues() {
  if (sampling) return;
  sampling = true;
  try {
    const { getPerformanceQueueStats, writePerformanceMetricsSnapshot } = require("../infra/redis/redisStreamQueue");
    try {
      const before = { ...generation };
      queueSnapshot = await getPerformanceQueueStats(log);
      accountActivity();
      for (const sample of queueSnapshot) {
        const stage = sample.stage;
        // Never declare idle across a concurrent enqueue/worker transition.
        busy[stage] = generation[stage] !== before[stage] || workers[stage].active > 0 ||
          // Retained acknowledged entries are not outstanding work. If lag or
          // pending is unknown, conservatively count the stage as busy.
          sample.lag !== 0 || sample.pending !== 0 ||
          (stage === "device" && sample.retryPending !== 0);
      }
      queueSampleAt = Date.now() / 1000;
    } catch (error) {
      accountActivity(); busy.device = true; busy.kafka = true;
      log?.warn?.({ error: error.message }, "Performance queue sample unavailable");
    }
    await writePerformanceMetricsSnapshot({ ...buildSnapshot(), ...await daily.summary(log) }, log);
  } catch (error) {
    log?.warn?.({ error: error.message }, "Performance metrics hash could not be updated; processing is unaffected");
  } finally { sampling = false; }
}

function buildSnapshot() {
  accountActivity();
  // Whole-second buckets keep memory bounded and do not depend on UI refreshes
  // or Redis availability. Exclude the current, incomplete second.
  const end = Math.floor(performance.now() / 1000);
  const start = Math.max(rateStartSecond, end - 300);
  const seconds = Math.max(0, end - start);
  const totals = Object.fromEntries(rateFields.map(key => [key, 0]));
  const activeSeconds = { device: 0, kafka: 0 };
  for (const [second, durations] of recentActivity) if (second >= start && second < end) {
    activeSeconds.device += durations.device; activeSeconds.kafka += durations.kafka;
  }
  for (const [second, counts] of recentCounts) {
    if (second < start) recentCounts.delete(second);
    else if (second < end) for (const key of rateFields) totals[key] += counts[key];
  }
  return {
    ...Object.fromEntries(rateFields.map(key => {
      const denominator = activeSeconds[key.startsWith("device:") ? "device" : "kafka"];
      return [key, denominator ? (totals[key] / denominator).toFixed(4) : "unavailable"];
    })),
    rateBasis: "work-outstanding-time; sampled-idle; monitored-time-only",
    deviceActiveSeconds: activeSeconds.device.toFixed(3),
    kafkaActiveSeconds: activeSeconds.kafka.toFixed(3),
    measurementWindowSeconds: String(seconds),
    updatedAt: new Date().toISOString()
  };
}

function setWorkers(stage, configured) { workers[stage].configured = configured; }
function active(stage, delta) { markBusy(stage); workers[stage].active += delta; }
function enqueue(stage, count = 1) { if (count > 0) markBusy(stage); enqueued[stage] += count; }

function render() {
  const lines = [
    "# TYPE dpmdp_timing_records_dropped_total counter",
    `dpmdp_timing_records_dropped_total ${dropped}`,
    `dpmdp_timing_buffer_entries ${buffer.length}`,
    "# TYPE dpmdp_enqueued_total counter",
    "# TYPE dpmdp_workers_configured gauge",
    "# TYPE dpmdp_workers_active gauge"
  ];
  lines.push(`dpmdp_queue_sample_timestamp_seconds ${queueSampleAt}`);
  for (const sample of queueSnapshot) {
    for (const field of ["entries", "pending", "lag"]) {
      if (sample[field] !== null && sample[field] !== undefined) {
        lines.push(`dpmdp_queue_${field}{stage="${sample.stage}"} ${sample[field]}`);
      }
    }
  }
  for (const [stage, values] of Object.entries(workers)) {
    lines.push(`dpmdp_enqueued_total{stage="${stage}"} ${enqueued[stage]}`);
    lines.push(`dpmdp_workers_configured{stage="${stage}"} ${values.configured}`);
    lines.push(`dpmdp_workers_active{stage="${stage}"} ${values.active}`);
  }
  const names = { queueWaitingMs: "queue_wait", workerWaitingMs: "worker_wait", processingMs: "processing", payloadLoadMs: "payload_load", sendToAckMs: "send_to_ack" };
  const declared = new Set();
  for (const item of observations.values()) {
    const name = `dpmdp_${names[item.field]}_seconds`;
    if (!declared.has(name)) { lines.push(`# TYPE ${name} histogram`); declared.add(name); }
    const labels = `stage="${item.stage}",outcome="${item.outcome}",target="${item.target}"`;
    buckets.forEach((limit, i) => lines.push(`${name}_bucket{${labels},le="${limit}"} ${item.buckets[i]}`));
    lines.push(`${name}_bucket{${labels},le="+Inf"} ${item.count}`);
    lines.push(`${name}_count{${labels}} ${item.count}`);
    lines.push(`${name}_sum{${labels}} ${item.sum}`);
  }
  return lines.join("\n");
}

module.exports = { configure, begin, record, recordCompleted, flush, render, setWorkers, active, enqueue, sampleQueues };
