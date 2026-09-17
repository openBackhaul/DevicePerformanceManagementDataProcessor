const { getRedisClient } = require("../infra/redis/redisClient");
const onfAdapter = require("../infra/onf/onfAdapter");
const { withRetry } = require("../utils/retry");

const REDIS_KEY = "dpmdp:lastReplicaTime";
const ES_DOC_ID = "dpmdp-last-replica-state";

async function loadLastReplicaTimeFromRedis(logger) {
  const redis = await getRedisClient(logger);
  const value = await redis.get(REDIS_KEY);
  return value || null;
}

async function saveLastReplicaTimeToRedis(timestamp, logger) {
  const redis = await getRedisClient(logger);
  await redis.set(REDIS_KEY, timestamp);
}

async function loadLastReplicaTimeFromEs(loggingEsClient, logger) {
  const client = await onfAdapter.getEsClient(
    false,
    loggingEsClient.uuid,
    loggingEsClient,
    logger
  );

  const response = await withRetry(
    async () =>
      client.get(
        {
          index: loggingEsClient["index-alias"],
          id: ES_DOC_ID
        },
        { ignore: [404] }
      ),
    {
      label: "replicaState.loadFromEs",
      retryIntervalMs: 10000,
      logger
    }
  ).catch((error) => {
    const statusCode = error?.meta?.statusCode || error?.statusCode;
    if (statusCode === 404) {
      return null;
    }

    logger.error(
        {
          label: "replicaState.loadFromEs",
          error: error.message || error
        },
        "Failed to load last replica time from Elasticsearch"
      );
    });

  const responseBody = response?.body || response;
  if (!responseBody || !responseBody.found) {
    return null;
  }

  const source = responseBody._source || {};
  return source.lastReplicaTime || null;
}

async function saveLastReplicaTimeToEs(loggingEsClient, timestamp, logger) {
  const client = await onfAdapter.getEsClient(
    false,
    loggingEsClient.uuid,
    loggingEsClient,
    logger
  );

  await withRetry(
    async () =>
      client.index({
        index: loggingEsClient["index-alias"],
        id: ES_DOC_ID,
        body: {
          docType: "replica-state",
          lastReplicaTime: timestamp,
          updatedAt: new Date().toISOString()
        },
        refresh: true
      }),
    {
      label: "replicaState.saveToEs",
      retryIntervalMs: 10000,
      logger
    }
  ).catch((error) => {
      logger.error(
        {
          label: "replicaState.saveToEs",
          error: error.message || error
        },
        "Failed to save last replica time to Elasticsearch"
      );
    });
}

async function loadLastReplicaTime(loggingEsClient, logger) {
  const redisValue = await loadLastReplicaTimeFromRedis(logger).catch(() => null);
  if (redisValue) {
    return redisValue;
  }

  const esValue = await loadLastReplicaTimeFromEs(loggingEsClient, logger).catch(() => null);
  if (esValue) {
    return esValue;
  }

  // No persisted checkpoint means a genuine first start. Let the replica
  // function apply its bounded initial lookback instead of requesting the
  // complete MWDI history from an epoch timestamp.
  return null;
}

async function saveLastReplicaTime(loggingEsClient, timestamp, logger) {
  await saveLastReplicaTimeToRedis(timestamp, logger).catch((error) => {
      logger.error(
        {
          label: "save-last-replica-time-to-redis",
          error: error.message || error
        },
        "Failed to save last replica time to Redis"
      );
    });
  await saveLastReplicaTimeToEs(loggingEsClient, timestamp, logger).catch((error) => {
      logger.error(
        {
          label: "save-last-replica-time-to-es",
          error: error.message || error
        },
        "Failed to save last replica time to Elasticsearch"
      );
    });
}

module.exports = {
  loadLastReplicaTime,
  saveLastReplicaTime
};
