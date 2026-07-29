'use strict';

const ERRORS = require('./ErrorsEnum');

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
  validateInput(input);

  const dataStoreConfig = input['data-store-es-client'];
  const mountName = input['mount-name'];

  try {
    const processingData = await retrieveProcessingDataFromDs(
      dataStoreConfig,
      mountName
    );

    return {
      offsets: Array.isArray(processingData.offsets)
        ? processingData.offsets
        : [],

      'status-data': Array.isArray(processingData['status-data'])
        ? processingData['status-data']
        : []
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      // The specification requires empty arrays when the mount name
      // does not exist in the DataStore.
      return {
        offsets: [],
        'status-data': []
      };
    }

    if (isElasticsearchError(error)) {
      throw new Error(ERRORS.ELASTICSEARCH_READ_ERROR);
    }

    throw new Error(ERRORS.GENERAL_PROCESSING_ERROR);
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
  const index = dataStoreConfig.index || DEFAULT_DATA_STORE_INDEX;
  const documentId = `device=${mountName}/processing-data`;

  if (
    !elasticsearchClient ||
    typeof elasticsearchClient.get !== 'function'
  ) {
    const error = new Error('Invalid Elasticsearch client');
    error.isElasticsearchError = true;
    throw error;
  }

  const response = await elasticsearchClient.get({
    index,
    id: documentId
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
    ? response.body
    : response;

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
    throw new Error(ERRORS.DATA_STORE_URL_NOT_PROVIDED);
  }

  const dataStoreConfig = input['data-store-es-client'];

  if (
    !dataStoreConfig ||
    typeof dataStoreConfig !== 'object' ||
    Array.isArray(dataStoreConfig)
  ) {
    throw new Error(ERRORS.DATA_STORE_URL_NOT_PROVIDED);
  }

  const dataStoreUrl = dataStoreConfig.url;

  if (
    dataStoreUrl === undefined ||
    dataStoreUrl === null ||
    dataStoreUrl === ''
  ) {
    throw new Error(ERRORS.DATA_STORE_URL_NOT_PROVIDED);
  }

  if (!isValidHttpUrl(dataStoreUrl)) {
    throw new Error(ERRORS.DATA_STORE_URL_INVALID);
  }

  const mountName = input['mount-name'];

  if (
    mountName === undefined ||
    mountName === null ||
    mountName === ''
  ) {
    throw new Error(ERRORS.MOUNT_NAME_NOT_PROVIDED);
  }

  if (
    typeof mountName !== 'string' ||
    mountName.trim().length === 0
  ) {
    throw new Error(ERRORS.MOUNT_NAME_INVALID);
  }
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

    return (
      parsedUrl.protocol === 'http:' ||
      parsedUrl.protocol === 'https:'
    );
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
    (
      error.statusCode === 404 ||
      error.meta?.statusCode === 404 ||
      error.meta?.body?.status === 404 ||
      error.body?.status === 404
    )
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
      error.name === 'ConnectionError' ||
      error.name === 'ResponseError' ||
      error.name === 'TimeoutError' ||
      error.meta ||
      error.statusCode
    )
  );
}

module.exports = p1LoadOffsetsAndStatusData;
