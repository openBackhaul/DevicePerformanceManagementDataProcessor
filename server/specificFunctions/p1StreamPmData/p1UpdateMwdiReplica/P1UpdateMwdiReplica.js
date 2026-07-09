const onfAdapter = require("../../../infra/onf/onfAdapter");
const { getParamFromFunction } = require("../../../utils/functionTree");
const { withRetry } = require("../../../utils/retry");
const redisQueue = require("../../../infra/redis/redisStreamQueue");
const ERRORS = require("./ErrorsEnum");

function assertRequest(request) {
  if (!request || typeof request !== "object") {
    throw new Error(ERRORS.MISSING_REQUIRED_INPUT);
  }

  const {
    parameters,
    mwdiEsClient,
    mwdiReplicaEsClient,
    loggingEsClient
  } = request;

  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) {
    throw new Error(ERRORS.MISSING_REQUIRED_INPUT);
  }

  if (!mwdiEsClient || typeof mwdiEsClient !== "object" || Array.isArray(mwdiEsClient)) {
    throw new Error(ERRORS.MISSING_REQUIRED_INPUT);
  }

  if (!mwdiReplicaEsClient || typeof mwdiReplicaEsClient !== "object" || Array.isArray(mwdiReplicaEsClient)) {
    throw new Error(ERRORS.MISSING_REQUIRED_INPUT);
  }

  if (!loggingEsClient || typeof loggingEsClient !== "object" || Array.isArray(loggingEsClient)) {
    throw new Error(ERRORS.MISSING_REQUIRED_INPUT);
  }
}

function parseTimestamp(value) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getSafeLogger(logger) {
  return logger || console;
}

async function run(request) {
  assertRequest(request);

  console.log("Running p1UpdateMwdiReplica ____________");

  const logger = getSafeLogger(request.logger);
  const {
    parameters,
    mwdiEsClient,
    mwdiReplicaEsClient,
    loggingEsClient,
    lastReplicaTime,
    runtimeConfig
  } = request;

  let sourceClient;
  try {
    sourceClient = await onfAdapter.getEsClient(
      false,
      mwdiEsClient.uuid,
      mwdiEsClient,
      logger
    );
  } catch (error) {
    logger.error(
      { error: error.message || error, label: "getEsClient-source" },
      "Failed to create MWDI ES client"
    );
    throw new Error(ERRORS.CONNECTION_MWDI_ES_FAILED);
  }

  let replicaClient;
  try {
    replicaClient = await onfAdapter.getEsClient(
      false,
      mwdiReplicaEsClient.uuid,
      mwdiReplicaEsClient,
      logger
    );
  } catch (error) {
    logger.error(
      { error: error.message || error, label: "getEsClient-replica" },
      "Failed to create MWDI Replica ES client"
    );
    throw new Error(ERRORS.CONNECTION_MWDI_REPLICA_ES_FAILED);
  }

  let loggingClient;
  try {
    loggingClient = await onfAdapter.getEsClient(
      false,
      loggingEsClient.uuid,
      loggingEsClient,
      logger
    );
  } catch (error) {
    logger.error(
      { error: error.message || error, label: "getEsClient-logging" },
      "Failed to create Logging ES client"
    );
    throw new Error(ERRORS.CONNECTION_LOGGING_ES_FAILED);
  }

  const jobName = getParamFromFunction(
    parameters,
    "p1UpdateMwdiReplica",
    "jobName",
    "mwdi-replica-update-job"
  );

  const lastUpdatedField = getParamFromFunction(
    parameters,
    "p1UpdateMwdiReplica",
    "lastUpdatedField",
    "last-complete-control-construct-update-time"
  );

  const overlapMs = Number(
    getParamFromFunction(parameters, "p1UpdateMwdiReplica", "overlapMs", 60000)
  );

  const reqPerSec = Number(
    getParamFromFunction(parameters, "p1UpdateMwdiReplica", "reqPerSec", 2)
  );

  const scrollSize = Number(
    getParamFromFunction(parameters, "p1UpdateMwdiReplica", "scrollSize", 200)
  );

  const scrollTtl =
    String(
      getParamFromFunction(parameters, "p1UpdateMwdiReplica", "scrollTtl", 2)
    ) + "m";

  const now = Date.now();
  const lastTimestamp = lastReplicaTime
    ? parseTimestamp(lastReplicaTime)
    : now - overlapMs;

  if (lastReplicaTime && lastTimestamp === null) {
    throw new Error(ERRORS.INVALID_LAST_REPLICA_TIME);
  }

  const periodStartTime = new Date(lastTimestamp - overlapMs).toISOString();
  const periodEndTime = new Date(now).toISOString();
  console.log("===== REPLICA TIME DEBUG =====");
  console.log("lastReplicaTime:", lastReplicaTime);
  console.log("lastTimestamp:", lastTimestamp);
  console.log("overlapMs:", overlapMs);
  console.log("periodStartTime:", periodStartTime);
  console.log("periodEndTime:", periodEndTime);
  console.log("==============================");

  logger.debug(
    {
      jobName,
      periodStartTime,
      periodEndTime,
      lastReplicaTime,
      overlapMs,
      reqPerSec,
      scrollSize,
      scrollTtl
    },
    "p1UpdateMwdiReplica request details"
  );

  let statusMessage = "SUCCESS";
  let reindexResp;

  try {
    reindexResp = await withRetry(
      async () =>
        sourceClient.reindex({
          refresh: true,
          wait_for_completion: true,
          requests_per_second: reqPerSec,
          scroll: scrollTtl,
          body: {
            source: {
              index: mwdiEsClient["index-alias"],
              size: scrollSize,
              query: {
                bool: {
                  must: [
                    { exists: { field: "core-model-1-4:control-construct.administrative-control" } },
                    {
                      range: {
                        [lastUpdatedField]: {
                          gt: periodStartTime,
                          lte: periodEndTime
                        }
                      }
                    }
                  ]
                }
              }
            },
            dest: {
              index: mwdiReplicaEsClient["index-alias"],
              op_type: "index"
            },
            conflicts: "proceed"
          }
        }),
      {
        label: "p1UpdateMwdiReplica.reindex",
        retryIntervalMs: 10000,
        logger
      }
    );
    console.log("===== REINDEX RESPONSE =====");
    console.dir(reindexResp,{ depth: null });
    console.log("=============================");
  } catch (error) {
    logger.error(
      {
        label: "p1UpdateMwdiReplica.reindex",
        error: error.message || error
      },
      "Reindex failed"
    );

    await loggingClient.index({
      index: loggingEsClient["index-alias"],
      body: {
        jobName,
        periodStartTime,
        periodEndTime,
        status: "FAILED",
        error: String(error.message || error),
        lastReplicaTime: new Date().toISOString(),
        timestamp: new Date().toISOString()
      },
      refresh: false
    }).catch((loggingError) => {
      logger.error(
        {
          label: "p1UpdateMwdiReplica.reindex.logging",
          error: loggingError.message || loggingError
        },
        "Failed to write failure logging document"
      );
    });

    throw new Error(ERRORS.DATA_REPLICATION_FAILED);
  }

  let replicaResponse;
  try {
    replicaResponse = await withRetry(
      async () =>
        replicaClient.search({
          index: mwdiReplicaEsClient["index-alias"],
          scroll: scrollTtl,
          size: scrollSize,
          body: {
            query: {
              bool: {
                must: [
                  { exists: { field: "core-model-1-4:control-construct" } },
                  {
                    range: {
                      [lastUpdatedField]: {
                        gt: periodStartTime,
                        lte: periodEndTime
                      }
                    }
                  }
                ]
              }
            }
          }
        }),
      {
        label: "p1UpdateMwdiReplica.search",
        retryIntervalMs: 10000,
        logger
      }
    );
  } catch (error) {
    logger.error(
      {
        label: "p1UpdateMwdiReplica.search",
        error: error.message || error
      },
      "Failed to search replica after reindex"
    );
  }

  const updatedMountNames = Array.from(
    new Set(
      ((((replicaResponse || {}).body || {}).hits || {}).hits || []).map(
        (hit) => {
          const src = hit._source || {};
          return src.mountName || src["mount-name"] || src.uuid || hit._id;
        }
      )
    )
  ).filter(Boolean);

  try {
    await redisQueue.ensureGroup(logger);
  } catch (error) {
    logger.error(
      {
        label: "p1UpdateMwdiReplica.ensureGroup",
        error: error.message || error
      },
      "Failed to ensure Redis consumer group"
    );

    throw error;
  }

  try {
    await redisQueue.enqueueMountNames(
      updatedMountNames,
      {
        batchSize:
          (((runtimeConfig || {}).redis || {}).enqueueBatchSize) || 500,
        pauseMs:
          (((runtimeConfig || {}).redis || {}).enqueuePauseMs) || 50,
        clearRetryAndDeadLetterBeforeEnqueue: true
      },
      logger
    );
  } catch (error) {
    logger.error(
      {
        label: "p1UpdateMwdiReplica.enqueueMountNames",
        error: error.message || error
      },
      "Failed to enqueue updated mount names"
    );

    throw error;
  }

  const timestamp = periodEndTime;

  try {
    await withRetry(
      async () =>
        loggingClient.index({
          index: loggingEsClient["index-alias"],
          body: {
            jobName,
            periodStartTime,
            periodEndTime,
            replicated: reindexResp?.body?.created ?? 0,
            updated: reindexResp?.body?.updated ?? 0,
            total: reindexResp?.body?.total ?? 0,
            status: statusMessage,
            updatedMountNames,
            lastReplicaTime: new Date().toISOString(),
            timestamp: new Date().toISOString()
          },
          refresh: false
        }),
      {
        label: "p1UpdateMwdiReplica.logging",
        retryIntervalMs: 10000,
        logger
      }
    );
  } catch (error) {
    logger.error(
      {
        label: "p1UpdateMwdiReplica.logging",
        error: error.message || error
      },
      "Failed to index logging document"
    );
  }

  return {
    updatedMountNames,
    timestamp
  };
}

module.exports = { run };
