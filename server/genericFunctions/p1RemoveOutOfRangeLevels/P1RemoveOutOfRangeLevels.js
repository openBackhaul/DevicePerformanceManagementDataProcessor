
const ERRORS = require ('./ErrorsEnum');

let parameterStruct = {};
const paramAllowed = [
  "lower-tx-level-limit",
  "upper-tx-level-limit",
  "lower-rx-level-limit",
  "upper-rx-level-limit"
]

function checkOutOfRange(value, isTX) {

  let min = isTX ? parameterStruct["lower-tx-level-limit"] : parameterStruct["lower-rx-level-limit"];
  let max = isTX ? parameterStruct["upper-tx-level-limit"] : parameterStruct["upper-rx-level-limit"];

  if (value < min || value > max ) {
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

    if (!paramAllowed.includes(paramElem['parameter-name'])) {
      res = false;
    }

    if (typeof paramElem["value"] != "string") {
      res = false;
    }

    parameterStruct[paramElem['parameter-name']] = paramElem['value'];
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
<<<<<<< HEAD:genericFunctions/p1RemoveOutOfRangeLevels/1.0.0/P1RemoveOutOfRangeLevels.js
    if (!parameters || parameters['parameter'] == null) {
      return ERRORS.PARAM_NOT_PROVIDED;
    } else {
=======
    if (!parameters) {
      return ERRORS.PARAM_NOT_PROVIDED;
    } else {
      if (parameters['parameter'] == null) { 
        return ERRORS.PARAM_INVALID;
      }

>>>>>>> origin/siae/develop_1.0.0:server/genericFunctions/p1RemoveOutOfRangeLevels/P1RemoveOutOfRangeLevels.js
      let paramArray = parameters['parameter'];

      if (!validateParameters(paramArray)) {
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