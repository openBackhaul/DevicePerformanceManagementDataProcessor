"use strict";

const { getParamFromFunction } = require("../../../../utils/functionTree");

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readProperty(object, ...propertyNames) {
  for (const propertyName of propertyNames) {
    if (object && Object.prototype.hasOwnProperty.call(object, propertyName)) {
      return object[propertyName];
    }
  }
  return undefined;
}

function createStoringError(message, retryable = false, cause) {
  const error = new Error(message);
  error.stage = "p2Storing";
  error.retryable = retryable;
  if (cause) error.cause = cause;
  return error;
}

function unwrapElasticsearchResponse(response) {
  return response && response.body ? response.body : response;
}

function isNotFoundError(error) {
  return Boolean(error && (
    error.statusCode === 404 ||
    error.status === 404 ||
    error.meta?.statusCode === 404
  ));
}

function validateRequest(request) {
  const parameters = readProperty(request, "parameters");
  const dataStoreEsClient = readProperty(
    request,
    "dataStoreEsClient",
    "data-store-es-client"
  );
  const resultCc = readProperty(request, "resultCc", "result-cc");
  const offsets = readProperty(request, "offsets");
  const statusData = readProperty(request, "statusData", "status-data");

  if (parameters == null) throw createStoringError("parameters not provided");
  if (!isObject(parameters)) throw createStoringError("parameters invalid");
  if (dataStoreEsClient == null) {
    throw createStoringError("dataStoreEsClient not provided");
  }
  if (
    !isObject(dataStoreEsClient) ||
    !dataStoreEsClient.uuid ||
    !dataStoreEsClient["index-alias"]
  ) {
    throw createStoringError("dataStoreEsClient invalid");
  }
  if (resultCc == null) throw createStoringError("resultCc not provided");
  if (!isObject(resultCc)) throw createStoringError("resultCc invalid");
  if (offsets == null) throw createStoringError("offsets not provided");
  if (!Array.isArray(offsets)) throw createStoringError("offsets invalid");
  if (statusData == null) throw createStoringError("statusData not provided");
  if (!Array.isArray(statusData)) throw createStoringError("statusData invalid");

  const mountName = String(
    readProperty(request, "mountName", "mount-name") ||
    resultCc["mount-name"] ||
    resultCc.mountName ||
    resultCc.uuid ||
    ""
  ).trim();
  if (!mountName) throw createStoringError("mountName not provided");

  return {
    parameters,
    dataStoreEsClient,
    resultCc,
    offsets,
    statusData,
    mountName
  };
}

async function getDataStoreClient(input, request) {
  if (request.esClient) return request.esClient;

  const onfAdapter = require("../../../../infra/onf/onfAdapter");
  return onfAdapter.getEsClient(
    false,
    input.dataStoreEsClient.uuid,
    input.dataStoreEsClient,
    request.logger
  );
}

async function readExistingDevice(client, index, mountName) {
  try {
    const response = unwrapElasticsearchResponse(await client.get({
      index,
      id: mountName
    })) || {};
    return {
      document: response._source || {},
      sequenceNumber: response._seq_no,
      primaryTerm: response._primary_term
    };
  } catch (cause) {
    if (isNotFoundError(cause)) return { document: {} };
    throw createStoringError("general processing error", true, cause);
  }
}

function isResultCcStorageActive(parameters) {
  const configuredValue = getParamFromFunction(
    parameters,
    "p2Storing",
    "storingResultCc",
    "deactivated"
  );
  return String(configuredValue).toLowerCase() === "activated";
}

function addOrReplaceResultData(document, batchTimestamp, resultCc) {
  const resultData = Array.isArray(document["result-data"])
    ? [...document["result-data"]]
    : [];
  const newEntry = {
    "batch-timestamp": batchTimestamp,
    "result-cc": resultCc
  };
  const existingIndex = resultData.findIndex((entry) => (
    entry && entry["batch-timestamp"] === batchTimestamp
  ));

  if (existingIndex >= 0) resultData[existingIndex] = newEntry;
  else resultData.push(newEntry);

  document["result-data"] = resultData;
}

function createDeviceDocument(existingDocument, input, storeResultCc, batchTimestamp) {
  const deviceDocument = {
    ...existingDocument,
    "mount-name": input.mountName,
    "processing-data": {
      offsets: input.offsets,
      "status-data": input.statusData
    },
    locked: true,
    timestamp: new Date().toISOString()
  };
  if (storeResultCc) {
    addOrReplaceResultData(deviceDocument, batchTimestamp, input.resultCc);
  }
  return deviceDocument;
}

function createIndexRequest(index, mountName, document, concurrencyData = {}) {
  const request = {
    index,
    id: mountName,
    body: document,
    refresh: false
  };
  if (concurrencyData.sequenceNumber !== undefined) {
    request.if_seq_no = concurrencyData.sequenceNumber;
    request.if_primary_term = concurrencyData.primaryTerm;
  }
  return request;
}

async function releaseLockAfterFailure(client, index, input, deviceDocument) {
  deviceDocument.locked = false;
  deviceDocument.timestamp = new Date().toISOString();
  try {
    await client.index(createIndexRequest(index, input.mountName, deviceDocument));
  } catch (_) {
    // Preserve the original storing error. A later retry can recover the lock.
  }
}

async function storeDevice(client, index, input, existingDevice, deviceDocument) {
  const lockRequest = createIndexRequest(
    index,
    input.mountName,
    deviceDocument,
    existingDevice
  );
  const lockResponse = unwrapElasticsearchResponse(
    await client.index(lockRequest)
  ) || {};

  deviceDocument.locked = false;
  deviceDocument.timestamp = new Date().toISOString();
  const saveRequest = createIndexRequest(
    index,
    input.mountName,
    deviceDocument,
    {
      sequenceNumber: lockResponse._seq_no,
      primaryTerm: lockResponse._primary_term
    }
  );
  await client.index(saveRequest);
}

async function run(request = {}) {
  const input = validateRequest(request);
  const client = await getDataStoreClient(input, request);
  const index = input.dataStoreEsClient["index-alias"];
  const existingDevice = await readExistingDevice(client, index, input.mountName);

  if (existingDevice.document.locked === true) {
    throw createStoringError("ElasticSearch lock error", true);
  }

  const batchTimestamp = input.resultCc["batch-timestamp"] || new Date().toISOString();
  const storeResultCc = isResultCcStorageActive(input.parameters);
  const deviceDocument = createDeviceDocument(
    existingDevice.document,
    input,
    storeResultCc,
    batchTimestamp
  );

  try {
    await storeDevice(client, index, input, existingDevice, deviceDocument);
  } catch (cause) {
    await releaseLockAfterFailure(client, index, input, deviceDocument);
    const message = storeResultCc
      ? "resultData could not be stored"
      : "offsets could not be stored";
    throw createStoringError(message, true, cause);
  }

  return {
    "mount-name": input.mountName,
    "batch-timestamp": batchTimestamp
  };
}

module.exports = { run };
