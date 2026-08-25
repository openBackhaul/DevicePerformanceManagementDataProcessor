const ERRORS = require('./ErrorsEnum');

const ElasticsearchServiceModule = require("onf-core-model-ap/applicationPattern/services/ElasticsearchService");

const { Client } = require("@elastic/elasticsearch");

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

    // const clientEs =
    //   await ElasticsearchServiceModule.elasticsearchService.getClient(false, dataStoreEsClient['uuid']);

    const client = new Client({
      'node': dataStoreEsClient['url'],
      'auth': {
        'apiKey': {
          'apiKey': dataStoreEsClient['api-key']
        }
      },
      'requestTimeout': 60000
    })
    await client.info();

    const devicePmData = await retrieveDevicePmDataFromDs(client, dataStoreEsClient, mountName);

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

async function retrieveDevicePmDataFromDs(client, dataStore, mountName) {
  try {
    const resourcePath = `/data-store/device=${encodeURIComponent(dataStore['mountName'])}/result-data`;
                       // /data-store/device={/read-data-store-device-data/mount-name}/result-data]
    let result = await client.get({
      'index': dataStore['index-alias'],
      'id': mountName
    });


    /**
     * This implementation supports two possible client styles:
     *
     * 1. Custom client:
     *    dataStoreEsClient.get(url)
    */
    // }

    return result.body._source;
  } catch (error) {
    return ERRORS.ELK_READ_ERROR;
  }
}

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

module.exports = p1ReadDataStoreDeviceData;
