const onfAdapter = require("../../../infra/onf/onfAdapter");
const { getParamFromFunction } = require("../../../utils/functionTree");
const { withRetry } = require("../../../utils/retry");

async function getLoggingClient(loggingEsClient, logger) {
  return await onfAdapter.getEsClient(
    false,
    loggingEsClient.uuid,
    loggingEsClient,
    logger
  );
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
    logger.error(
      {
        label: "delete-old-logging-documents",
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
    logger.error(
      {
        label: "search-old-logging-documents",
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
      logger.error(
        {
          label: "delete-single-logging-document",
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
    logger.error(
      {
        label: "delete-empty-data-store-document",
        mountName,
        error: error.message || error
      },
      "Failed to delete empty data store document"
    );
    return false;
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
  const { parameters, dataStoreEsClient, loggingEsClient, logger } = request;

  if (!parameters || !dataStoreEsClient || !loggingEsClient) {
    logger.error(
      {
        label: "invalid-input",
      },
      "Invalid input: parameters, dataStoreEsClient, and loggingEsClient are mandatory"
    );
    throw new Error("parameters, dataStoreEsClient, and loggingEsClient are mandatory");
  }

  const cleanupPeriodHours = Number(
    getParamFromFunction(parameters, "p1MaintainDs", "dataStoreCleanupPeriod", 12)
  );

  const retentionPeriodHours = Number(
    getParamFromFunction(parameters, "p1MaintainDs", "dataStoreRetentionPeriod", 48)
  );

  const client = await onfAdapter.getEsClient(
    false,
    dataStoreEsClient.uuid,
    dataStoreEsClient,
    logger
  );

  const response = await withRetry(
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
  ).catch((error) => {
      logger.error(
        {
          label: "search-data-store-for-maintenance",
          error: error.message || error
        },
        "Failed to search data store for maintenance"
      );
    });

  const cutoff = Date.now() - retentionPeriodHours * 3600 * 1000;

  const cutoffIso = new Date(cutoff).toJSON();

  const loggingClient = await getLoggingClient(loggingEsClient, logger);

  const cleanupSummary = {
    cleanupPeriodHours,
    retentionPeriodHours,
    devicesVisited: 0,
    devicesDeleted: 0,
    batchesDeleted: 0,
    mountNames: [],
    loggingDocumentsDeleted: 0
  };

  cleanupSummary.loggingDocumentsDeleted = await deleteOldLoggingDocuments(
    loggingClient,
    loggingEsClient,
    cutoffIso,
    logger
  );

  

  for (const hit of (((response || {}).body?.hits || {}).hits || [])) {
    const source = hit._source || {};
    const mountName = source.mountName || source["mount-name"] || hit._id;

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
      const deleted = await deleteDataStoreDocument(
        client,
        dataStoreEsClient,
        hit,
        mountName,
        logger
      );

      if (deleted) {
        cleanupSummary.devicesDeleted += 1;
        cleanupSummary.batchesDeleted += deletedBatches;
      }

      continue;
    }

    source.locked = true;
    source.timestamp = source.timestamp || new Date().toJSON();

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
    ).catch((error) => {
      logger.error(
        {
          label: "lock-device-for-maintenance",
          error: error.message || error
        },
        "Failed to lock device for maintenance"
      );
    });

    cleanupSummary.batchesDeleted += deletedBatches;
    source.batch = filtered;
    source.timestamp = new Date().toJSON();
    source.locked = false;

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
    ).catch((error) => {
      logger.error(
        {
          label: "save-device-after-maintenance",
          error: error.message || error
        },
        "Failed to save device after maintenance"
      );
    });
  }

  return { cleanupSummary };
}

module.exports = { run };
