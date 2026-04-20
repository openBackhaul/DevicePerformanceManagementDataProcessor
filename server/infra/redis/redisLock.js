const crypto = require("crypto");
const { getRedisClient } = require("./redisClient");

async function acquireLock(lockKey, ttlMs, logger) {
  const redis = await getRedisClient(logger);
  const token = crypto.randomUUID();
  const result = await redis.set(lockKey, token, { NX: true, PX: ttlMs });
  return result === "OK" ? token : null;
}

async function renewLock(lockKey, token, ttlMs, logger) {
  const redis = await getRedisClient(logger);
  const current = await redis.get(lockKey);

  if (current !== token) return false;

  const result = await redis.set(lockKey, token, { XX: true, PX: ttlMs });
  return result === "OK";
}

async function releaseLock(lockKey, token, logger) {
  const redis = await getRedisClient(logger);
  const current = await redis.get(lockKey);

  if (current === token) {
    await redis.del(lockKey);
  }
}

module.exports = { acquireLock, renewLock, releaseLock };