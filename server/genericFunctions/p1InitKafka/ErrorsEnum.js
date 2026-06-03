const ERRORS = {
  PARAMETERS_MISSING: 'parameters missing',
  PARAMETERS_INVALID: 'parameters invalid',
  CONFIG_FILE_MISSING: 'config-file missing',
  CONFIG_FILE_INVALID: 'config-file invalid',
  KAFKA_ADDRESS_COULD_NOT_BE_RESOLVED: 'Kafka address could not be resolved',
  KAFKA_SESSION_INITIALIZATION_FAILED: 'Kafka session initialization failed',
  PRODUCER_CONNECTION_TO_KAFKA_FAILED: 'Producer connection to kafka failed',
  // CONSUMER_CONNECTION_TO_KAFKA_FAILED: 'Consumer connection to kafka failed',
  GENERAL_PROCESSING_ERROR: 'General processing error'
};

ERRORS.knownErrors = new Set(Object.values(ERRORS));

module.exports = ERRORS;
