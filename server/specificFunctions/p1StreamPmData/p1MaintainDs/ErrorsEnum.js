const ERRORS = {
  PARAMETERS_NOT_PROVIDED: "parameters not provided",
  PARAMETERS_INVALID: "parameters invalid",
  DATA_STORE_ES_CLIENT_NOT_PROVIDED: "dataStoreEsClient not provided",
  DATA_STORE_ES_CLIENT_INVALID: "dataStoreEsClient invalid",
  DATA_STORE_ERROR: "DataStore error",
  DATA_STORE_URL_NOT_PROVIDED: "dataStoreUrl not provided",
  DATA_STORE_URL_INVALID: "dataStoreUrl invalid",
  ELASTICSEARCH_READ_ERROR: "ElasticSearch read error",
  ELASTICSEARCH_LOCK_ERROR: "ElasticSearch lock error",
  MOUNT_NAME_NOT_PROVIDED: "mountName not provided",
  MOUNT_NAME_INVALID: "mountName invalid",
  BATCH_LIST_NOT_PROVIDED: "batchList not provided",
  BATCH_LIST_INVALID: "batchList invalid",
  RETENTION_PERIOD_NOT_PROVIDED: "retentionPeriod not provided",
  RETENTION_PERIOD_INVALID: "retentionPeriod invalid",
  DEVICE_DATA_NOT_PROVIDED: "deviceData not provided",
  DEVICE_DATA_INVALID: "deviceData invalid",
  ELASTICSEARCH_WRITE_ERROR: "ElasticSearch write error",
  ELASTICSEARCH_UNLOCK_ERROR: "ElasticSearch unlock error",
  GENERAL_PROCESSING_ERROR: "General processing error"
};

ERRORS.knownErrors = new Set(Object.values(ERRORS));

module.exports = ERRORS;
