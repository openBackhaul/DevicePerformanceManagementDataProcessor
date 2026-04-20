const { createClient } = require("redis");

let client;

function buildRedisUrl() {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  if (process.env.REDIS_URLS) {
    const first = process.env.REDIS_URLS
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)[0];

    if (first) {
      return first;
    }
  }

  return "redis://127.0.0.1:6379";
}

async function getRedisClient(logger) {
  if (client && client.isOpen) {
    return client;
  }

  client = createClient({
    url: buildRedisUrl(),
    socket: {
      reconnectStrategy(retries) {
        const base = Number(process.env.REDIS_RECONNECT_BASE_MS || 250);
        const max = Number(process.env.REDIS_RECONNECT_MAX_MS || 5000);
        return Math.min(base * Math.max(1, retries), max);
      }
    }
  });

  client.on("error", (error) => {
    (logger || console).error({ error }, "Redis client error");
  });

  client.on("reconnecting", () => {
    (logger || console).warn("Redis reconnecting");
  });

  await client.connect();
  return client;
}

module.exports = { getRedisClient };