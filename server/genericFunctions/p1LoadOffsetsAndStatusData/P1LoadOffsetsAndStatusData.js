const ERRORS = require('./ErrorsEnum');

/**
 * p1LoadOffsetsAndStatusData
 *
 * Loads offsets and status-data for a device from DataStore.
 *
 * @param {Object} input
 * @param {Object} input["data-store-es-client"] Elasticsearch client or wrapper
 * @param {string} input["mount-name"] Device mount name
 *
 * @returns {Promise<Object>} { offsets: [], "status-data": [] }
 */
async function p1LoadOffsetsAndStatusData(input) {
  try {
    const dataStoreEsClient = input?.['data-store-es-client'];
    const mountName = input?.['mount-name'];

    // Checks input data
    if (!dataStoreEsClient) {
      return ERRORS.DATA_STORE_URL_NOT_PROV;
    }

    const dataStoreUrl = dataStoreEsClient?.url;

    if (!dataStoreUrl) {
      return ERRORS.DATA_STORE_URL_NOT_PROV;
    }

    if (typeof dataStoreUrl !== "string" || dataStoreUrl.trim() === "") {
      return ERRORS.DATA_STORE_URL_INVALID;
    }

    if (!mountName) {
      return ERRORS.MOUNT_NAME_NOT_PROVIDED;
    }

    if (typeof mountName !== "string" || mountName.trim() === "") {
      return ERRORS.MOUNT_NAME_INVALID;
    }

    const processingData = await retrieveProcessingDataFromDs({
      dataStoreEsClient,
      dataStoreUrl,
      mountName
    });

    return {
      offsets: Array.isArray(processingData?.offsets)
        ? processingData.offsets
        : [],

      "status-data": Array.isArray(processingData?.['status-data'])
        ? processingData['status-data']
        : []
    };

  } catch (error) {
    return ERRORS.GENERAL_ERROR;
  }
}


/**
 * Reads processing data from DataStore.
 *
 * Expected DataStore path:
 * /data-store/device={mountName}/processing-data
 */
async function retrieveProcessingDataFromDs({
  dataStoreEsClient,
  dataStoreUrl,
  mountName
}) {
  try {
    const index = "data-store";
    const id = `device=${mountName}/processing-data`;

    const response = await dataStoreEsClient.get({
      index,
      id
    });

    const source = response?._source ?? response?.body?._source;

    if (!source) {
      return {
        'offsets': [],
        'status-data': []
      };
    }

    return {
      'offsets': Array.isArray(source['offsets']) ? source['offsets'] : [],
      'status-data': Array.isArray(source['status-data'])
        ? source['status-data']
        : []
    };

  } catch (error) {
    // If the device does not exist yet, the specification says:
    // provide empty offsets and empty status-data arrays.
    if (
      error?.meta?.statusCode === 404 ||
      error?.statusCode === 404 ||
      error?.body?.found === false
    ) {
      return {
        'offsets': [],
        'status-data': []
      };
    }

    return ERRORS.ELK_READ_ERROR;
  }
}

module.exports = p1LoadOffsetsAndStatusData;
