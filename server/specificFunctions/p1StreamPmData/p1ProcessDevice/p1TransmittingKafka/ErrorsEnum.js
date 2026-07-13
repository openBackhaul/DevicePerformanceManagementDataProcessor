const ERRORS = {
  PARAMETERS_NOT_PROVIDED: "parameters not provided",
  PARAMETERS_INVALID: "parameters invalid",
  CONFIG_FILE_NOT_PROVIDED: "configFile not provided",
  CONFIG_FILE_INVALID: "configFile invalid",
  OUTPUT_FORMAT_NOT_PROVIDED: "outputFormat not provided",
  OUTPUT_FORMAT_INVALID: "outputFormat invalid",
  PRODUCER_CONNECTION_ERROR: "Producer connection error",
  OTHER_TRANSMISSION_ERROR: "Other transmission error",
  GENERAL_PROCESSING_ERROR: "General processing error",
};

ERRORS.knownErrors = new Set(Object.values(ERRORS));

module.exports = ERRORS;

