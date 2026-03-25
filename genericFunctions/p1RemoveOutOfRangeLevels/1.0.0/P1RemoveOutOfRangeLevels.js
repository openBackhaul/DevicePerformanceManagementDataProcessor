
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
  parameterStruct = input["parameters"];
  const performanceData = input["performance-data"];

  // Check paramenters
  if (!parameterStruct) {
    return "parameters not provided";
  } else {

    if (parameterStruct["lower-tx-level-limit"] == undefined || typeof parameterStruct["lower-tx-level-limit"] != "number") {
      return "parameters invalid";
    }

    if (parameterStruct["upper-tx-level-limit"] == undefined || typeof parameterStruct["upper-tx-level-limit"] != "number") {
      return "parameters invalid";
    }

    if (parameterStruct["lower-rx-level-limit"] == undefined || typeof parameterStruct["lower-rx-level-limit"] != "number") {
      return "parameters invalid";
    }

    if (parameterStruct["upper-rx-level-limit"] == undefined || typeof parameterStruct["upper-rx-level-limit"] != "number") {
      return "parameters invalid";
    }
  }

  if (!performanceData) {
    return "performanceData not provided";
  } else {

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


  // TODO Manage the errors
  // enum:

  //   - 'performanceData not provided'
  //   - 'performanceData invalid'
  //   - 'General processing error'

  return {
    "performance-data": performanceDataClean
  }
}

module.exports = p1RemoveOutOfRangeLevels;