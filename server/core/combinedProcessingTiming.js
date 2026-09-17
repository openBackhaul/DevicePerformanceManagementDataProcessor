// Runtime-only metadata: never changes a p1 contract or an EMP Kafka payload.
const { AsyncLocalStorage } = require("async_hooks");
const { randomUUID } = require("crypto");
const { performance } = require("perf_hooks");
const storage = new AsyncLocalStorage();
const STREAM = "dpmdp:stream:combined-processing-timing";
const DETAILS = "dpmdp:stream:combined-processing-details";
let options = { enabled: false, successStreamEnabled: true };
let buffer = [], timer, flushing = false, logger, dropped = 0;

// One atomic join across processes. Kafka completion may arrive before device
// completion. HSETNX + a retained completion marker make duplicate events safe.
const JOIN = `
local now = tonumber(redis.call('TIME')[1])
local expires = tonumber(ARGV[2])
if expires <= now then return 0 end
for i=1,3 do
  local t = redis.call('TYPE',KEYS[i]).ok
  local wanted = i == 1 and 'hash' or 'stream'
  if t ~= 'none' and t ~= wanted then return redis.error_reply('Timing key has unexpected type') end
end
if redis.call('HGET',KEYS[1],'complete') then return 0 end
local e = cjson.decode(ARGV[1])
redis.call('HSETNX',KEYS[1],e.part,ARGV[1])
redis.call('EXPIREAT',KEYS[1],expires)
local raw = redis.call('HGET',KEYS[1],'device')
if not raw then return 0 end
local d = cjson.decode(raw)
if #d.expected == 0 then return 0 end
local total = d.seconds
local evidence = {}
for _,part in ipairs(d.expected) do
  local kraw = redis.call('HGET',KEYS[1],part)
  if not kraw then return 0 end
  local k = cjson.decode(kraw)
  total = total + k.seconds
  table.insert(evidence,k)
end
local id = redis.call('XADD',KEYS[2],'MAXLEN','~',ARGV[3],'*',
  'mountName',d.mountName,'combinedProcessingSeconds',string.format('%.3f',total))
redis.call('XADD',KEYS[3],'MAXLEN','~',ARGV[3],id,
  'mountName',d.mountName,'updateId',d.updateId,'deviceStreamEntryId',d.sourceId,
  'deviceProcessingSeconds',string.format('%.3f',d.seconds),
  'kafkaProcessingDetails',cjson.encode(evidence),
  'combinedProcessingSeconds',string.format('%.3f',total),
  'timingScope','successful-attempts; excludes queue waits; shared Kafka send-call durations')
redis.call('HSET',KEYS[1],'complete',id)
return 1
`;

function configure(config = {}, log) {
  const positive = (n, fallback) => Number.isInteger(Number(n)) && Number(n) > 0 ? Number(n) : fallback;
  options = {
    enabled: config.enabled !== false && config.combinedStreamEnabled === true,
    successStreamEnabled: config.kafkaSuccessStreamEnabled !== false,
    ttl: positive(config.combinedTrackingTtlSeconds, 21600),
    maxBuffer: positive(config.bufferMaxEntries, 2000),
    maxLen: positive(config.streamMaxLen, 200000)
  };
  logger = log;
  clearInterval(timer);
  if (options.enabled) {
    timer = setInterval(flush, positive(config.flushIntervalMs, 1000));
    timer.unref();
  }
}

function start(message) {
  if (!options.enabled) return null;
  return { updateId: randomUUID(), mountName: String(message.message?.mountName || ""),
    sourceId: String(message.id), expires: Math.floor(Date.now()/1000) + options.ttl,
    expected: [], clock: performance.now() };
}
function run(state, callback) { return storage.run(state, callback); }
function attach(output) {
  const state = storage.getStore();
  if (!state || output.messageType !== "PERFORMANCE_OUTPUT") return {};
  const part = `kafka:${randomUUID()}`;
  state.expected.push(part);
  return { processingUpdateId: state.updateId, processingPartId: part,
    processingExpiresAt: String(state.expires) };
}
function enqueue(event) {
  if (!options.enabled) return;
  if (buffer.length >= options.maxBuffer) {
    dropped++;
    if (dropped === 1 || dropped % 100 === 0) logger?.warn?.({ dropped }, "Combined timing buffer full; evidence dropped, delivery unaffected");
    return;
  }
  buffer.push(event);
}
function completeDevice(state) {
  if (!state || !state.expected.length) return;
  enqueue({ part: "device", updateId: state.updateId, mountName: state.mountName,
    sourceId: state.sourceId, expires: state.expires, expected: state.expected.slice(),
    seconds: Math.max(0,performance.now()-state.clock)/1000 });
}
function completeKafka(message, timing, acknowledged) {
  const f = message.message || {};
  if (!acknowledged || !timing || !/^[\da-f-]{36}$/.test(f.processingUpdateId || "") ||
      !/^kafka:[\da-f-]{36}$/.test(f.processingPartId || "") ||
      !Number.isFinite(Number(f.processingExpiresAt))) return;
  enqueue({ part: f.processingPartId, updateId: f.processingUpdateId,
    expires: Number(f.processingExpiresAt), sourceId: String(message.id),
    targetConsumer: String(f.targetConsumer),
    seconds: Math.max(0,performance.now()-timing.clock)/1000 });
}
async function flush() {
  if (flushing || !buffer.length) return;
  flushing = true;
  const entries = buffer.splice(0,100);
  try {
    const redis = await require("../infra/redis/redisClient").getRedisClient(logger);
    // Bounded pipeline. No instrumentation writes are awaited by delivery code.
    const pipeline = redis.multi();
    for (const e of entries) pipeline.eval(JOIN, {
      keys: [`dpmdp:timing:combined:${e.updateId}`,STREAM,DETAILS],
      arguments: [JSON.stringify(e),String(e.expires),String(options.maxLen)]
    });
    await pipeline.execAsPipeline();
  } catch (error) {
    dropped += entries.length;
    logger?.warn?.({error:error.message,dropped},"Combined timing evidence unavailable; delivery unaffected");
  } finally { flushing = false; }
}
module.exports = { configure, start, run, attach, completeDevice, completeKafka, flush,
  successStreamEnabled: () => options.successStreamEnabled,
  _test: { JOIN, STREAM, DETAILS, stats: () => ({buffered:buffer.length,dropped}) } };
