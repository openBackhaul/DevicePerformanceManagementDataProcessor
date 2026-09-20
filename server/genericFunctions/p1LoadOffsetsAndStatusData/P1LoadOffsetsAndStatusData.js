'use strict';

const ERRORS = require('./ErrorsEnum');

const { Client } = require("@elastic/elasticsearch");

const DEFAULT_DATA_STORE_INDEX = 'data-store';

/**
 * Loads offsets and status data for a device from Elasticsearch.
 *
 * @param {object} input
 * @param {object} input.data-store-es-client
 * @param {string} input.data-store-es-client.url
 * @param {object} input.data-store-es-client.client
 * @param {string} [input.data-store-es-client.index]
 * @param {string} input.mount-name
 *
 * @returns {Promise<{
 *   offsets: Array,
 *   'status-data': Array
 * }>}
 *
 * @throws {Error}
 */
async function p1LoadOffsetsAndStatusData(input) {
  let checkInput = validateInput(input);

  if (checkInput != '') {
    return checkInput;
  }

  const dataStoreConfig = input['data-store-es-client'];
  const mountName = input['mount-name'];

  try {
    const processingData = await retrieveProcessingDataFromDs(
      dataStoreConfig,
      mountName
    );

    return {
      'offsets': Array.isArray(processingData['offsets'])
        ? processingData['offsets'] : [],

      'status-data': Array.isArray(processingData['status-data'])
        ? processingData['status-data'] : []
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      // The specification requires empty arrays when the mount name
      // does not exist in the DataStore.
      return {
        'offsets': [],
        'status-data': []
      };
    }

    if (isElasticsearchError(error)) {
      return ERRORS.ELK_READ_ERROR;
    }

    return ERRORS.GENERAL_ERROR;
  }
}

/**
 * Retrieves the processing-data document from Elasticsearch.
 *
 * Elasticsearch mapping:
 *
 * index: data-store
 * id: device=<mountName>/processing-data
 *
 * @param {object} dataStoreConfig
 * @param {string} mountName
 * @returns {Promise<object>}
 */
async function retrieveProcessingDataFromDs(dataStoreConfig, mountName) {
  const elasticsearchClient = dataStoreConfig.client;
  const index = dataStoreConfig['index-alias'] ? dataStoreConfig['index-alias'] : dataStoreConfig.index || DEFAULT_DATA_STORE_INDEX;
  const documentId = `device=${mountName}/processing-data`;

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

  const response = await client.get({
    'index': index,
    'id': documentId
  });

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
  const responseBody = response && response.body
    ? response.body : response;

  if (!responseBody || typeof responseBody !== 'object') {
    throw new Error('Invalid Elasticsearch response');
  }

  const source = responseBody._source;

  if (!source || typeof source !== 'object') {
    throw new Error('Processing data not available');
  }

  return source;
}

/**
 * Validates the function input.
 *
 * @param {*} input
 */
function validateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return ERRORS.DATA_STORE_URL_NOT_PROV;
  }

  const dataStoreConfig = input['data-store-es-client'];

  if (!dataStoreConfig || typeof dataStoreConfig !== 'object' || Array.isArray(dataStoreConfig)) {
    return ERRORS.DATA_STORE_URL_NOT_PROV;
  }

  const dataStoreUrl = dataStoreConfig['url'];

  if (dataStoreUrl === undefined || dataStoreUrl === null || dataStoreUrl === '') {
    return ERRORS.DATA_STORE_URL_NOT_PROV;
  }

  if (!isValidHttpUrl(dataStoreUrl)) {
    return ERRORS.DATA_STORE_URL_INVALID;
  }

  const mountName = input['mount-name'];

  if (mountName === undefined || mountName === null || mountName === '') {
    return ERRORS.MOUNT_NAME_NOT_PROVIDED;
  }

  if (typeof mountName !== 'string' || mountName.trim().length === 0) {
    return ERRORS.MOUNT_NAME_INVALID;
  }

  return ""; // Everything is ok.
}

/**
 * Checks whether a value is a valid HTTP or HTTPS URL.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isValidHttpUrl(value) {
  if (typeof value !== 'string') {
    return false;
  }

  try {
    const parsedUrl = new URL(value);

    return (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:');
  } catch {
    return false;
  }
}

/**
 * Detects an Elasticsearch document-not-found response.
 *
 * Supports Elasticsearch client versions exposing either statusCode
 * or meta.statusCode.
 *
 * @param {*} error
 * @returns {boolean}
 */
function isNotFoundError(error) {
  return Boolean(
    error &&
    (error.statusCode === 404 || error.meta?.statusCode === 404 || error.meta?.body?.status === 404 || error.body?.status === 404)
  );
}

/**
 * Detects errors generated while communicating with Elasticsearch.
 *
 * @param {*} error
 * @returns {boolean}
 */
function isElasticsearchError(error) {
  return Boolean(
    error &&
    (
      error.isElasticsearchError === true ||
      error.name === 'ConnectionError' || error.name === 'ResponseError' || error.name === 'TimeoutError' ||
      error.meta || error.statusCode
    )
  );
}

module.exports = p1LoadOffsetsAndStatusData;
