const crypto = require("crypto");
const { getRedisClient } = require("./redisClient");
const logger = require('../../service/LoggingService.js').getLogger();

async function acquireLock(lockKey, ttlMs, loggers) {
  const redis = await getRedisClient(logger);
  const token = crypto.randomUUID();
  const result = await redis.set(lockKey, token, { NX: true, PX: ttlMs });
  return result === "OK" ? token : null;
}

async function renewLock(lockKey, token, ttlMs, loggers) {
  const redis = await getRedisClient(logger);
  const result = await redis.eval(
    "if redis.call('GET', KEYS[1]) == ARGV[1] then " +
      "return redis.call('PEXPIRE', KEYS[1], ARGV[2]) else return 0 end",
    {
      keys: [lockKey],
      arguments: [token, String(ttlMs)]
    }
  );
  return result === 1;
}

async function releaseLock(lockKey, token, loggers) {
  const redis = await getRedisClient(logger);
  const result = await redis.eval(
    "if redis.call('GET', KEYS[1]) == ARGV[1] then " +
      "return redis.call('DEL', KEYS[1]) else return 0 end",
    {
      keys: [lockKey],
      arguments: [token]
    }
  );
  return result === 1;
}

module.exports = { acquireLock, renewLock, releaseLock };
