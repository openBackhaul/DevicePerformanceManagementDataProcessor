
const ERRORS = require('./ErrorsEnum');

let parameterStruct = {};
const LOWER_TX_LIMIT = "lower-tx-level-limit";
const UPPER_TX_LIMIT = "upper-tx-level-limit";
const LOWER_RX_LIMIT = "lower-rx-level-limit";
const UPPER_RX_LIMIT = "upper-rx-level-limit";
const paramAllowed = [
  LOWER_TX_LIMIT,
  UPPER_TX_LIMIT,
  LOWER_RX_LIMIT,
  UPPER_RX_LIMIT
];


function camelCaseToKebabCase(camelCaseString) {
  return camelCaseString
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([0-9])([^0-9])/g, '$1-$2')
    .replace(/([^0-9])([0-9])/g, '$1-$2')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function checkOutOfRange(value, isTX) {

  let min = isTX ? parameterStruct[LOWER_TX_LIMIT] : parameterStruct[LOWER_RX_LIMIT];
  let max = isTX ? parameterStruct[UPPER_TX_LIMIT] : parameterStruct[UPPER_RX_LIMIT];

  if (value < Number(min) || value > Number(max)) {
    return false;
  }

  return true;
}

function validateParameters(paramArray) {
  let res = true;
  paramArray.forEach(paramElem => {
    if (paramElem['parameter-name'] == null || paramElem['value'] == null) {
      res = false;
    }

    if (!paramAllowed.includes(camelCaseToKebabCase(paramElem['parameter-name']))) {
      res = false;
    }

    if (typeof paramElem["value"] != "string") {
      res = false;
    }

    parameterStruct[camelCaseToKebabCase(paramElem['parameter-name'])] = paramElem['value'];
  });

  paramAllowed.forEach(paramElem => {
    if (!parameterStruct.hasOwnProperty(paramElem)) {
      res = false;
    }
  });

  return res;
}

const p1RemoveOutOfRangeLevels = (input) => {

  // Re-init variable everytime
  parameterStruct = {};

  try {
    const parameters = input["parameters"];
    const performanceData = input["performance-data"];

    // Check parameters
    if (!parameters && !performanceData) {
      return ERRORS.GENERAL_ERROR;
    }

    if (!parameters) {
      return ERRORS.PARAM_NOT_PROVIDED;
    } else {
      if (parameters['parameter'] == null) {
        return ERRORS.PARAM_INVALID;
      }

      let paramArray = parameters["parameter"];

      if (!validateParameters(paramArray)) {
        return ERRORS.PARAM_INVALID;
      }

      if (Number(parameterStruct[LOWER_TX_LIMIT]) > Number(parameterStruct[UPPER_TX_LIMIT])) {
        return ERRORS.PARAM_INVALID;
      } else if (Number(parameterStruct[LOWER_RX_LIMIT]) > Number(parameterStruct[UPPER_RX_LIMIT])) {
        return ERRORS.PARAM_INVALID;
      }
    }

    if (!performanceData) {
      return ERRORS.PERF_NOT_PROVIDED;
    } else {

      // TX
      if (performanceData["tx-level-min"] == undefined || typeof performanceData["tx-level-min"] != "number") {
        return ERRORS.PERF_INVALID;
      }

      if (performanceData["tx-level-max"] == undefined || typeof performanceData["tx-level-max"] != "number") {
        return ERRORS.PERF_INVALID;
      }

      if (performanceData["tx-level-avg"] == undefined || typeof performanceData["tx-level-avg"] != "number") {
        return ERRORS.PERF_INVALID;
      }

      // RX
      if (performanceData["rx-level-min"] == undefined || typeof performanceData["rx-level-min"] != "number") {
        return ERRORS.PERF_INVALID;
      }

      if (performanceData["rx-level-max"] == undefined || typeof performanceData["rx-level-max"] != "number") {
        return ERRORS.PERF_INVALID;
      }

      if (performanceData["rx-level-avg"] == undefined || typeof performanceData["rx-level-avg"] != "number") {
        return ERRORS.PERF_INVALID;
      }
    }

    let performanceDataClean = JSON.parse(JSON.stringify(performanceData)); // Initializate return value

    // TX Data
    if (!checkOutOfRange(performanceData["tx-level-min"], true)) {
      delete performanceDataClean["tx-level-min"];
    }

    if (!checkOutOfRange(performanceData["tx-level-max"], true)) {
      delete performanceDataClean["tx-level-max"];
    }

    if (!checkOutOfRange(performanceData["tx-level-avg"], true)) {
      delete performanceDataClean["tx-level-avg"];
    }

    // RX Data
    if (!checkOutOfRange(performanceData["rx-level-min"], false)) {
      delete performanceDataClean["rx-level-min"];
    }

    if (!checkOutOfRange(performanceData["rx-level-max"], false)) {
      delete performanceDataClean["rx-level-max"];
    }

    if (!checkOutOfRange(performanceData["rx-level-avg"], false)) {
      delete performanceDataClean["rx-level-avg"];
    }

    return {
      "performance-data": performanceDataClean
    }
  } catch (e) {
    return ERRORS.GENERAL_ERROR;
  }

}

module.exports = p1RemoveOutOfRangeLevels;