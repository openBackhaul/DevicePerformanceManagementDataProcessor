const ERRORS = require("./ErrorsEnum");

function p1FormattingOutputOnf(input) {
  try {

    if (input === null || input === undefined) {
      throw ERRORS.PARAMETERS_NOT_PROVIDED;
    }

    const { parameters, "result-cc": resultCc } = input;

    if (parameters === null || parameters === undefined) {
      throw ERRORS.PARAMETERS_NOT_PROVIDED;
    }
    if (typeof parameters !== "object" || Array.isArray(parameters)) {
      throw ERRORS.PARAMETERS_INVALID;
    }

    if (resultCc === null || resultCc === undefined) {
      throw ERRORS.RESULT_CC_NOT_PROVIDED;
    }
    if (typeof resultCc !== "object" || Array.isArray(resultCc)) {
      throw ERRORS.RESULT_CC_INVALID;
    }

    const outputObj = createOutputFromResultCc(resultCc);
    const fieldsFilter = extractFieldsFilter(parameters);

    let finalOutput = outputObj;

    if (fieldsFilter) {
      finalOutput = applyFilter(outputObj, fieldsFilter.split("."));
    }

    return {
      "format-name": "onf-output-format",
      "output-format": finalOutput
    };

  } catch (err) {
    return Object.values(ERRORS).includes(err)
      ? err
      : ERRORS.GENERAL_ERROR;
  }
}



function createOutputFromResultCc(resultCc) {
  if (resultCc === null || resultCc === undefined) {
    throw ERRORS.RESULT_CC_NOT_PROVIDED;
  }
  if (typeof resultCc !== "object" || Array.isArray(resultCc)) {
    throw ERRORS.RESULT_CC_INVALID;
  }

  return JSON.parse(JSON.stringify(resultCc)); 
}


function extractFieldsFilter(parameters) {
  try {
    const subFunctions = parameters["sub-function"];
    if (!Array.isArray(subFunctions)) return null;

    const filterFn = subFunctions.find(
      fn => fn?.["function-name"] === "p1FieldsFilter"
    );
    if (!filterFn) return null;

    const params = filterFn.parameter;
    if (!Array.isArray(params)) return null;

    const fieldParam = params.find(
      p => p?.["parameter-name"] === "fieldsFilter"
    );

    const value = fieldParam?.value;
    return typeof value === "string" && value.trim() !== "" ? value : null;

  } catch {
    return null;
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