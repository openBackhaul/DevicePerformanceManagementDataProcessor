const ERRORS = require('./ErrorsEnum');
const { validateMountName } = require('../../utils/mountNameValidation');

const { Client } = require("@elastic/elasticsearch");

const DEFAULT_DATA_STORE_INDEX = 'data-store';

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
 */
async function p1ReadDataStoreDeviceData(input) {
  try {
    const validationError = validateInput(input);
    if (validationError) {
      return validationError;
    }

    const dataStoreEsClient = input["data-store-es-client"];
    const mountName = input["mount-name"];

    let devicePmData = await retrieveDevicePmDataFromDs(dataStoreEsClient, mountName);

    if (typeof devicePmData === "string") { // Error occurred
      return devicePmData;
    }

    let result = normalizeDsResponse(devicePmData);

    if (!Array.isArray(result) || result.length === 0) {
      return ERRORS.MOUNTNAME_NOT_FOUND;
    }

    return {
      "device-pm-data": result
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

  if (!dataStoreEsClient || typeof dataStoreEsClient !== "object") {
    return ERRORS.DATA_STORE_NOT_PROVIDED;
  }

  if (!dataStoreEsClient['url']) {
    return ERRORS.DATA_STORE_NOT_PROVIDED;
  }

  if (typeof dataStoreEsClient['url'] !== "string" || !isValidUrl(dataStoreEsClient['url'])) {
    return ERRORS.DATA_STORE_INVALID;
  }

  const mountNameError = validateMountName(input);
  if (mountNameError) {
    return mountNameError;
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

async function retrieveDevicePmDataFromDs(dataStoreConfig, mountName) {
  const elasticsearchClient = dataStoreConfig.client;
  const index = dataStoreConfig['index-alias'] ? dataStoreConfig['index-alias'] : dataStoreConfig.index || DEFAULT_DATA_STORE_INDEX;
  // Issue244: p2Storing/P1Storing store each device document using the mount name
  // as the Elasticsearch _id. The PM records are kept in the 'result-data' property.
  const documentId = mountName;

  let client;
  if (elasticsearchClient != undefined) { // For testing purpose
    client = elasticsearchClient;
  } else {
    try {
      client = new Client({
        'node': dataStoreConfig['url'],
        'auth': {
          'apiKey': {
            'apiKey': dataStoreConfig['api-key']
          }
        },
        'requestTimeout': 60000
      })
      await client.info(); // Testing Connection
    } catch (error) {
      throw error;
    }
  }

  let response;
  try {
    response = await client.get({
      'index': index,
      'id': documentId
    });
  } catch (error) {
    if (error?.message == "connection failed") {
      return ERRORS.ELK_READ_ERROR;
    } else if (error?.meta?.statusCode == 404) {
      return ERRORS.MOUNTNAME_NOT_FOUND;
    } else {
      throw (error);
    }
  }

  /*
   * Elasticsearch client v8 normally returns:
   *
   * {
   *   _index: 'data-store',
   *   _id: '100250001',
   *   _source: { 'mount-name': '100250001', ..., 'result-data': [ ... ] }
   * }
   *
   * Some wrapped clients or older versions return:
   *
   * {
   *   body: {
   *     _source: { ... }
   *   }
   * }
   */
  const responseBody = response && response.body ? response.body : response;

  if (!responseBody || typeof responseBody !== 'object') {
    throw new Error('Invalid Elasticsearch response');
  }

  const source = responseBody._source;

  if (!source || typeof source !== 'object') {
    throw new Error('Result data not available');
  }

  return source;
}

module.exports = p1ReadDataStoreDeviceData;


function normalizeDsResponse(response) {
  if (Array.isArray(response)) {
    return response;
  }

  // p2Storing DataStore structure (issue 244):
  // _source = { 'result-data': [ { 'batch-timestamp': ..., 'result-cc': ... } ] }
  if (response && Array.isArray(response['result-data'])) {
    return response['result-data'];
  }

  // p1Storing legacy DataStore structure (camelCase 'batch'), mapped to the
  // output contract expected by '/provide-device-data-store-dump'.
  if (response && Array.isArray(response.batch)) {
    return response.batch.map((entry) => ({
      'batch-timestamp': entry.batchTimestamp,
      'result-cc': entry.resultCc
    }));
  }

  if (response && Array.isArray(response.data)) {
    return response.data;
  }

  if (response && Array.isArray(response["device-pm-data"])) {
    return response["device-pm-data"];
  }

  return [];
}
