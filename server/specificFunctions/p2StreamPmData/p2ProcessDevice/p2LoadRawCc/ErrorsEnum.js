const ERRORS = {
  PARAMETERS_NOT_PROVIDED: 'parameters not provided',
  PARAMETERS_INVALID: 'parameters invalid',
  MWDI_REPLICA_ES_CLIENT_NOT_PROVIDED: 'mwdiReplicaEsClient not provided',
  MWDI_REPLICA_ES_CLIENT_INVALID: 'mwdiReplicaEsClient invalid',
  DATA_STORE_ES_CLIENT_NOT_PROVIDED: 'dataStoreEsClient not provided',
  DATA_STORE_ES_CLIENT_INVALID: 'dataStoreEsClient invalid',
  MOUNT_NAME_NOT_PROVIDED: 'mountName not provided',
  MOUNT_NAME_INVALID: 'mountName invalid',
  RAW_CC_COULD_NOT_BE_PROVIDED: 'rawCc could not be provided',
  GENERAL_PROCESSING_ERROR: 'General processing error'
};

ERRORS.knownErrors = new Set(Object.values(ERRORS));

module.exports = ERRORS;
