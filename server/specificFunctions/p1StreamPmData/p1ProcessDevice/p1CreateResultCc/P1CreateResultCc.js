const p1RemoveOutOfRangeTemperature = require("../../../../genericFunctions/p1RemoveOutOfRangeTemperature/P1RemoveOutOfRangeTemperature");
const { getParamFromFunction } = require("../../../../utils/functionTree");
const ERRORS = require('../../../../genericFunctions/p1RemoveOutOfRangeTemperature/ErrorsEnum');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getRemoveOutOfRangeTemperatureParameters(parameters) {
  const temperatureFunctionNode = getParamFromFunction(
    parameters,
    "p1RemoveOutOfRangeTemperature",
    "",
    [],
    true
  );

  if (!temperatureFunctionNode) {
    const error = new Error(
      "p1RemoveOutOfRangeTemperature parameters not found"
    );

    error.stage = "p1RemoveOutOfRangeTemperature";
    error.vendorResponse = "parameters not provided";
    error.retryable = false;

    throw error;
  }

  return temperatureFunctionNode;
}

function isValidRemoveTemperatureResponse(response) {
  return (
    response &&
    typeof response === "object" &&
    Array.isArray(response["equipment"])
  );
}

function buildRemoveTemperatureError(response, mountName) {
  const error = new Error(
    `p1RemoveOutOfRangeTemperature returned error response: ${JSON.stringify(response)}`
  );

  error.stage = "p1RemoveOutOfRangeTemperature";
  error.vendorResponse = response;
  error.mountName = mountName;

  if (
    response === ERRORS.PARAM_NOT_PROVIDED ||
    response === ERRORS.PARAM_INVALID ||
    response === ERRORS.EQUIP_NOT_PROVIDED ||
    response === ERRORS.EQUIP_INVALID
  ) {
    error.retryable = false;
  } else {
    error.retryable = true;
  }

  return error;
}

/**
 * Request:
 * {
 *   parameters,
 *   rawCc
 * }
 *
 * Response:
 * {
 *   resultCc,
 *   interfaceMetadataList
 * }
 */
async function run(request) {
  try {
    const { parameters, rawCc, mountName, logger } = request;

    if (!parameters || !rawCc) {
      logger.error(
          {
            label: "invalid-input", 
            mountName
          },
          "Invalid input: parameters and rawCc are mandatory"
        );
      throw new Error("parameters and rawCc are mandatory");
    }

    const resultCc = clone(rawCc);
    const response = await p1RemoveOutOfRangeTemperature({
        equipment: resultCc["equipment"],
        parameters: {parameter: getRemoveOutOfRangeTemperatureParameters(parameters)}
    });

    if (!isValidRemoveTemperatureResponse(response)) {
        if (logger && logger.error) {
            logger.error(
            {
                label: "p1-remove-out-of-range-temperature-error",
                mountName,
                vendorResponse: response
            },
            "p1RemoveOutOfRangeTemperature returned an error response"
            );
        }

        throw buildRemoveTemperatureError(response, mountName);
    }

    resultCc["equipment"] = response["equipment"];

    const interfaceMetadataList = [];

    //resultCc["interface-metadata-list"] = interfaceMetadataList;

    return {
      resultCc,
      interfaceMetadataList,
      mountName
    };
  } catch (error) {
    error.stage = "p1CreateResultCc";
    logger.error(
        {
          label: "process-device-p1CreateResultCc",
          error: error.message || error
        },
        "Failed to process device in p1CreateResultCc"
    );
    throw error;
  }
}

module.exports = { run };