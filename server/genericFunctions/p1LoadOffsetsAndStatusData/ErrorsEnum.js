const ERRORS = {
  DATA_STORE_URL_NOT_PROV: "dataStoreUrl not provided",
  DATA_STORE_URL_INVALID: "dataStoreUrl invalid",
  
  MOUNT_NAME_NOT_PROVIDED: "mountName not provided",
  MOUNT_NAME_INVALID: "mountName invalid",

  ELK_READ_ERROR: "ElasticSearch read error",

  // Internal function
  PROCESS_DATA_COULDNT_PROVIDED: 'processingData could not be provided',

  GENERAL_ERROR: "General processing error"
}

module.exports = ERRORS;
