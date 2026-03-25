const ERRORS = require('./ErrorsEnum');

let parameterStruct;

const p1RemoveOutOfRangeTemperature = (input) => {
  try {
    parameterStruct = input["parameters"];
    const equipmentsArray = input["equipment"];

    // Check paramenters
    if (!parameterStruct) {
      return ERRORS.PARAM_NOT_PROVIDED;
    } else {

      if (parameterStruct["lower-temperature-limit"] == undefined || typeof parameterStruct["lower-temperature-limit"] != "number") {
        return ERRORS.PARAM_INVALID;
      }

      if (parameterStruct["upper-temperature-limit"] == undefined || typeof parameterStruct["upper-temperature-limit"] != "number") {
        return ERRORS.PARAM_INVALID;
      }
    }

    if (!equipmentsArray) {
      return ERRORS.EQUIP_NOT_PROVIDED
    } else {
      for (let i=0; i < equipmentsArray.length; i++) {
        if (equipmentsArray[i]) {
          const equipData = equipmentsArray[i];

          if ((equipData["uuid"] == undefined) ||
            (equipData["uuid"] != undefined && typeof equipData["uuid"] != "string")) {
            return ERRORS.EQUIP_INVALID;
          }

          if ((equipData["actual-equipment"] == undefined) ||
             (equipData["actual-equipment"] != undefined && typeof equipData["actual-equipment"] != "object")) {
            return ERRORS.EQUIP_INVALID;
          }

          const actualEqp = equipData["actual-equipment"];
          if ((actualEqp["local-id"] == undefined) ||
            (actualEqp["local-id"] != undefined && typeof actualEqp["local-id"] != "string")) {
            return ERRORS.EQUIP_INVALID;
          }

          const physicalProps = actualEqp["physical-properties"];
          if ((physicalProps == undefined) ||
            (physicalProps != undefined && typeof physicalProps != "object")) {
            return ERRORS.EQUIP_INVALID;
          }

          if ((physicalProps["temperature"] == undefined) ||
            (physicalProps["temperature"] != undefined && typeof physicalProps["temperature"] != "string")) {
            return ERRORS.EQUIP_INVALID;
          }
        } else {
          return ERRORS.EQUIP_INVALID;
        }
      }
    }

    // Check values
    let lowParam = parameterStruct["lower-temperature-limit"].valueOf();
    let highParam = parameterStruct["upper-temperature-limit"].valueOf();

    // console.log(lowParam);
    // console.log(highParam);
    let equipClean = equipmentsArray;
    // console.log(equipClean);
    for (let i=0; i<equipClean.length; i++) {
      // console.log(equipClean[i]["actual-equipment"]["physical-properties"]["temperature"].valueOf());
      if (lowParam > equipClean[i]["actual-equipment"]["physical-properties"]["temperature"].valueOf() ||
        highParam < equipClean[i]["actual-equipment"]["physical-properties"]["temperature"].valueOf()) {
        // console.log("I need to delete something");
        delete equipClean[i]["actual-equipment"]["physical-properties"]["temperature"];
        // console.log(equipClean[i]["actual-equipment"]);
      }
      //  else {
      //   console.log(equipClean[i]["actual-equipment"]);
      //   console.log("nothing to delete");
      // }
    }

    // console.log(equipClean);
    return {
      "equipment": equipClean
    }
  } catch (e) {
    return ERRORS.GENERAL_ERROR;
  }

}

module.exports = p1RemoveOutOfRangeTemperature;
