const onfAdapter = require("../../../infra/onf/onfAdapter");
const { getParamFromFunction } = require("../../../utils/functionTree");
const { withRetry } = require("../../../utils/retry");
const redisQueue = require("../../../infra/redis/redisStreamQueue");

/**
 * Request:
 * {
 *   parameters,
 *   mwdiEsClient,
 *   mwdiReplicaEsClient,
 *   loggingEsClient,
 *   lastReplicaTime,
 *   runtimeConfig,
 *   logger
 * }
 *
 * Response:
 * {
 *   updatedMountNames: [],
 *   timestamp: "..."
 * }
 */
async function run(request) {
  const {
    parameters,
    mwdiEsClient,
    mwdiReplicaEsClient,
    loggingEsClient,
    lastReplicaTime,
    runtimeConfig,
    logger
  } = request;

  if (!parameters || !mwdiEsClient || !mwdiReplicaEsClient || !loggingEsClient) {
    throw new Error(
      "parameters, mwdiEsClient, mwdiReplicaEsClient and loggingEsClient are mandatory"
    );
  }

  const sourceClient = await onfAdapter.getEsClient(
    false,
    mwdiEsClient.uuid,
    mwdiEsClient,
    logger
  );

  const replicaClient = await onfAdapter.getEsClient(
    false,
    mwdiReplicaEsClient.uuid,
    mwdiReplicaEsClient,
    logger
  );

  const loggingClient = await onfAdapter.getEsClient(
    false,
    loggingEsClient.uuid,
    loggingEsClient,
    logger
  );

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
    ? new Date(lastReplicaTime).getTime()
    : now - overlapMs;

  const periodStartTime = new Date(lastTimestamp - overlapMs).toJSON();
  const periodEndTime = new Date(now).toJSON();

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
              /* query: {
                range: {
                  [lastUpdatedField]: {
                    gt: periodStartTime,
                    lte: periodEndTime
                  }
                }
              } */
              query: {
                bool: {
                  must: [
                    { exists: { field: "core-model-1-4:control-construct" }},
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
  } catch (error) {
    statusMessage = String(error.message || error);
    await loggingClient.index({
      index: loggingEsClient["index-alias"],
      document: { jobName, periodStartTime, periodEndTime, status: "FAILED", error: String(err), lastReplicaTime: new Date().toJSON(), "timestamp": new Date().toJSON() },
    }).catch(() => {});
  }

  /* await sourceClient.indices.refresh({
    index: mwdiReplicaEsClient["index-alias"]
  }); */

  const replicaResponse = await withRetry(
      async () =>
       replicaClient.search({
          index: mwdiReplicaEsClient["index-alias"],
          scroll: scrollTtl,
          size: scrollSize,
          body: {
            query: {
              bool: {
                must: [
                  { exists: { field: "core-model-1-4:control-construct" }},
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
  ).catch((error) => {
      logger.error(
        {
          label: "search-replica-after-reindex",
          error: error.message || error
        },
        "Failed to search replica after reindex"
      );
    });//({ hits: { hits: [] } }));

  const updatedMountNames = ((((replicaResponse || {}).body.hits || {}).hits || []))
    .map((hit) => {
      const src = hit._source || {};
      return src.mountName || src["mount-name"] || src.uuid || hit._id;
    })
    .filter(Boolean);

  await redisQueue.ensureGroup(logger);
  await redisQueue.enqueueMountNames(
    updatedMountNames,
    {
      batchSize: (((runtimeConfig || {}).redis || {}).enqueueBatchSize) || 500,
      pauseMs: (((runtimeConfig || {}).redis || {}).enqueuePauseMs) || 50
    },
    logger
  );

  const timestamp = periodEndTime;

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
                lastReplicaTime: new Date().toJSON(),
                "timestamp": new Date().toJSON()
              },
              refresh: false
          }),
        {
            label: "p1UpdateMwdiReplica.logging",
            retryIntervalMs: 10000,
            logger
        }
    ).catch((error) => {
      logger.error(
        {
          label: "logging-client-index",
          error: error.message || error
        },
        "Failed to index logging document"
      );
    });

  return {
    updatedMountNames,
    timestamp
  };
}

module.exports = { run };