
const ERRORS = require ('./ErrorsEnum');

let defaultValuesList =[];

const p1RemoveDefaultValues = (input) => {
  try {
    const parameters = input["parameters"];
    const inputObj = input["input-object"];

    // Starting parameter validation
    if (parameters === undefined && inputObj == undefined) {
      return ERRORS.GENERAL_ERROR
    }

    if (parameters === undefined) {
      return ERRORS.PARAMS_NOT_PROVIDED;
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

    // Fill default key list
    for (const [key, value] of Object.entries(parameters)) {
      if (defaultValuesList.includes({ 'attribute-name': key, 'attribute-value': value })) {
        console.log("Parameter already present: " + key);
      } else {
        console.log("Add the parameter: " + key);
      }
    }

    let cleanedObject = JSON.parse(JSON.stringify(inputObj)); // Initializate return value

    for (const [key, value] of Object.entries(parameters)) {
      console.log(`${key}: ${value}`);
      if (cleanedObject[key] != undefined) {
        if (cleanedObject[key] == value) {
          console.log("Remove parameter: " + key);
          delete cleanedObject[key];
        } else {
          console.log("Keep the parameter: " + key);
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