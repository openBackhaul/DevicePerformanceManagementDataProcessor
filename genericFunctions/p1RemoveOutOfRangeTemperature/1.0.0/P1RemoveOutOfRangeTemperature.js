const ERRORS = require('./ErrorsEnum');

let parameterStruct = {};
const paramAllowed = [
  "lower-temperature-limit",
  "upper-temperature-limit"
]

// DAMN JavaScript
function isThisNaN(value) {
  return value !== value
};

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

    let paramValue = parseInt(paramElem["value"]);

    // Check if is Number or also NaN
    if (typeof paramValue != "number" || isThisNaN(paramValue)) {
      return ERRORS.PARAM_INVALID;
    }

    parameterStruct[paramElem['parameter-name']] = paramElem['value'];
  });

  return res;
}

const p1RemoveOutOfRangeTemperature = (input) => {
  try {
    const parameters = input["parameters"];
    const equipmentsArray = input["equipment"];

    // Check parameters
    if (!parameters || parameters['parameter'] == null) {
      return ERRORS.PARAM_NOT_PROVIDED;
    } else {
      let paramArray = parameters['parameter'];

      if (!validateParameters(paramArray)) {
        return ERRORS.PARAM_INVALID;
      }
    }

    if (!equipmentsArray) {
      return ERRORS.EQUIP_NOT_PROVIDED
    } else {
      for (let i = 0; i < equipmentsArray.length; i++) {
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
    let lowParam = parseInt(parameterStruct["lower-temperature-limit"]);
    let highParam = parseInt(parameterStruct["upper-temperature-limit"]);

    let equipClean = JSON.parse(JSON.stringify(equipmentsArray));

    for (let i = 0; i < equipClean.length; i++) {
      if (lowParam > parseInt(equipClean[i]["actual-equipment"]["physical-properties"]["temperature"]) ||
        highParam < parseInt(equipClean[i]["actual-equipment"]["physical-properties"]["temperature"])) {

        delete equipClean[i]["actual-equipment"]["physical-properties"]["temperature"];
      }
    }

    return {
      "equipment": equipClean
    }
  } catch (e) {
    return ERRORS.GENERAL_ERROR;
  }

}

module.exports = p1RemoveOutOfRangeTemperature;
