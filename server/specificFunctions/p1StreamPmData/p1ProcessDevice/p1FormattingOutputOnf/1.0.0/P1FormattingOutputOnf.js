const ERRORS = require("./ErrorsEnum");

function p1FormattingOutputOnf(input) {
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

    if (resultCc === null || resultCc === undefined) {
      return ERRORS.RESULT_CC_NOT_PROVIDED;
    }
    if (typeof resultCc !== "object" || Array.isArray(resultCc)) {
      return ERRORS.RESULT_CC_INVALID;
    }

    const outputObj = createOutputFromResultCc(resultCc);
    if (outputObj == ERRORS.RESULT_CC_NOT_PROVIDED ||
      outputObj == ERRORS.RESULT_CC_INVALID) { // Handle errors
      return outputObj;
    }

    const fieldsFilter = extractFieldsFilter(parameters);
    if (fieldsFilter == ERRORS.FILTER_INVALID) {
      return ERRORS.FILTER_INVALID;
    }

    let finalOutput = outputObj;

    if (fieldsFilter) {
      finalOutput = applyFilter(outputObj, fieldsFilter.split("."));
    }

    return {
      "format-name": "onf-output-format",
      "output-format": finalOutput
    };

  } catch (error) {
    return ERRORS.GENERAL_ERROR;
  }
}

function createOutputFromResultCc(resultCc) {
  if (resultCc === null || resultCc === undefined) {
    return ERRORS.RESULT_CC_NOT_PROVIDED;
  }
  if (typeof resultCc !== "object" || Array.isArray(resultCc)) {
    return ERRORS.RESULT_CC_INVALID;
  }

  return JSON.parse(JSON.stringify(resultCc));
}

function extractFieldsFilter(parameters) {
  try {
    const subFunctions = parameters["sub-function"];
    if (!Array.isArray(subFunctions)) {
      return null;
    }

    const filterFn = subFunctions.find(
      fn => fn?.["function-name"] === "p1FieldsFilter"
    );
    if (!filterFn) {
      return null;
    }

    const params = filterFn.parameter;
    if (!Array.isArray(params)) {
      return null;
    }

    const fieldParam = params.find(
      p => p?.["parameter-name"] === "fieldsFilter"
    );

    const value = fieldParam?.value;
    return typeof value === "string" && value.trim() !== "" ? value : null;

  } catch {
    return ERRORS.FILTER_INVALID;
  }
}

function applyFilter(data, keys) {
  if (!keys.length) return data;

  const [currentKey, ...restKeys] = keys;

  if (Array.isArray(data)) {

    return data
      .map(item => applyFilter(item, keys))
      .filter(item => item !== undefined);
  }

  if (typeof data !== "object" || data === null) {
    return {};
  }

  if (!(currentKey in data)) {
    return {};
  }

  const next = data[currentKey];

  if (restKeys.length === 0) {
    return next;
  }

  return applyFilter(next, restKeys);
}


module.exports = {
  p1FormattingOutputOnf,
  _internal: {
    createOutputFromResultCc,
    extractFieldsFilter,
    applyFilter
  }
};