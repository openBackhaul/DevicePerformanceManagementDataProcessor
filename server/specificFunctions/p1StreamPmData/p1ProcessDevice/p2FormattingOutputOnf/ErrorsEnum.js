const ERRORS = {
  PARAMETERS_NOT_PROVIDED: "parameters not provided",
  PARAMETERS_INVALID: "parameters invalid",
  RESULT_CC_NOT_PROVIDED: "resultCc not provided",
  RESULT_CC_INVALID: "resultCc invalid",
  ONF_OUTPUT_FORMAT: "onfOutputFormats could not be provided",
  GENERAL_ERROR: "General processing error",

  // Function "createOutputFromResultCc"
  OUTPUT_COULD_NOT_BE_PROVIDED: "output could not be provided",

  // Function "p1FieldsFilter"
  FILTER_INVALID: "Data structure could not be filtered according to the provided fields filter string"
};

module.exports = ERRORS;
