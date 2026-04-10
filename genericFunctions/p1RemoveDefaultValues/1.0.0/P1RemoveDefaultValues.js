
const ERRORS = require ('./ErrorsEnum');

const p1RemoveDefaultValues = (input) => {
  let defaultValuesList =[];
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
      defaultValuesList.push({
        'attribute-name': key,
        'attribute-value': value
      });
    }

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