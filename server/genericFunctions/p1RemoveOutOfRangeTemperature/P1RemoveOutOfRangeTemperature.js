const ERRORS = require('./ErrorsEnum');

let parameterStruct = {};
const paramAllowed = [
  "lowerTemperatureLimit",
  "upperTemperatureLimit"
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
      res = false;
    }

    parameterStruct[paramElem['parameter-name']] = paramElem['value'];
  });

  paramAllowed.forEach(paramElem => {
    if (!parameterStruct.hasOwnProperty(paramElem)) {
      res = false;
    }
  });

  if (res) {
    if (parseInt(parameterStruct["lowerTemperatureLimit"]) > parseInt(parameterStruct["upperTemperatureLimit"])) {
      res = false;
    }
  }

  return res;
}

const p1RemoveOutOfRangeTemperature = (input) => {

  // Re-init variable everytime
  parameterStruct = {};

  try {

    const parameters = input["parameters"];
    const equipmentsArray = input["equipment"];

    // Check parameters
    if (!parameters && !equipmentsArray) {
      return ERRORS.GENERAL_ERROR;
    }

    if (!parameters) {
      return ERRORS.PARAM_NOT_PROVIDED;
    } else {
      if (parameters['parameter'] == null) {
        return ERRORS.PARAM_INVALID;
      }
      let paramArray = parameters['parameter'];

      if (!validateParameters(paramArray)) {
        return ERRORS.PARAM_INVALID;
      }
    }

    let res = "";
    if (!equipmentsArray) {
      return ERRORS.EQUIP_NOT_PROVIDED
    } else {
      if (!Array.isArray(equipmentsArray)) {
        return ERRORS.EQUIP_INVALID;
      }

      equipmentsArray.forEach(equipData => {
        if ((equipData["uuid"] == undefined) ||
          (equipData["uuid"] != undefined && typeof equipData["uuid"] != "string")) {
          res = ERRORS.EQUIP_INVALID;
        }

        if ((equipData["actual-equipment"] == undefined) ||
          (equipData["actual-equipment"] != undefined && typeof equipData["actual-equipment"] != "object")) {
          res = ERRORS.EQUIP_INVALID;
        }

        const actualEqp = equipData["actual-equipment"];
        if ((actualEqp["local-id"] == undefined) ||
          (actualEqp["local-id"] != undefined && typeof actualEqp["local-id"] != "string")) {
          res = ERRORS.EQUIP_INVALID;
        }

        const physicalProps = actualEqp["physical-properties"];
        if ((physicalProps == undefined) ||
          (physicalProps != undefined && typeof physicalProps != "object")) {
          res = ERRORS.EQUIP_INVALID;
        }

        if ((physicalProps["temperature"] == undefined) ||
          (physicalProps["temperature"] != undefined && typeof physicalProps["temperature"] != "string")) {
          res = ERRORS.EQUIP_INVALID;
        }
      });
    }

    if (res != "") {
      return res;
    }

    // Check values
    let lowParam = parseInt(parameterStruct["lowerTemperatureLimit"]);
    let highParam = parseInt(parameterStruct["upperTemperatureLimit"]);

    let equipClean = JSON.parse(JSON.stringify(equipmentsArray));

    for (let i = 0; i < equipClean.length; i++) {
      if (lowParam > parseInt(equipClean[i]["actual-equipment"]["physical-properties"]["temperature"]) ||
        highParam < parseInt(equipClean[i]["actual-equipment"]["physical-properties"]["temperature"])) {

        delete equipClean[i]["actual-equipment"]["physical-properties"]["temperature"];
      }
    }

    return {
      "equipment": equipClean
    };

  } catch (error) {
    return ERRORS.GENERAL_ERROR;
  }

}

module.exports = p1RemoveOutOfRangeTemperature;
