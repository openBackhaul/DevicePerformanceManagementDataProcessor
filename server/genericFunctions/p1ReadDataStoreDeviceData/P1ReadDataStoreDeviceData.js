const ERRORS = require('./ErrorsEnum');

/**
 * p1ReadDataStoreDeviceData
 *
 * Reads PM data of a device from DataStore according to mount-name.
 *
 * Expected input:
 * {
 *   "data-store-es-client": { url: "http://localhost:9200", ... },
 *   "mount-name": "100250001"
 * }
 *
 * Success output:
 * {
 *   "device-pm-data": [
 *     {
 *       "batch-timestamp": "...",
 *       "result-cc": { ... }
 *     }
 *   ]
 * }
 */
async function p1ReadDataStoreDeviceData(input) {
  try {
    const validationError = validateInput(input);
    if (validationError) {
      return validationError;
    }

    const dataStoreEsClient = input["data-store-es-client"];
    const mountName = input["mount-name"];
    const dataStoreUrl = dataStoreEsClient['url'];

    const devicePmData = await retrieveDevicePmDataFromDs(
      dataStoreEsClient,
      dataStoreUrl,
      mountName
    );

    if (typeof devicePmData === "string") { // Error occurred
      return devicePmData;
    }

    if (!Array.isArray(devicePmData) || devicePmData.length === 0) {
      return ERRORS.MOUNTNAME_NOT_FOUND;
    }

    return {
      "device-pm-data": devicePmData
    };
  } catch (error) {
    return ERRORS.GENERAL_ERROR;
  }
}

function validateInput(input) {
  if (!input || typeof input !== "object") {
    return ERRORS.GENERAL_ERROR;
  }

  const dataStoreEsClient = input["data-store-es-client"];
  const mountName = input["mount-name"];

  if (!dataStoreEsClient || typeof dataStoreEsClient !== "object") {
    return ERRORS.DATA_STORE_NOT_PROVIDED;
  }

  if (!dataStoreEsClient['url']) {
    return ERRORS.DATA_STORE_NOT_PROVIDED;
  }

  if (
    typeof dataStoreEsClient['url'] !== "string" ||
    !isValidUrl(dataStoreEsClient['url'])
  ) {
    return ERRORS.DATA_STORE_INVALID;
  }

  if (mountName === undefined || mountName === null || mountName === "") {
    return ERRORS.MOUNTNAME_NOT_PROVIDED;
  }

  if (typeof mountName !== "string") {
    return ERRORS.MOUNTNAME_INVALID;
  }

  return null;
}

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

async function retrieveDevicePmDataFromDs(dataStoreEsClient, dataStoreUrl, mountName) {
  try {
    const resourcePath = `/data-store/device=${encodeURIComponent(
      mountName
    )}/result-data`;

    /**
     * This implementation supports two possible client styles:
     *
     * 1. Custom client:
     *    dataStoreEsClient.get(url)
     *
     * 2. Elasticsearch-like client:
     *    dataStoreEsClient.search(...)
     */

    if (typeof dataStoreEsClient.get === "function") {
      const response = await dataStoreEsClient.get(`${dataStoreUrl}${resourcePath}`);

      return normalizeDsResponse(response);
    }

    if (typeof dataStoreEsClient.search === "function") {
      const response = await dataStoreEsClient.search({
        index: "data-store",
        query: {
          term: {
            "mount-name.keyword": mountName
          }
        }
      });

      return normalizeEsSearchResponse(response);
    }

    return ERRORS.ELK_READ_ERROR;
  } catch (error) {
    return ERRORS.ELK_READ_ERROR;
  }
}

function normalizeDsResponse(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (response && Array.isArray(response.data)) {
    return response.data;
  }

  if (response && Array.isArray(response["device-pm-data"])) {
    return response["device-pm-data"];
  }

  return [];
}

function normalizeEsSearchResponse(response) {
  const hits = response?.hits?.hits;

  if (!Array.isArray(hits)) {
    return [];
  }

  return hits
    .map(hit => hit._source)
    .filter(item => item)
    .map(item => ({
      "batch-timestamp": item["batch-timestamp"],
      "result-cc": item["result-cc"]
    }))
    .filter(
      item =>
        typeof item["batch-timestamp"] === "string" &&
        item["result-cc"] &&
        typeof item["result-cc"] === "object"
    );
}

module.exports = p1ReadDataStoreDeviceData;
