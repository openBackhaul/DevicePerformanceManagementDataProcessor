const { randomUUID } = require("crypto");

const timeZone = "Europe/Berlin";
const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
const offsetFormatter = new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "longOffset" });
const fields = ["device:updatesPerSec", "kafka:messagesPerSec", "kafka:APT:messagesPerSec",
  "kafka:MYCOM:messagesPerSec", "kafka:NETEXPLORER:messagesPerSec"];

function midnight(year, month, day) {
  const utc = Date.UTC(year, month - 1, day);
  let result = utc;
  for (let i = 0; i < 3; i++) {
    const offset = offsetFormatter.formatToParts(new Date(result)).find(part => part.type === "timeZoneName").value;
    const match = offset.match(/GMT([+-])(\d{2}):(\d{2})/);
    const minutes = match ? (Number(match[2]) * 60 + Number(match[3])) * (match[1] === "+" ? 1 : -1) : 0;
    result = utc - minutes * 60000;
  }
  return result;
}

function dayWindow(now) {
  const parts = Object.fromEntries(dateFormatter.formatToParts(new Date(now)).map(part => [part.type, part.value]));
  const y = Number(parts.year), m = Number(parts.month), d = Number(parts.day);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    start: midnight(y, m, d), end: midnight(y, m, d + 1)
  };
}

// Add only the difference from this process's previously persisted snapshot.
// Retrying after a lost response cannot double-count the same observations.
const persistScript = `
local current = cjson.decode(ARGV[2])
local totals = {}
for i, value in ipairs(current) do
  local checkpoint = ARGV[1] .. ':' .. i
  local previous = tonumber(redis.call('HGET', KEYS[1], checkpoint)) or 0
  if value > previous then
    redis.call('HINCRBY', KEYS[1], 'count:' .. i, value - previous)
    redis.call('HSET', KEYS[1], checkpoint, value)
  end
  totals[i] = tonumber(redis.call('HGET', KEYS[1], 'count:' .. i)) or 0
end
local tracked = tonumber(redis.call('HGET', KEYS[1], 'trackingStartedAtMs'))
if not tracked or tonumber(ARGV[3]) < tracked then tracked = tonumber(ARGV[3]) end
redis.call('HSET', KEYS[1], 'trackingStartedAtMs', tracked, 'date', ARGV[4], 'timezone', 'Europe/Berlin')
local names = cjson.decode(ARGV[6])
for i, name in ipairs(names) do
  local elapsed = totals[7] / 1000
  if i == 1 then elapsed = totals[6] / 1000 end
  local rate = 'unavailable'
  if elapsed > 0 then rate = string.format('%.4f', totals[i] / elapsed) end
  redis.call('HSET', KEYS[1], name, rate)
end
redis.call('HSET', KEYS[1], 'elapsedSeconds', ARGV[5])
redis.call('EXPIRE', KEYS[1], 604800)
table.insert(totals, tracked)
return totals
`;

class DailyPerformanceMetrics {
  constructor() {
    this.processId = randomUUID();
    this.startedAt = Date.now();
    this.days = new Map();
  }

  ensure(now) {
    if (this.current && now >= this.current.start && now < this.current.end) return this.current;
    const window = dayWindow(now);
    if (!this.days.has(window.date)) {
      this.days.set(window.date, { ...window, tracked: Math.max(window.start, this.startedAt), counts: Array(7).fill(0), dirty: true });
    }
    this.current = this.days.get(window.date);
    return this.current;
  }

  record(stage, target, now = Date.now()) {
    const day = this.ensure(now);
    if (stage === "device") day.counts[0]++;
    else {
      day.counts[1]++;
      const index = fields.indexOf(`kafka:${target}:messagesPerSec`);
      if (index >= 2) day.counts[index]++;
    }
    day.dirty = true;
  }

  // Union of stage activity, not the sum of concurrent worker durations.
  addActivity(stage, start, end) {
    for (let cursor = Math.max(start, end - 7 * 86400000); cursor < end;) {
      const day = this.ensure(cursor);
      const until = Math.min(end, day.end);
      day.counts[stage === "device" ? 5 : 6] += until - cursor;
      day.dirty = true;
      cursor = until;
    }
  }

  async summary(logger, now = Date.now()) {
    const { getRedisClient } = require("../infra/redis/redisClient");
    const redis = await getRedisClient(logger);
    const current = this.ensure(now);
    let result;
    for (const [date, day] of this.days) {
      // Bound local retention even if Redis has been unavailable for days.
      if (day.end < now - 7 * 86400000) { this.days.delete(date); continue; }
      const counts = [...day.counts];
      const saved = await redis.eval(persistScript, {
        keys: [`dpmdp:hash:performance-daily-active-v2:${date}`],
        arguments: [this.processId, JSON.stringify(counts), String(day.tracked), date,
          String(Math.max(0, (Math.min(now, day.end) - day.start) / 1000)), JSON.stringify(fields)]
      });
      day.dirty = counts.some((value, index) => value !== day.counts[index]);
      if (day === current) result = saved;
      else if (!day.dirty) this.days.delete(date);
    }
    const seconds = Math.max(0, (now - current.start) / 1000);
    return {
      ...Object.fromEntries(fields.map((field, index) => {
        const activeSeconds = Number(result[index === 0 ? 5 : 6]) / 1000;
        return [field.replace(":", ":daily:"), activeSeconds ? (Number(result[index]) / activeSeconds).toFixed(4) : "unavailable"];
      })),
      dailyDeviceActiveSeconds: String(Number(result[5]) / 1000),
      dailyKafkaActiveSeconds: String(Number(result[6]) / 1000),
      dailyDate: current.date,
      dailyTimezone: timeZone,
      dailyElapsedSeconds: seconds.toFixed(0),
      dailyTrackingStartedAt: new Date(Number(result[7])).toISOString(),
      dailyCoverage: "monitored-time-only; excludes-process-downtime"
    };
  }
}

module.exports = { DailyPerformanceMetrics, dayWindow, persistScript };
