const onfAdapter = require("../../../infra/onf/onfAdapter");
const { getParamFromFunction } = require("../../../utils/functionTree");
const { withRetry } = require("../../../utils/retry");
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

    let response;
    try {
      response = await withRetry(
        async () =>
          client.search({
            index: dataStoreEsClient["index-alias"],
            size: 1000,
            body: {
              query: { match_all: {} }
            }
          }),
        {
          label: "p1MaintainDs.search",
          retryIntervalMs: 10000,
          logger
        }
      );
    } catch (error) {
      logger.error(
        {
          label: "p1MaintainDs: search-data-store-for-maintenance",
          error: error.message || error
        },
        "Failed to search data store for maintenance"
      );
      //throw buildProcessingError(ERRORS.ELASTICSEARCH_READ_ERROR, error);
      logger.error(buildProcessingError(ERRORS.ELASTICSEARCH_READ_ERROR, error).message);
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
      mountNames: [],
      loggingDocumentsDeleted: 0
    };

    if (loggingClient) {
      cleanupSummary.loggingDocumentsDeleted = await deleteOldLoggingDocuments(
        loggingClient,
        loggingEsClient,
        cutoffIso,
        logger
      );
    }

  

    for (const hit of (((response || {}).body?.hits || {}).hits || [])) {
      const source = hit._source || {};
      const mountName = source.mountName || source["mount-name"] || hit._id;

      if (!mountName) {
        throw buildProcessingError(ERRORS.MOUNT_NAME_NOT_PROVIDED);
      }

      cleanupSummary.devicesVisited += 1;
      cleanupSummary.mountNames.push(mountName);

      const batch = Array.isArray(source.batch) ? source.batch : [];
      const filtered = batch.filter((entry) => {
        const timestamp = entry.batchTimestamp || entry.timestamp;
        if (!timestamp) {
          return true;
        }
        return new Date(timestamp).getTime() >= cutoff;
      });
      const deletedBatches = batch.length - filtered.length;

      if (shouldDeleteDataStoreDocument(source, filtered, cutoff)) {
        await deleteDataStoreDocument(
          client,
          dataStoreEsClient,
          hit,
          mountName,
          logger
        );

        cleanupSummary.devicesDeleted += 1;
        cleanupSummary.batchesDeleted += deletedBatches;

        continue;
      }

      source.locked = true;
      source.timestamp = source.timestamp || new Date().toJSON();

      try {
        await withRetry(
          async () =>
            client.index({
              index: dataStoreEsClient["index-alias"],
              id: hit._id,
              body: source,
              refresh: false
            }),
          {
            label: `p1MaintainDs.lock:${mountName}`,
            retryIntervalMs: 10000,
            logger
          }
        );
      } catch (error) {
        logger.error?.(
          {
            label: "p1MaintainDs: lock-device-for-maintenance",
            mountName,
            error: error.message || error
          },
          "Failed to lock device for maintenance"
        );
        //throw buildProcessingError(ERRORS.ELASTICSEARCH_LOCK_ERROR, error);
        logger.error(buildProcessingError(ERRORS.ELASTICSEARCH_LOCK_ERROR, error).message);
      }

      cleanupSummary.batchesDeleted += deletedBatches;
      source.batch = filtered;
      source.timestamp = new Date().toJSON();
      source.locked = false;

      try {
        await withRetry(
          async () =>
            client.index({
              index: dataStoreEsClient["index-alias"],
              id: hit._id,
              body: source,
              refresh: false
            }),
          {
            label: `p1MaintainDs.save:${mountName}`,
            retryIntervalMs: 10000,
            logger
          }
        );
      } catch (error) {
        logger.error?.(
          {
            label: "p1MaintainDs: save-device-after-maintenance",
            mountName,
            error: error.message || error
          },
          "Failed to save device after maintenance"
        );
       // throw buildProcessingError(ERRORS.ELASTICSEARCH_WRITE_ERROR, error);
        logger.error(buildProcessingError(ERRORS.ELASTICSEARCH_WRITE_ERROR, error).message);
      }
    }

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
