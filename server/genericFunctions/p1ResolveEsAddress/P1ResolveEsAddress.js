const { readEsAddress } = require("../../utils/ltpResolution");

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
  const { parameters, configFile, esName } = request;

  if (!parameters || !configFile || !esName) {
    throw new Error("parameters, configFile and esName are mandatory");
  }

  const parameterEntry = (parameters.parameter || []).find(
    (item) => item["parameter-name"] === esName
  );

  if (!parameterEntry) {
    throw new Error("ES parameter not found for " + esName);
  }

  const esAddress = await readEsAddress(configFile, parameterEntry.value);

  return { esAddress };
}

module.exports = { run };