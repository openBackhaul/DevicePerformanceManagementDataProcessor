const ERRORS = {
  KAFKA_CONNECTION_LIST_NOT_PROVIDED: "kafkaConnectionList not provided",
  KAFKA_CONNECTION_LIST_INVALID: "kafkaConnectionList invalid",
  OUTPUT_FORMAT_NOT_PROVIDED: "outputFormat not provided",
  OUTPUT_FORMAT_INVALID: "outputFormat invalid",
  PRODUCER_CONNECTION_ERROR: "Producer connection error",
  OTHER_TRANSMISSION_ERROR: "Other transmission error",
  GENERAL_PROCESSING_ERROR: "General processing error",
};

ERRORS.knownErrors = new Set(Object.values(ERRORS));

module.exports = ERRORS;

