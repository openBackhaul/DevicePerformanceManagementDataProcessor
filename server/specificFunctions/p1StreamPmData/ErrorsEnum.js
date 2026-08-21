const ERRORS = {
  PARAMETERS_NOT_PROVIDED: "Parameters could not be loaded",
  PARAMETERS_INVALID: "Parameters missing or invalid",
  CONFIG_FILE_NOT_PROVIDED: "Config file missing or invalid",
  CONFIG_FILE_INVALID: "Config file missing or invalid",
  ES_ADDRESS_NOT_RESOLVED: "ES address could not be resolved",
  KAFKA_SESSION_NOT_ESTABLISHED: "Kafka session could not be established",
  GENERAL_PROCESSING_ERROR: "General processing error"
};

ERRORS.knownErrors = new Set(Object.values(ERRORS));

module.exports = ERRORS;
