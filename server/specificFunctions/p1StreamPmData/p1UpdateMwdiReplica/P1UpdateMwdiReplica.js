const onfAdapter = require("../../../infra/onf/onfAdapter");
const { getParamFromFunction } = require("../../../utils/functionTree");
const { sleep, withRetry } = require("../../../utils/retry");
const redisQueue = require("../../../infra/redis/redisStreamQueue");
const { getRedisClient } = require("../../../infra/redis/redisClient");
const { saveLastReplicaTime } = require("../../../core/replicaStateStore");
const ERRORS = require("./ErrorsEnum");

const ACTIVE_REINDEX_TASK_KEY = "dpmdp:replica:active-reindex-task";

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

function isTaskNotFoundError(error) {
  const statusCode = error?.meta?.statusCode || error?.statusCode;
  const message = String(error?.message || error || "");
  return statusCode === 404 || message.includes("resource_not_found_exception");
}

async function waitForReindexTask(sourceClient, activeTask, pollIntervalMs, logger) {
  const taskId = activeTask.taskId;

  while (true) {
    let taskResult;
    try {
      if (activeTask.discovered) {
        taskResult = await sourceClient.tasks.get({ task_id: taskId });
      } else {
        taskResult = await withRetry(
          async () => {
            try {
              return await sourceClient.tasks.get({ task_id: taskId });
            } catch (error) {
              if (isTaskNotFoundError(error)) {
                return { body: { recoveredCompletion: true } };
              }
              throw error;
            }
          },
          {
            label: "p1UpdateMwdiReplica.reindexTask",
            retryIntervalMs: 10000,
            maxAttempts: 3,
            logger
          }
        );
      }
    } catch (error) {
      if (isTaskNotFoundError(error)) {
        logger.warn?.(
          {
            label: "p1UpdateMwdiReplica.reindexTask.recoveredCompletion",
            taskId,
            discovered: activeTask.discovered === true
          },
          "Saved reindex task is no longer present; continuing idempotent post-reindex recovery"
        );
        return { body: { recoveredCompletion: true } };
      }

      throw error;
    }

    const taskBody = taskResult?.body || taskResult;
    if (taskBody.recoveredCompletion === true) {
      logger.warn?.(
        {
          label: "p1UpdateMwdiReplica.reindexTask.recoveredCompletion",
          taskId,
          discovered: false
        },
        "Saved reindex task is no longer present; continuing idempotent post-reindex recovery"
      );
      return { body: taskBody };
    }
    const status = taskBody.task?.status || taskBody.status || {};

    logger.debug?.(
      {
        label: "p1UpdateMwdiReplica.reindexTask.progress",
        taskId,
        total: status.total || taskBody.response?.total || 0,
        processed:
          (status.created || 0) +
          (status.updated || 0) +
          (status.deleted || 0),
        batches: status.batches || 0,
        completed: taskBody.completed === true
      },
      "Reindex task progress"
    );

    if (taskBody.completed) {
      if (taskBody.error) {
        const error = new Error(taskBody.error.reason || JSON.stringify(taskBody.error));
        error.reindexTaskTerminal = true;
        throw error;
      }

      return { body: taskBody.response || {} };
    }

    await sleep(pollIntervalMs);
  }
}

async function loadActiveReindexTask(logger) {
  const redis = await getRedisClient(logger);
  const value = await redis.get(ACTIVE_REINDEX_TASK_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    await redis.del(ACTIVE_REINDEX_TASK_KEY);
    return null;
  }
}

async function saveActiveReindexTask(task, logger) {
  const redis = await getRedisClient(logger);
  await redis.set(ACTIVE_REINDEX_TASK_KEY, JSON.stringify(task));
}

async function clearActiveReindexTask(logger) {
  const redis = await getRedisClient(logger);
  await redis.del(ACTIVE_REINDEX_TASK_KEY);
}

async function discoverRunningReindexTask(
  sourceClient,
  sourceIndex,
  destinationIndex,
  periodStartTime,
  logger
) {
  const result = await sourceClient.tasks.list({
    actions: "indices:data/write/reindex",
    detailed: true
  });
  const nodes = (result?.body || result || {}).nodes || {};
  const matches = [];

  for (const node of Object.values(nodes)) {
    for (const [taskId, task] of Object.entries(node.tasks || {})) {
      const description = String(task.description || "");
      if (
        description.includes(`from [${sourceIndex}]`) &&
        description.includes(`to [${destinationIndex}]`)
      ) {
        matches.push({ taskId, task });
      }
    }
  }

  if (matches.length === 0) {
    return null;
  }

  matches.sort(
    (left, right) =>
      Number(left.task.start_time_in_millis || 0) -
      Number(right.task.start_time_in_millis || 0)
  );

  if (matches.length > 1) {
    logger.warn?.(
      {
        label: "p1UpdateMwdiReplica.reindex.duplicates",
        taskIds: matches.map((match) => match.taskId)
      },
      "Multiple matching reindex tasks are already running; resuming the oldest"
    );
  }

  const selected = matches[0];
  const startedAt = Number(selected.task.start_time_in_millis || Date.now());

  return {
    taskId: selected.taskId,
    sourceIndex,
    destinationIndex,
    periodStartTime,
    periodEndTime: new Date(startedAt).toISOString(),
    createdAt: new Date(startedAt).toISOString(),
    discovered: true
  };
}

function getMountName(hit) {
  const source = hit?._source || {};
  return source.mountName || source["mount-name"] || source.uuid || hit?._id;
}

async function loadUpdatedMountNames(
  replicaClient,
  index,
  lastUpdatedField,
  periodStartTime,
  periodEndTime,
  scrollSize,
  scrollTtl,
  logger
) {
  const mountNames = new Set();
  let scrollId;

  try {
    let response = await withRetry(
      async () =>
        replicaClient.search({
          index,
          scroll: scrollTtl,
          size: scrollSize,
          body: {
            // MWDI stores the mountName as the document _id. Avoid loading and
            // decompressing the multi-megabyte ControlConstruct source merely
            // to discover the changed device identifier.
            _source: false,
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

    while (response) {
      const body = response.body || response;
      const hits = body.hits?.hits || [];
      scrollId = body._scroll_id || scrollId;

      for (const hit of hits) {
        const mountName = getMountName(hit);
        if (mountName) {
          mountNames.add(mountName);
        }
      }

      if (hits.length === 0 || !scrollId) {
        break;
      }

      response = await withRetry(
        async () => replicaClient.scroll({ scroll_id: scrollId, scroll: scrollTtl }),
        {
          label: "p1UpdateMwdiReplica.scroll",
          retryIntervalMs: 10000,
          logger
        }
      );
    }
  } finally {
    if (scrollId && replicaClient.clearScroll) {
      await replicaClient.clearScroll({ scroll_id: scrollId }).catch((error) => {
        logger.warn?.(
          { label: "p1UpdateMwdiReplica.clearScroll", error: error.message || error },
          "Failed to clear replica search scroll"
        );
      });
    }
  }

  return Array.from(mountNames);
}

async function run(request) {
  assertRequest(request);

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

  const reindexPollIntervalMs = Number(
    getParamFromFunction(
      parameters,
      "p1UpdateMwdiReplica",
      "reindexPollIntervalMs",
      10000
    )
  );

  const now = Date.now();
  const lastTimestamp = lastReplicaTime
    ? parseTimestamp(lastReplicaTime)
    : now - overlapMs;

  if (lastReplicaTime && lastTimestamp === null) {
    throw new Error(ERRORS.INVALID_LAST_REPLICA_TIME);
  }

  let periodStartTime = new Date(lastTimestamp - overlapMs).toISOString();
  let periodEndTime = new Date(now).toISOString();

  logger.debug(
    {
      jobName,
      periodStartTime,
      periodEndTime,
      lastReplicaTime,
      overlapMs,
      reqPerSec,
      scrollSize,
      scrollTtl,
      reindexPollIntervalMs
    },
    "p1UpdateMwdiReplica request details"
  );

  let statusMessage = "SUCCESS";
  let reindexResp;
  let activeTask;

  try {
    activeTask = await loadActiveReindexTask(logger);

    if (!activeTask) {
      activeTask = await discoverRunningReindexTask(
        sourceClient,
        mwdiEsClient["index-alias"],
        mwdiReplicaEsClient["index-alias"],
        periodStartTime,
        logger
      );

      if (activeTask) {
        await saveActiveReindexTask(activeTask, logger);
      }
    }

    if (activeTask) {
      if (
        activeTask.sourceIndex !== mwdiEsClient["index-alias"] ||
        activeTask.destinationIndex !== mwdiReplicaEsClient["index-alias"]
      ) {
        throw new Error("Stored reindex task belongs to different Elasticsearch indices");
      }

      periodStartTime = activeTask.periodStartTime;
      periodEndTime = activeTask.periodEndTime;
      logger.info?.(
        { label: "p1UpdateMwdiReplica.reindex.resume", taskId: activeTask.taskId },
        "Resuming existing reindex task"
      );
    } else {
      const reindexTask = await withRetry(
        async () =>
          sourceClient.reindex({
            refresh: true,
            wait_for_completion: false,
            requests_per_second: reqPerSec,
            scroll: scrollTtl,
            body: {
              source: {
                index: mwdiEsClient["index-alias"],
                size: scrollSize,
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

      const taskId = reindexTask?.body?.task || reindexTask?.task;
      if (!taskId) {
        throw new Error("Elasticsearch did not return a reindex task id");
      }

      activeTask = {
        taskId,
        sourceIndex: mwdiEsClient["index-alias"],
        destinationIndex: mwdiReplicaEsClient["index-alias"],
        periodStartTime,
        periodEndTime,
        createdAt: new Date().toISOString()
      };
      await saveActiveReindexTask(activeTask, logger);

      logger.info?.(
        { label: "p1UpdateMwdiReplica.reindex.started", taskId },
        "Started reindex task"
      );
    }

    reindexResp = await waitForReindexTask(
      sourceClient,
      activeTask,
      reindexPollIntervalMs,
      logger
    );
  } catch (error) {
    if (error.reindexTaskTerminal) {
      await clearActiveReindexTask(logger).catch(() => {});
    }

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

  let updatedMountNames;
  const changedDeviceSearchStartedAt = Date.now();
  try {
    updatedMountNames = await loadUpdatedMountNames(
      replicaClient,
      mwdiReplicaEsClient["index-alias"],
      lastUpdatedField,
      periodStartTime,
      periodEndTime,
      scrollSize,
      scrollTtl,
      logger
    );
    logger.info?.(
      {
        label: "p1UpdateMwdiReplica.changedDevices.loaded",
        mountNameCount: updatedMountNames.length,
        durationMs: Date.now() - changedDeviceSearchStartedAt
      },
      "Loaded changed device identifiers from replica"
    );
  } catch (error) {
    logger.error(
      {
        label: "p1UpdateMwdiReplica.search",
        error: error.message || error
      },
      "Failed to search replica after reindex"
    );
    throw error;
  }

  try {
    await redisQueue.ensureGroup(logger);
    await redisQueue.clearRetryAndDeadLetterForReplicaUpdates(
      updatedMountNames,
      logger
    );
  } catch (error) {
    logger.error(
      {
        label: "p1UpdateMwdiReplica.ensureGroup",
        error: error.message || error
      },
      "Failed to prepare Redis state for replica update"
    );

    throw error;
  }

  try {
    const enqueueStartedAt = Date.now();
    const enqueueResult = await redisQueue.enqueueMountNames(
      updatedMountNames,
      {
        batchSize:
          (((runtimeConfig || {}).redis || {}).enqueueBatchSize) || 500,
        pauseMs:
          (((runtimeConfig || {}).redis || {}).enqueuePauseMs) || 50,
        clearRetryAndDeadLetterBeforeEnqueue: false
      },
      logger
    );
    logger.info?.(
      {
        label: "p1UpdateMwdiReplica.enqueueMountNames.completed",
        ...enqueueResult,
        durationMs: Date.now() - enqueueStartedAt
      },
      "Completed batched enqueue of replica updates"
    );
    if (enqueueResult.failed > 0) {
      throw new Error(`Failed to enqueue ${enqueueResult.failed} changed devices`);
    }
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
            updatedMountNameCount: updatedMountNames.length,
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

  await saveLastReplicaTime(loggingEsClient, timestamp, logger);
  await clearActiveReindexTask(logger);
  logger.info?.(
    { label: "p1UpdateMwdiReplica.completed", timestamp, updatedMountNameCount: updatedMountNames.length },
    "Replica cycle checkpoint saved and active task cleared"
  );

  return {
    updatedMountNames,
    timestamp
  };
}

module.exports = { run };
