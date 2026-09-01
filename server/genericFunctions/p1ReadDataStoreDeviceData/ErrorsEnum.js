const ERRORS = {
  DATA_STORE_NOT_PROVIDED: "dataStoreUrl not provided",
  DATA_STORE_INVALID: "dataStoreUrl invalid",

  MOUNTNAME_NOT_PROVIDED: "mountName not provided",
  MOUNTNAME_INVALID: "mountName invalid",
  MOUNTNAME_NOT_FOUND: "mountName not found in DataStore",

  ELK_READ_ERROR: "ElasticSearch read error",
  
  GENERAL_ERROR: "general processing error"
}

module.exports = ERRORS;
