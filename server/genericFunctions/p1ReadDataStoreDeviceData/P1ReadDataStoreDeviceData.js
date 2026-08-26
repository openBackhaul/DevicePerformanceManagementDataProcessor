const ERRORS = require('./ErrorsEnum');

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

    // if (!Array.isArray(devicePmData) || devicePmData.length === 0) {  // To be check
    //   return ERRORS.MOUNTNAME_NOT_FOUND;
    // }

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

  if (typeof dataStoreEsClient['url'] !== "string" || !isValidUrl(dataStoreEsClient['url'])) {
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

async function retrieveDevicePmDataFromDs(dataStoreConfig, mountName) {
  const elasticsearchClient = dataStoreConfig.client;
  const index = dataStoreConfig['index-alias'] ? dataStoreConfig['index-alias'] : dataStoreConfig.index || DEFAULT_DATA_STORE_INDEX;
  const documentId = `device=${encodeURIComponent(mountName)}/result-data`;

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
    if (error.meta.statusCode == 404) {
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
   *   _id: 'device=100250001/processing-data',
   *   _source: {...}
   * }
   *
   * Some wrapped clients or older versions return:
   *
   * {
   *   body: {
   *     _source: {...}
   *   }
   * }
   */
  const responseBody = response && response.body ? response.body : response;

  if (!responseBody || typeof responseBody !== 'object') {
    throw new Error('Invalid Elasticsearch response');
  }

  const source = responseBody._source;

  if (!source || typeof source !== 'object') {
    throw new Error('Processing data not available');
  }

  return source;
}

module.exports = p1ReadDataStoreDeviceData;


// function normalizeDsResponse(response) {
//   if (Array.isArray(response)) {
//     return response;
//   }

//   if (response && Array.isArray(response.data)) {
//     return response.data;
//   }

//   if (response && Array.isArray(response["device-pm-data"])) {
//     return response["device-pm-data"];
//   }

//   return [];
// }

// function normalizeEsSearchResponse(response) {
//   const hits = response?.hits?.hits;

//   if (!Array.isArray(hits)) {
//     return [];
//   }

//   return hits
//     .map(hit => hit._source)
//     .filter(item => item)
//     .map(item => ({
//       "batch-timestamp": item["batch-timestamp"],
//       "result-cc": item["result-cc"]
//     }))
//     .filter(
//       item =>
//         typeof item["batch-timestamp"] === "string" &&
//         item["result-cc"] &&
//         typeof item["result-cc"] === "object"
//     );
// }
