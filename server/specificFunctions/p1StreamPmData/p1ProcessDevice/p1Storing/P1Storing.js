const onfAdapter = require("../../../../infra/onf/onfAdapter");
const { withRetry } = require("../../../../utils/retry");
const ERRORS = require("./ErrorsEnum");
const logger = require('../../../../service/LoggingService.js').getLogger();

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

  error.stage = "p1Storing";

  if (cause) {
    error.cause = cause;
  }

  return error;
}

function isNotFoundError(error) {
  return (
    error &&
    (
      error.statusCode === 404 ||
      error.status === 404 ||
      error.meta?.statusCode === 404 ||
      error.body?.found === false ||
      error.meta?.body?.found === false
    )
  );
}

function getValidatedRequest(request) {
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

  const resultCc = getRequestValue(request, "resultCc", "result-cc");

  if (resultCc === undefined || resultCc === null) {
    throw buildProcessingError(ERRORS.RESULT_CC_NOT_PROVIDED);
  }

  if (!isPlainObject(resultCc)) {
    throw buildProcessingError(ERRORS.RESULT_CC_INVALID);
  }

  const interfaceMetadataList = getRequestValue(
    request,
    "interfaceMetadataList",
    "interface-metadata-list"
  );

  if (interfaceMetadataList === undefined || interfaceMetadataList === null) {
    throw buildProcessingError(ERRORS.INTERFACE_METADATA_LIST_NOT_PROVIDED);
  }

  if (!Array.isArray(interfaceMetadataList)) {
    throw buildProcessingError(ERRORS.INTERFACE_METADATA_LIST_INVALID);
  }

  const mountNameCandidate =
    getRequestValue(request, "mountName", "mount-name") ||
    resultCc.mountName ||
    resultCc["mount-name"] ||
    resultCc.uuid;

  const mountName =
    typeof mountNameCandidate === "string"
      ? mountNameCandidate.trim()
      : String(mountNameCandidate || "").trim();

  if (!mountName) {
    throw buildProcessingError(ERRORS.MOUNT_NAME_NOT_PROVIDED);
  }

  const batchTimestamp = getRequestValue(resultCc, "batch-timestamp", "batchTimestamp");
  if (batchTimestamp === undefined || batchTimestamp === null || batchTimestamp === "") {
    throw buildProcessingError(ERRORS.BATCH_TIMESTAMP_NOT_PROVIDED);
  }

  if (typeof batchTimestamp !== "string" || Number.isNaN(Date.parse(batchTimestamp))) {
    throw buildProcessingError(ERRORS.BATCH_TIMESTAMP_INVALID);
  }

  return {
    dataStoreEsClient,
    resultCc,
    interfaceMetadataList,
    mountName,
    batchTimestamp,
    saveResultCc: getRequestValue(request, "saveResultCc", "save-result-cc") !== false,
    resultHistoryLimit: Number(getRequestValue(request, "resultHistoryLimit", "result-history-limit") ?? 0),
    dataStoreWriteLockEnabled: getRequestValue(
      request,
      "dataStoreWriteLockEnabled",
      "data-store-write-lock-enabled"
    ) !== false
  };
}

async function searchExisting(client, index, mountName, logger) {
  try {
    const response = await withRetry(
      async () =>
        client.get({
          index,
          id: mountName
        }),
      {
        label: `p1Storing.searchExisting:${mountName}`,
        retryIntervalMs: 10000,
        logger
      }
    );

    if ((response || {}).body?.found === false) {
      return {};
    }

    return (response || {}).body?._source || {};
  } catch (error) {
    if (isNotFoundError(error)) {
      return {};
    }

    logger.error?.(
      {
        label: "search-existing-device",
        mountName,
        error: error.message || error
      },
      "Failed to search existing device"
    );

    throw buildProcessingError(ERRORS.RESULT_CC_COULD_NOT_BE_STORED, error);
  }
}

async function writeDataStoreDocument(
  client,
  index,
  mountName,
  body,
  logger,
  retryLabel,
  logLabel,
  logMessage,
  errorMessage
) {
  try {
    await withRetry(
      async () =>
        client.index({
          index,
          id: mountName,
          body,
          refresh: false
        }),
      {
        label: retryLabel,
        retryIntervalMs: 10000,
        logger
      }
    );
  } catch (error) {
    logger.error?.(
      {
        label: logLabel,
        mountName,
        error: error.message || error
      },
      logMessage
    );

    throw buildProcessingError(errorMessage, error);
  }
}

/**
 * Request:
 * {
 *   dataStoreEsClient,
 *   resultCc,
 *   interfaceMetadataList
 * }
 *
 * Response:
 * {
 *   mountName,
 *   batch
 * }
 */
async function run(request) {
  //const logger = getSafeLogger(request && request.logger);

  try {
    const {
      dataStoreEsClient,
      resultCc,
      interfaceMetadataList,
      mountName,
      batchTimestamp,
      saveResultCc,
      resultHistoryLimit,
      dataStoreWriteLockEnabled
    } = getValidatedRequest(request);

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
          label: "p1Storing.getDataStoreClient",
          error: error.message || error
        },
        "Failed to initialize data store ES client"
      );
      throw buildProcessingError(ERRORS.DATA_STORE_ES_CLIENT_INVALID, error);
    }

    const index = dataStoreEsClient["index-alias"];
    const existing = await searchExisting(client, index, mountName, logger);

    existing.mountName = mountName;
    if (dataStoreWriteLockEnabled) {
      existing.timestamp = new Date().toJSON();
      existing.locked = true;
      await writeDataStoreDocument(
        client,
        index,
        mountName,
        existing,
        logger,
        `p1Storing.lock:${mountName}`,
        "lock-device-for-storing",
        "Failed to lock device for storing",
        ERRORS.ELASTICSEARCH_LOCK_ERROR
      );
    }

    existing["interface-metadata-list"] = interfaceMetadataList;
    existing.batch = Array.isArray(existing.batch) ? existing.batch : [];
    existing.batch.push({
      batchTimestamp,
      ...(saveResultCc ? { resultCc } : {})
    });
    if (Number.isInteger(resultHistoryLimit) && resultHistoryLimit > 0) {
      existing.batch = existing.batch.slice(-resultHistoryLimit);
    }

    existing.timestamp = batchTimestamp;
    existing.locked = false;

    await writeDataStoreDocument(
      client,
      index,
      mountName,
      existing,
      logger,
      `p1Storing.save:${mountName}`,
      "save-device-for-storing",
      "Failed to save device for storing",
      ERRORS.WRITING_TO_DATA_STORE_FAILED
    );

    return {
      mountName,
      batch: existing.batch
    };
  } catch (error) {
    if (error && ERRORS.knownErrors.has(error.message)) {
      throw error;
    }

    logger.error?.(
      {
        label: "p1Storing",
        error: error.message || error
      },
      "Unexpected error in p1Storing"
    );

    throw buildProcessingError(ERRORS.GENERAL_PROCESSING_ERROR, error);
  }
}

module.exports = { run };
