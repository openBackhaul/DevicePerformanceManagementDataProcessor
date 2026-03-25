
const ERRORS = require ('./ErrorsEnum');

let parameterStruct;

function checkOutOfRange(value, isTX) {

  let min = isTX ? parameterStruct["lower-tx-level-limit"] : parameterStruct["lower-rx-level-limit"];
  let max = isTX ? parameterStruct["upper-tx-level-limit"] : parameterStruct["upper-rx-level-limit"];

  if (value < min || value > max ) {
    return false;
  }

  return true;
}

const p1RemoveOutOfRangeLevels = (input) => {
  try {
    parameterStruct = input["parameters"];
    const performanceData = input["performance-data"];

    // Check paramenters
    if (!parameterStruct) {
      return ERRORS.PARAM_NOT_PROVIDED;
    } else {

      if (parameterStruct["lower-tx-level-limit"] == undefined || typeof parameterStruct["lower-tx-level-limit"] != "number") {
        return ERRORS.PARAM_INVALID;
      }

      if (parameterStruct["upper-tx-level-limit"] == undefined || typeof parameterStruct["upper-tx-level-limit"] != "number") {
        return ERRORS.PARAM_INVALID;
      }

      if (parameterStruct["lower-rx-level-limit"] == undefined || typeof parameterStruct["lower-rx-level-limit"] != "number") {
        return ERRORS.PARAM_INVALID;
      }

      if (parameterStruct["upper-rx-level-limit"] == undefined || typeof parameterStruct["upper-rx-level-limit"] != "number") {
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

    let performanceDataClean = performanceData;  // Initializate return value

    // TX Data
    if (!checkOutOfRange(performanceData["tx-level-min"], true)) {
      delete performanceDataClean["tx-level-min"];
    }

    if (!checkOutOfRange(performanceData["tx-level-max"], true)) {
      delete performanceDataClean["tx-level-min"];
    }

    if (!checkOutOfRange(performanceData["tx-level-avg"], true)) {
      delete performanceDataClean["tx-level-min"];
    }

    // RX Data
    if (!checkOutOfRange(performanceData["rx-level-min"], false)) {
      delete performanceDataClean["tx-level-min"];
    }

    if (!checkOutOfRange(performanceData["rx-level-max"], false)) {
      delete performanceDataClean["tx-level-min"];
    }

    if (!checkOutOfRange(performanceData["rx-level-avg"], false)) {
      delete performanceDataClean["tx-level-min"];
    }

    return {
      "performance-data": performanceDataClean
    }
  } catch (e) {
    return ERRORS.GENERAL_ERROR;
  }

}

module.exports = p1RemoveOutOfRangeLevels;