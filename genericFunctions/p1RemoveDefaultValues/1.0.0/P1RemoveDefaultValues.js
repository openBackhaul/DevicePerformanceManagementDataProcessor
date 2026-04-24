
const ERRORS = require ('./ErrorsEnum');

let defaultValuesList = [];

function validateParameters(paramArray) {
  let res = true;
  paramArray.forEach(paramElem => {
    if (paramElem['parameter-name'] == null || paramElem['value'] == null) {
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

    const tempStruct = {};
    tempStruct[paramElem['parameter-name']] = paramElem['value'];
    defaultValuesList.push(tempStruct);
  });

  return res;
}

const p1RemoveDefaultValues = (input) => {

  try {
    if (input == null || Object.keys(input).length == 0) {
      return ERRORS.GENERAL_ERROR;
    }

    const parameters = input["parameters"];
    const inputObj = input["input-object"];
    if (parameters == undefined && inputObj == undefined) {
      return ERRORS.GENERAL_ERROR;
    } else if (parameters == undefined) {
      return ERRORS.PARAM_NOT_PROVIDED;
    } else if (inputObj == undefined) {
      return ERRORS.INPUTOBJ_NOT_PROVIDED;
    } else {
      if (Object.keys(parameters).length === 0 && Object.keys(inputObj).length === 0) {
        return ERRORS.GENERAL_ERROR;
      } else if (Object.keys(parameters).length === 0) {
        return ERRORS.PARAM_INVALID;
      } else if (Object.keys(inputObj).length === 0) {
        return ERRORS.INPUTOBJ_INVALID;
      }
    }
    
    // Check parameters
    if (!parameters || parameters['parameter'] == null) {
      return ERRORS.PARAM_NOT_PROVIDED;
    } else {
      let paramArray = parameters['parameter'];

      if (!validateParameters(paramArray)) {
        return ERRORS.PARAM_INVALID;
      }
    }

    if (inputObj === undefined) {
      return ERRORS.INPUTOBJ_NOT_PROVIDED;
    }

    if (Object.keys(inputObj).length === 0 && Object.keys(parameters).length === 0) {
      return ERRORS.GENERAL_ERROR;
    } else if (Object.keys(inputObj).length === 0) {
      return ERRORS.INPUTOBJ_INVALID;
    } else if (Object.keys(parameters).length === 0) {
      return ERRORS.PARAMS_INVALID;
    }

    // // Fill default key list
    // for (const [key, value] of Object.entries(parameters)) {
    //   defaultValuesList.push({
    //     'attribute-name': key,
    //     'attribute-value': value
    //   });
    // }

    let cleanedObject = JSON.parse(JSON.stringify(inputObj)); // Initializate return value

    for (const [key, value] of Object.entries(parameters)) {
      if (cleanedObject[key] != undefined) {
        if (cleanedObject[key] == value) {
          delete cleanedObject[key];
        }
      }
    }

    return {
      "cleaned-object": cleanedObject
    };
  } catch (e) {
    return ERRORS.GENERAL_ERROR;
  }

}

module.exports = p1RemoveDefaultValues;