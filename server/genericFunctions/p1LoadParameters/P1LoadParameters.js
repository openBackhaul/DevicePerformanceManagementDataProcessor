const { loadConfigFile } = require("../../utils/config");
const onfAdapter = require("../../infra/onf/onfAdapter.js");
const { loadFunctionParameters } = require("../../utils/functionTree");
const logger = require('./../../service/LoggingService.js').getLogger();

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
  const functionName = request.functionName || request["function-name"];

  if (!functionName) {
    throw new Error("functionName is mandatory");
  }

  let configFile = request.configFile || request["config-file"];

  if (!configFile) {
    configFile = await onfAdapter.readControlConstruct().catch((error) => {
      logger.error("Error occurred while reading control construct:", error);
      return error;
    });
  }

  if (!configFile) {
    configFile = loadConfigFile();
  }

  const parameters = loadFunctionParameters(configFile, functionName);

  return {
    parameters,
    configFile
  };
}

module.exports = { run };