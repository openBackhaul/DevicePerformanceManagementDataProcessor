
let parameterStruct;

// function checkOutOfRange(value, isTX) {

//   let min = isTX ? parameterStruct["lower-tx-level-limit"] : parameterStruct["lower-rx-level-limit"];
//   let max = isTX ? parameterStruct["upper-tx-level-limit"] : parameterStruct["upper-rx-level-limit"];

//   if (value < min || value > max ) {
//     return false;
//   }

//   return true;
// }

const p1RemoveOutOfRangeTemperature = (input) => {
  try {
    parameterStruct = input["parameters"];
    const equipmentsArray = input["equipment"];

    // Check paramenters
    if (!parameterStruct) {
      return "parameters not provided";
    } else {

      if (parameterStruct["lower-temperature-limit"] == undefined || typeof parameterStruct["lower-temperature-limit"] != "number") {
        return "parameters invalid";
      }

      if (parameterStruct["upper-temperature-limit"] == undefined || typeof parameterStruct["upper-temperature-limit"] != "number") {
        return "parameters invalid";
      }
    }

    if (!equipmentsArray) {
      return "equipment not provided";
    } else {
      // for(let equipment in equipmentsArray) {
      //   console.log(equipment);
      // }
    }

  //      {
  //   "uuid": "AGS-20 IDU",
  //   "is-field-replaceable": false,
  //   "local-id": "AGS-20 Dual-IF 16xE1 XG",
  //   "lifecycle-state": "core-model-1-4:LIFECYCLE_STATE_INSTALLED",
  //   "operational-state": "core-model-1-4:OPERATIONAL_STATE_ENABLED",
  //   "actual-equipment": {
  //     "local-id": "513250006+",
  //     "lifecycle-state": "core-model-1-4:LIFECYCLE_STATE_INSTALLED",
  //     "operational-state": "core-model-1-4:OPERATIONAL_STATE_ENABLED",
  //     "physical-properties": {
  //       "temperature": "32"
  //     },
  //   },
  // },

    // let performanceDataClean = performanceData;  // Initializate return value


    return {
      "performance-data": performanceDataClean
    }
  } catch (e) {
    return "General processing error";
  }

}

module.exports = p1RemoveOutOfRangeTemperature;

  // - 'equipment invalid'
  // - 'General processing error'