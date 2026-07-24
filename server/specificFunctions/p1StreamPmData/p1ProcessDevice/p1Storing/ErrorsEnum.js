const ERRORS = {
  DATA_STORE_ES_CLIENT_NOT_PROVIDED: "dataStoreEsClient not provided",
  DATA_STORE_ES_CLIENT_INVALID: "dataStoreEsClient invalid",
  RESULT_CC_NOT_PROVIDED: "resultCc not provided",
  RESULT_CC_INVALID: "resultCc invalid",
  INTERFACE_METADATA_LIST_NOT_PROVIDED: "interfaceMetadataList not provided",
  INTERFACE_METADATA_LIST_INVALID: "interfaceMetadataList invalid",
  RESULT_CC_COULD_NOT_BE_STORED: "resultCc could not be stored",
  INTERFACE_METADATA_LIST_COULD_NOT_BE_STORED:
    "interfaceMetadataList could not be stored",
  DATA_STORE_URL_NOT_PROVIDED: "dataStoreUrl not provided",
  DATA_STORE_URL_INVALID: "dataStoreUrl invalid",
  MOUNT_NAME_NOT_PROVIDED: "mountName not provided",
  BATCH_TIMESTAMP_NOT_PROVIDED: "batchTimestamp not provided",
  BATCH_TIMESTAMP_INVALID: "batchTimestamp invalid",
  WRITING_TO_DATA_STORE_FAILED: "Writing to dataStore failed",
  ELASTICSEARCH_LOCK_ERROR: "ElasticSearch lock error",
  ELASTICSEARCH_UNLOCK_ERROR: "ElasticSearch unlock error",
  GENERAL_PROCESSING_ERROR: "General processing error"
};

ERRORS.knownErrors = new Set(Object.values(ERRORS));

module.exports = ERRORS;
