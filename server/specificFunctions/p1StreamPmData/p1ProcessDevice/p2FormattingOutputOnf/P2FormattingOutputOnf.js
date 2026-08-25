const ERRORS = require("./ErrorsEnum");

const ONF_FORMAT = "onf-output-format";

function p2FormattingOutputOnf(input) {
  try {

    if (input === null || input === undefined) {
      return ERRORS.PARAMETERS_NOT_PROVIDED;
    }

    const { parameters, "result-cc": resultCc } = input;

    if (parameters === null || parameters === undefined) {
      return ERRORS.PARAMETERS_NOT_PROVIDED;
    }
    if (typeof parameters !== "object" || Array.isArray(parameters)) {
      return ERRORS.PARAMETERS_INVALID;
    }
    // else if (parameters['parameter'] == null) { // || !Array.isArray(parameters['parameter'])) {
    //   return ERRORS.PARAMETERS_INVALID;
    // }

    if (resultCc === null || resultCc === undefined) {
      return ERRORS.RESULT_CC_NOT_PROVIDED;
    }
    if (typeof resultCc !== "object" || Array.isArray(resultCc)) {
      return ERRORS.RESULT_CC_INVALID;
    }

  } catch (error) {
    return ERRORS.GENERAL_ERROR;
  }
}

module.exports = p2FormattingOutputOnf;
