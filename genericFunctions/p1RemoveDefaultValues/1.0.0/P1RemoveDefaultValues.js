
const ERRORS = require ('./ErrorsEnum');

const p1RemoveDefaultValues = (input) => {
  try {
    const parameters = input["parameters"];
    const inputObj = input["input-object"];
  } catch (e) {
    return ERRORS.GENERAL_ERROR;
  }

}

module.exports = p1RemoveDefaultValues;