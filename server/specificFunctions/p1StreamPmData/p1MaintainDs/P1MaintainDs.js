const onfAdapter = require("../../../infra/onf/onfAdapter");
const { getParamFromFunction } = require("../../../utils/functionTree");
const { sleep, withRetry } = require("../../../utils/retry");
const ERRORS = require("./ErrorsEnum");
const logger = require('../../../service/LoggingService.js').getLogger();

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/* function getSafeLogger(logger) {
  return logger || console;
} */

function getRequestValue(request, ...keys) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return undefined;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(request, key)) {
      return request[key];
    }
  }

  return undefined;
}

function buildProcessingError(message, cause) {
  const error = new Error(message);

  error.stage = "p1MaintainDs";

  if (cause) {
    error.cause = cause;
  }

  return error;
}

function getValidatedRequest(request) {
  const parameters = getRequestValue(request, "parameters");

  if (parameters === undefined || parameters === null) {
    throw buildProcessingError(ERRORS.PARAMETERS_NOT_PROVIDED);
  }

  if (!isPlainObject(parameters)) {
    throw buildProcessingError(ERRORS.PARAMETERS_INVALID);
  }

  const dataStoreEsClient = getRequestValue(
    request,
    "dataStoreEsClient",
    "data-store-es-client"
  );

  if (dataStoreEsClient === undefined || dataStoreEsClient === null) {
    throw buildProcessingError(ERRORS.DATA_STORE_ES_CLIENT_NOT_PROVIDED);
  }

  if (
    !isPlainObject(dataStoreEsClient) ||
    !dataStoreEsClient.uuid ||
    !dataStoreEsClient["index-alias"]
  ) {
    throw buildProcessingError(ERRORS.DATA_STORE_ES_CLIENT_INVALID);
  }

  return {
    parameters,
    dataStoreEsClient,
    loggingEsClient: getRequestValue(
      request,
      "loggingEsClient",
      "logging-es-client"
    )
  };
}

function validatePeriodHours(value, errorMessage) {
  const hours = Number(value);

  if (!Number.isFinite(hours) || hours < 0) {
    throw buildProcessingError(errorMessage);
  }

  return hours;
}

async function getLoggingClient(loggingEsClient, logger) {
  return await onfAdapter.getEsClient(
    false,
    loggingEsClient.uuid,
    loggingEsClient,
    logger
  );
}

async function tryGetLoggingClient(loggingEsClient, logger) {
  if (!loggingEsClient) {
    return null;
  }

  if (
    !isPlainObject(loggingEsClient) ||
    !loggingEsClient.uuid ||
    !loggingEsClient["index-alias"]
  ) {
    logger.error?.(
      {
        label: "p1MaintainDs.loggingClientInvalid"
      },
      "Skipping logging data cleanup because loggingEsClient is invalid"
    );
    return null;
  }

  try {
    return await getLoggingClient(loggingEsClient, logger);
  } catch (error) {
    logger.error?.(
      {
        label: "p1MaintainDs.getLoggingClient",
        error: error.message || error
      },
      "Skipping logging data cleanup because logging ES client could not be initialized"
    );
    return null;
  }
}

async function deleteOldLoggingDocuments(loggingClient, loggingEsClient, cutoffIso, logger) {
  const response = await withRetry(
    async () =>
      loggingClient.deleteByQuery({
        index: loggingEsClient["index-alias"],
        refresh: true,
        conflicts: "proceed",
        body: {
          query: {
            bool: {
              must: [
                {
                  range: {
                    timestamp: {
                      lt: cutoffIso
                    }
                  }
                }
              ],
              must_not: [
                {
                  term: {
                    docType: "replica-state"
                  }
                }
              ]
            }
          }
        }
      }),
    {
      label: "p1MaintainDs.deleteOldLoggingDocuments",
      retryIntervalMs: 10000,
      logger
    }
  ).catch((error) => {
    logger.error?.(
      {
        label: "p1MaintainDs: delete-old-logging-documents",
        error: error.message || error
      },
      "Failed to delete old logging documents"
    );
    return null;
  });

  return response && response.body ? response.body.deleted || 0 : 0;
}

async function deleteOldLoggingDocumentsFallback(loggingClient, loggingEsClient, cutoffIso, logger) {
  const response = await withRetry(
    async () =>
      loggingClient.search({
        index: loggingEsClient["index-alias"],
        size: 1000,
        body: {
          query: {
            bool: {
              must: [
                {
                  range: {
                    timestamp: {
                      lt: cutoffIso
                    }
                  }
                }
              ],
              must_not: [
                {
                  term: {
                    docType: "replica-state"
                  }
                }
              ]
            }
          }
        }
      }),
    {
      label: "p1MaintainDs.searchOldLoggingDocuments",
      retryIntervalMs: 10000,
      logger
    }
  ).catch((error) => {
    logger.error?.(
      {
        label: "p1MaintainDs: search-old-logging-documents",
        error: error.message || error
      },
      "Failed to search old logging documents"
    );
    return null;
  });

  let deletedCount = 0;

  for (const hit of (((response || {}).body?.hits || {}).hits || [])) {
    await withRetry(
      async () =>
        loggingClient.delete({
          index: loggingEsClient["index-alias"],
          id: hit._id,
          refresh: false
        }),
      {
        label: `p1MaintainDs.deleteLoggingDoc:${hit._id}`,
        retryIntervalMs: 10000,
        logger
      }
    ).then(() => {
      deletedCount += 1;
    }).catch((error) => {
      logger.error?.(
        {
          label: "p1MaintainDs: delete-single-logging-document",
          id: hit._id,
          error: error.message || error
        },
        "Failed to delete single logging document"
      );
    });
  }

  return deletedCount;
}

function timestampToMillis(timestamp) {
  if (!timestamp) {
    return null;
  }

  const millis = new Date(timestamp).getTime();
  return Number.isNaN(millis) ? null : millis;
}

function shouldDeleteDataStoreDocument(source, filteredBatch, cutoff) {
  if (source.locked === true || filteredBatch.length > 0) {
    return false;
  }

  const timestampMillis = timestampToMillis(
    source.timestamp || source.batchTimestamp || source["batch-timestamp"]
  );

  return timestampMillis === null || timestampMillis < cutoff;
}

async function deleteDataStoreDocument(client, dataStoreEsClient, hit, mountName, logger) {
  const deleted = await withRetry(
    async () =>
      client.delete({
        index: dataStoreEsClient["index-alias"],
        id: hit._id,
        refresh: false
      }),
    {
      label: `p1MaintainDs.deleteEmpty:${mountName}`,
      retryIntervalMs: 10000,
      logger
    }
  ).then(() => true).catch((error) => {
    logger.error?.(
      {
        label: "p1MaintainDs: delete-empty-data-store-document",
        mountName,
        error: error.message || error
      },
      "Failed to delete empty data store document"
    );
    throw buildProcessingError(ERRORS.ELASTICSEARCH_WRITE_ERROR, error);
  });

  return deleted;
}

function getTaskBody(response) {
  return (response || {}).body || response || {};
}

async function waitForCleanupTask(client, taskId, pollIntervalMs, logger) {
  while (true) {
    const taskResponse = await withRetry(
      async () => client.tasks.get({ task_id: taskId }),
      {
        label: `p1MaintainDs.task:${taskId}`,
        retryIntervalMs: 10000,
        logger
      }
    );
    const taskBody = getTaskBody(taskResponse);

    if (taskBody.completed === true) {
      if (taskBody.error) {
        throw new Error(taskBody.error.reason || JSON.stringify(taskBody.error));
      }
      return taskBody.response || {};
    }

    await sleep(pollIntervalMs);
  }
}

async function cleanDataStoreOnServer(
  client,
  dataStoreEsClient,
  cutoff,
  options,
  logger
) {
  const scriptSource = [
    "def existing = ctx._source.batch;",
    "if (existing == null) { existing = new ArrayList(); }",
    "def retained = new ArrayList();",
    "for (def entry : existing) {",
    "  def timestamp = null;",
    "  if (entry != null && entry.containsKey('batchTimestamp')) { timestamp = entry.batchTimestamp; }",
    "  else if (entry != null && entry.containsKey('timestamp')) { timestamp = entry.timestamp; }",
    "  if (timestamp == null) { retained.add(entry); continue; }",
    "  try {",
    "    if (ZonedDateTime.parse(timestamp).toInstant().toEpochMilli() >= params.cutoffMillis) { retained.add(entry); }",
    "  } catch (Exception ignored) { retained.add(entry); }",
    "}",
    "boolean batchChanged = retained.size() != existing.size();",
    "if (retained.isEmpty()) {",
    "  def documentTimestamp = ctx._source.timestamp;",
    "  boolean deleteDocument = documentTimestamp == null;",
    "  if (!deleteDocument) {",
    "    try { deleteDocument = ZonedDateTime.parse(documentTimestamp).toInstant().toEpochMilli() < params.cutoffMillis; }",
    "    catch (Exception ignored) { deleteDocument = true; }",
    "  }",
    "  if (deleteDocument) { ctx.op = 'delete'; return; }",
    "}",
    "if (!batchChanged) { ctx.op = 'noop'; return; }",
    "ctx._source.batch = retained;",
    "ctx._source.locked = false;"
  ].join(" ");

  const startResponse = await withRetry(
    async () => client.updateByQuery({
      index: dataStoreEsClient["index-alias"],
      conflicts: "proceed",
      refresh: false,
      wait_for_completion: false,
      requests_per_second: options.requestsPerSecond,
      scroll_size: options.scrollSize,
      body: {
        query: {
          bool: {
            must_not: [
              { term: { "docType.keyword": "kafka-outbound-payload" } }
            ]
          }
        },
        script: {
          lang: "painless",
          source: scriptSource,
          params: { cutoffMillis: cutoff }
        }
      }
    }),
    {
      label: "p1MaintainDs.updateByQuery",
      retryIntervalMs: 10000,
      logger
    }
  );

  const startBody = getTaskBody(startResponse);
  if (startBody.task) {
    return waitForCleanupTask(
      client,
      startBody.task,
      options.taskPollIntervalMs,
      logger
    );
  }

  return startBody;
}

async function deleteFailedKafkaPayloads(client, dataStoreEsClient, options, logger) {
  const response = await withRetry(
    async () => client.deleteByQuery({
      index: dataStoreEsClient["index-alias"],
      conflicts: "proceed",
      refresh: false,
      wait_for_completion: false,
      requests_per_second: options.requestsPerSecond,
      scroll_size: options.scrollSize,
      body: {
        query: {
          bool: {
            filter: [
              { term: { "docType.keyword": "kafka-outbound-payload" } }
            ],
            should: [
              { term: { "deliveryState.keyword": "permanent-failure" } },
              { term: { "deliveryState.keyword": "oversized-evidence" } }
            ],
            minimum_should_match: 1
          }
        }
      }
    }),
    {
      label: "p1MaintainDs.deleteFailedKafkaPayloads",
      retryIntervalMs: 10000,
      logger
    }
  );

  const body = getTaskBody(response);
  if (body.task) {
    const completed = await waitForCleanupTask(
      client,
      body.task,
      options.taskPollIntervalMs,
      logger
    );
    return Number(completed.deleted || 0);
  }
  return Number(body.deleted || 0);
}
/**
 * Request:
 * {
 *   parameters,
 *   dataStoreEsClient
 * }
 *
 * Response:
 * {
 *   cleanupSummary
 * }
 */
async function run(request) {
  //const logger = getSafeLogger(logger);

  try {
    const {
      parameters,
      dataStoreEsClient,
      loggingEsClient
    } = getValidatedRequest(request);

    const cleanupPeriodHours = validatePeriodHours(
      getParamFromFunction(parameters, "p1MaintainDs", "dataStoreCleanupPeriod", 12),
      ERRORS.PARAMETERS_INVALID
    );

    const retentionPeriodHours = validatePeriodHours(
      getParamFromFunction(parameters, "p1MaintainDs", "dataStoreRetentionPeriod", 48),
      ERRORS.RETENTION_PERIOD_INVALID
    );

    const cleanupRequestsPerSecond = Number(
      getParamFromFunction(parameters, "p1MaintainDs", "cleanupRequestsPerSecond", 10)
    );
    const cleanupScrollSize = Number(
      getParamFromFunction(parameters, "p1MaintainDs", "cleanupScrollSize", 100)
    );
    const cleanupTaskPollIntervalMs = Number(
      getParamFromFunction(parameters, "p1MaintainDs", "cleanupTaskPollIntervalMs", 5000)
    );

    if (!Number.isFinite(cleanupRequestsPerSecond) || cleanupRequestsPerSecond <= 0) {
      throw buildProcessingError(ERRORS.PARAMETERS_INVALID);
    }
    if (!Number.isInteger(cleanupScrollSize) || cleanupScrollSize < 1 || cleanupScrollSize > 1000) {
      throw buildProcessingError(ERRORS.PARAMETERS_INVALID);
    }
    if (!Number.isFinite(cleanupTaskPollIntervalMs) || cleanupTaskPollIntervalMs < 100) {
      throw buildProcessingError(ERRORS.PARAMETERS_INVALID);
    }

    let client;
    try {
      client = await onfAdapter.getEsClient(
        false,
        dataStoreEsClient.uuid,
        dataStoreEsClient,
        logger
      );
    } catch (error) {
      logger.error?.(
        {
          label: "p1MaintainDs.getDataStoreClient",
          error: error.message || error
        },
        "Failed to initialize data store ES client"
      );
      throw buildProcessingError(ERRORS.DATA_STORE_ES_CLIENT_INVALID, error);
    }

    const cutoff = Date.now() - retentionPeriodHours * 3600 * 1000;

    const cutoffIso = new Date(cutoff).toJSON();

    const loggingClient = await tryGetLoggingClient(loggingEsClient, logger);

    const cleanupSummary = {
      cleanupPeriodHours,
      retentionPeriodHours,
      devicesVisited: 0,
      devicesDeleted: 0,
      batchesDeleted: 0,
      devicesUpdated: 0,
      devicesUnchanged: 0,
      versionConflicts: 0,
      failures: 0,
      mountNames: [],
      loggingDocumentsDeleted: 0,
      kafkaPayloadDocumentsDeleted: 0,
      cleanupTaskId: null
    };

    if (loggingClient) {
      cleanupSummary.loggingDocumentsDeleted = await deleteOldLoggingDocuments(
        loggingClient,
        loggingEsClient,
        cutoffIso,
        logger
      );
    }

    cleanupSummary.kafkaPayloadDocumentsDeleted = await deleteFailedKafkaPayloads(
      client,
      dataStoreEsClient,
      {
        requestsPerSecond: cleanupRequestsPerSecond,
        scrollSize: cleanupScrollSize,
        taskPollIntervalMs: cleanupTaskPollIntervalMs
      },
      logger
    );

    let cleanupResponse;
    try {
      cleanupResponse = await cleanDataStoreOnServer(
        client,
        dataStoreEsClient,
        cutoff,
        {
          requestsPerSecond: cleanupRequestsPerSecond,
          scrollSize: cleanupScrollSize,
          taskPollIntervalMs: cleanupTaskPollIntervalMs
        },
        logger
      );
    } catch (error) {
      logger.error?.(
        {
          label: "p1MaintainDs: server-side-cleanup",
          error: error.message || error
        },
        "Failed to clean data store on Elasticsearch"
      );
      throw buildProcessingError(ERRORS.ELASTICSEARCH_WRITE_ERROR, error);
    }

    cleanupSummary.devicesVisited = Number(cleanupResponse.total || 0);
    cleanupSummary.devicesDeleted = Number(cleanupResponse.deleted || 0);
    cleanupSummary.devicesUpdated = Number(cleanupResponse.updated || 0);
    cleanupSummary.devicesUnchanged = Number(cleanupResponse.noops || 0);
    cleanupSummary.versionConflicts = Number(cleanupResponse.version_conflicts || 0);
    cleanupSummary.failures = Array.isArray(cleanupResponse.failures)
      ? cleanupResponse.failures.length
      : 0;

    if (cleanupSummary.failures > 0) {
      const error = new Error(
        `Elasticsearch cleanup completed with ${cleanupSummary.failures} failures`
      );
      error.failures = cleanupResponse.failures;
      throw buildProcessingError(ERRORS.ELASTICSEARCH_WRITE_ERROR, error);
    }

    // Elasticsearch update-by-query does not return a safe aggregate count of
    // removed nested batch entries. Returning null avoids reporting a false zero.
    cleanupSummary.batchesDeleted = null;

    return { cleanupSummary };
  } catch (error) {
    if (error && ERRORS.knownErrors.has(error.message)) {
      throw error;
    }

    logger.error?.(
      {
        label: "p1MaintainDs",
        error: error.message || error
      },
      "Unexpected error in p1MaintainDs"
    );

    throw buildProcessingError(ERRORS.GENERAL_PROCESSING_ERROR, error);
  }
}

module.exports = { run };
