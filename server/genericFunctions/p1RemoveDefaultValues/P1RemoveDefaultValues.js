
const ERRORS = require('./ErrorsEnum');

let defaultValuesList = [];

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

function validateParameters(paramArray) {
  let res = true;
  paramArray.forEach(paramElem => {
    if (paramElem['parameter-name'] == null || paramElem['value'] == null) {
      res = false;
    }

    if (typeof paramElem["value"] != "string") {
      res = false;
    }

    const tempStruct = {};
    tempStruct[camelCaseToKebabCase(paramElem['parameter-name'])] = paramElem['value'];
    defaultValuesList.push(tempStruct);
  });

  return res;
}

const p1RemoveDefaultValues = (input) => {

  // Re-init variable everytime
  defaultValuesList = [];

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
      } else if (!parameters.hasOwnProperty('parameter')) {
        return ERRORS.PARAM_INVALID;
      } else if (!Array.isArray(parameters['parameter'])) {
        return ERRORS.PARAM_INVALID;
      } else if (parameters['parameter'].length === 0) {
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

    let cleanedObject = JSON.parse(JSON.stringify(inputObj)); // Initializate return value

    defaultValuesList.forEach(defaultValue => {
      const key = Object.keys(defaultValue);

      if (cleanedObject.hasOwnProperty(key) &&
        cleanedObject[key] == defaultValue[key]) {
        delete cleanedObject[key];
      }
    })

    return {
      "cleaned-object": cleanedObject
    };
  } catch (e) {
    return ERRORS.GENERAL_ERROR;
  }

}

module.exports = p1RemoveDefaultValues;