const { readEsAddress } = require("../../utils/ltpResolution");
const ERRORS = require("./ErrorsEnum");

/**
 * Request:
 * {
 *   parameters: <function-tree>,
 *   configFile: <control-construct>,
 *   esName: "mwdiEsClient"
 * }
 *
 * Response:
 * {
 *   esAddress: {
 *     uuid,
 *     node,
 *     "index-alias",
 *     "api-key"
 *   }
 * }
 */
async function run(request) {
  if (!request || typeof request !== "object") {
    throw new Error(ERRORS.UNKNOWN_ERROR_OCCURRED);
  }

  const { parameters, configFile, esName } = request;

  // try{
  //     if (parameters === undefined || parameters === null) {
  //     throw new Error(ERRORS.PARAMETERS_MISSING);
  //   }
  //   if (typeof parameters !== "object" || Array.isArray(parameters)) {
  //     throw new Error(ERRORS.PARAMETERS_INVALID);
  //   }
  
  //   if (configFile === undefined || configFile === null) {
  //     throw new Error(ERRORS.CONFIG_FILE_MISSING);
  //   }
  //   if (typeof configFile !== "object" || Array.isArray(configFile)) {
  //     throw new Error(ERRORS.CONFIG_FILE_INVALID);
  //   }
  //   if (typeof esName !== "string" || esName.trim() === "") {
  //   throw new Error(ERRORS.ES_NAME_NOT_FOUND_IN_PARAMETERS);
  // }
  // }catch(e){
  //   if (ERRORS.knownErrors.has(e.message)) {
  //     throw e;
  //   } 
  //   throw new Error(ERRORS.UNKNOWN_ERROR_OCCURRED);
  // }

  // if (!parameters || !configFile || !esName) {
  //   throw new Error(ERRORS.UNKNOWN_ERROR_OCCURRED);
  // }

  if (
    parameters === undefined || parameters === null ||
    configFile === undefined || configFile === null ||
    typeof esName !== "string" || esName.trim() === ""
  ) {
    throw new Error(ERRORS.UNKNOWN_ERROR_OCCURRED);
  }

  const parameterList = Array.isArray(parameters.parameter) ? parameters.parameter : [];
  const parameterEntry = parameterList.find(
    (item) => item["parameter-name"] === esName
  );

  if (!parameterEntry) {
    throw new Error(ERRORS.ES_NAME_NOT_FOUND_IN_PARAMETERS);
  }

  try {
    const esAddress = await readEsAddress(configFile, parameterEntry.value);
    return { esAddress };
  } catch (e) {
    if (ERRORS.knownErrors.has(e.message)) {
      throw e;
    }
    throw new Error(ERRORS.UNKNOWN_ERROR_OCCURRED);
  }
}

module.exports = { run };