const { loadConfigFile } = require("../../utils/config");
const onfAdapter = require("../../infra/onf/onfAdapter.js");
const { loadFunctionParameters } = require("../../utils/functionTree");
const logger = require('./../../service/LoggingService.js').getLogger();
const { ERRORS, knownErrors } = require("./ErrorsEnum");

function isConfigSchemaValid(configFile) {
  if (!configFile || typeof configFile !== "object") {
    return false;
  }
  const controlConstruct = configFile["core-model-1-4:control-construct"] || configFile;
  const profileCollection = (controlConstruct || {})["profile-collection"] || {};
  return Array.isArray(profileCollection.profile);
}

/**
 * Request:
 * {
 *   functionName: "p1StreamPmData"
 * }
 *
 * Response:
 * {
 *   parameters: <function-tree>,
 *   configFile: <control-construct>
 * }
 */
async function run(request) {
  try {
    const functionName = request.functionName || request["function-name"];

    if (!functionName) {
      logger.error("functionName is not provided in the request");
      throw new Error(ERRORS.ERR_FUNCTION_NAME_NOT_PROVIDED);
    }

    let configFile = request.configFile || request["config-file"];

    if (!configFile) {
      /* configFile = await onfAdapter.readControlConstruct().catch((error) => {
        logger.error("Error occurred while reading control construct:", error);
        return error;
      }); */

      try {
        configFile = await onfAdapter.readControlConstruct();
      } catch (error) {
        logger.error("Error occurred while reading control construct from onfAdapter:", error);
        if (error instanceof SyntaxError) {
          logger.error("Control construct contains invalid JSON:", error);
          throw new Error(ERRORS.ERR_INVALID_JSON);
        }
        logger.error("Control construct is not accessible:", error);
        throw new Error(ERRORS.ERR_CONFIG_NOT_ACCESSIBLE);
      }
    }

    if (!configFile) {
    /*  configFile = loadConfigFile(); */

      try {
        configFile = loadConfigFile();
      } catch (error) {
        if (error instanceof SyntaxError) {
          logger.error("Config file contains invalid JSON:", error);
            throw new Error(ERRORS.ERR_INVALID_JSON);
        }
        logger.error("Error occurred while loading config file:", error);
        throw new Error(ERRORS.ERR_CONFIG_NOT_ACCESSIBLE);
      }
    }

    if (!isConfigSchemaValid(configFile)) {
      logger.error("Config file schema validation failed. Expected 'core-model-1-4:control-construct' with 'profile-collection.profile' array.");
      throw new Error(ERRORS.ERR_INVALID_SCHEMA);
    }

    /* const parameters = loadFunctionParameters(configFile, functionName); */

    let parameters;
    try {
      parameters = loadFunctionParameters(configFile, functionName);
    } catch (error) {
      const message = String((error && error.message) || "");
      if (message.includes("Function profile not found")) {
        logger.error(`Function profile not found for functionName: ${functionName}, error: ${message}`);
        throw new Error(ERRORS.ERR_FUNCTION_NOT_FOUND);
      }
      logger.error("Unexpected error occurred while loading function parameters:", error);
      throw error;
    }

    return {
      parameters,
      configFile
    };
  } catch (error) {
    const message = String((error && error.message) || "");
    if (knownErrors.has(message)) {
      logger.error(`Error in p1LoadParameters: ${message}`);
      throw new Error(message);
    } 
    logger.error("Unexpected error in p1LoadParameters:", error);
    throw new Error(ERRORS.ERR_UNKNOWN); 
  }
}

module.exports = { run };