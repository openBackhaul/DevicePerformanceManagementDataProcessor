const ERRORS = {
  INPUT_DATA_MISSING_OR_INVALID: "Input data missing or invalid",
  MOUNT_NAME_NOT_FOUND: "Mount name not found",
  PARAMETERS_MISSING_OR_INVALID: "Parameters missing or invalid",
  CONFIG_FILE_MISSING_OR_INVALID: "Config file missing or invalid",
  RAW_CC_DATA_MISSING_OR_INVALID: "Raw CC data missing or invalid",
  RESULT_CC_DATA_MISSING_OR_INVALID: "Result CC data missing or invalid",
  OUTPUT_FORMAT_MISSING_OR_INVALID: "Output format missing or invalid",
  KAFKA_TRANSMISSION_FAILED: "Kafka transmission failed",
  STORING_RESULT_CC_FAILED: "Storing resultCc failed",
  GENERAL_PROCESSING_ERROR: "General processing error"
};

ERRORS.knownErrors = new Set(Object.values(ERRORS));

module.exports = ERRORS;
