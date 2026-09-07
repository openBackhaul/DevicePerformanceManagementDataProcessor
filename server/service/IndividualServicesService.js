"use strict";

const logger = require("./LoggingService.js").getLogger();
const {
  validateInput,
  getMwdiURL,
  getCustomHeaders,
  validateMWDIResponse,
  validateConnectionStatus,
  ERRORS,
} = require("./individualServices/initiatePmDataUpdate/util.js");

var p1LoadParameters = require('../genericFunctions/p1LoadParameters/P1LoadParameters');
var p1DocumentFunction = require('../genericFunctions/p1DocumentFunction/P1DocumentFunction');// TODO
var { getParamFromFunction, findFunctionNode } = require('../utils/functionTree');


/**
 * Initiates process of embedding a new release
 *
 * body V1_bequeathyourdataanddie_body
 * user String User identifier from the system starting the service call
 * originator String 'Identification for the system consuming the API, as defined in  [/core-model-1-4:control-construct/logical-termination-point={uuid}/layer-protocol=0/http-client-interface-1-0:http-client-interface-pac/http-client-interface-configuration/application-name]'
 * xCorrelator String UUID for the service execution flow that allows to correlate requests and responses
 * traceIndicator String Sequence of request numbers along the flow
 * customerJourney String Holds information supporting customer's journey to which the execution applies
 * no response value expected for this operation
 **/
exports.bequeathYourDataAndDie = function (body, user, originator, xCorrelator, traceIndicator, customerJourney) {
  return new Promise(function (resolve, reject) {
    resolve();
  });
};

/**
 * Updates PM data for the specified devices.
 */

exports.initiatePmDataUpdate = async function (body, user, originator, xCorrelator, traceIndicator, customerJourney) {
  try {
    logger.debug(body, `Received mountsList from initiatePmDataUpdate:`);

    // 1. Input validation test: check if body is valid and contains required fields
    const validationError = validateInput(body);
    if (validationError) {
      throw new Error(`Validation error: ${validationError}`);
    }

    // 2. Retrieve URL and headers
    const mwdiUrl = getMwdiURL();
    const requestHeaders = {
      ...getCustomHeaders(),
      ...(body._headers || {}),
    };
    // 3. Call MWDI REST API to get device status metadata
    const mwdiResponse = await fetch(mwdiUrl, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({
        "mount-name-list": body["mount-names"],
      }),
    });
    if (!mwdiResponse.ok) {
      throw new Error(ERRORS.MWDI_CONNECTION_FAILED);
    }
    const responseData = await mwdiResponse.json();
    logger.debug(responseData, `MWDI Received response for provideDeviceStatusMetadata:`);
    // 5. Validate the MWDI response
    const responseError = validateMWDIResponse(responseData);
    if (responseError) {
      throw new Error(ERRORS.MWDI_CONNECTION_FAILED);
    }
    // 6. Extract the metadata array (handle both direct array and wrapped response formats)
    const metadataArrayMWDI = Array.isArray(responseData)
      ? responseData
      : responseData["device-status-metadata"];
    // 7. Verify mount names match
    const inputMountNames = body["mount-names"].sort();
    const returnedMountNamesMWDI = metadataArrayMWDI
      .map((item) => item["mount-name"])
      .sort();
    const mountNameDiscrepancy =
      JSON.stringify(inputMountNames) !==
      JSON.stringify(returnedMountNamesMWDI);
    logger.info(`Validation mountNameDiscrepancy: ${mountNameDiscrepancy}`);
    // Handle error 533: Mount name discrepancy
    if (mountNameDiscrepancy) {
      // Find missing mount names (in input but not in response)
      const returnedSet = new Set(returnedMountNamesMWDI);
      const missingMountNames = inputMountNames.filter(
        (name) => !returnedSet.has(name),
      );

      logger.error(missingMountNames, `Mount name discrepancy detected. Missing mount names`);

      // Throw error with code 533 and missing mount names
      const error533 = {
        code: 533,
        message: ERRORS.MOUNT_NAME_DISCREPANCY,
        "missing-mount-names": missingMountNames,
      };

      throw error533;
    }
    // 8. Validate that all requested devices are connected and available
    const connectionStatusError = validateConnectionStatus(
      metadataArrayMWDI,
      inputMountNames,
    );
    if (connectionStatusError) {
      logger.error(connectionStatusError.unconnectedMountNames, `Unconnected mounts detected: `);
      // Throw error with code 532 and unconnected mount names
      const error532 = {
        code: 532,
        message: ERRORS.UNCONNECTED_MOUNTS,
        "unconnected-mount-names": connectionStatusError.unconnectedMountNames,
      };

      throw error532;
    }

    logger.info("All validations passed");
    // 9. Check whether a PM data update is required (15-minute threshold)
    // Classify mount names based on the last successful update timestamp from MWDI
    const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
    const currentTime = Date.now();
    const alreadyUpToDateMountNames = [];
    const outdatedMountNames = [];
    for (const metadata of metadataArrayMWDI) {
      const mountName = metadata['mount-name'];
      const lastSuccessfulUpdateTime = metadata['last-successful-complete-control-construct-update-time'];
      if (!lastSuccessfulUpdateTime) {
        outdatedMountNames.push(mountName);
        continue;
      }
      const lastUpdateDate = new Date(lastSuccessfulUpdateTime);
      const timeSinceLastUpdate = currentTime - lastUpdateDate.getTime();
      if (timeSinceLastUpdate < FIFTEEN_MINUTES_MS) {
        alreadyUpToDateMountNames.push(mountName);
      } else {
        outdatedMountNames.push(mountName);
      }
    }
    // Skip processing if all mounts are already up to date
    if (outdatedMountNames.length === 0 && alreadyUpToDateMountNames.length > 0) {
      logger.info(`Update skipped: all ${alreadyUpToDateMountNames.length} mount(s) are already up-to-date`);

      return {
        status: "success",
        message: "PM data is already up to date",
        "already-up-to-date-mount-names": alreadyUpToDateMountNames,
      };
    }
    // If only a subset of mounts requires an update, process the outdated ones only
    if (outdatedMountNames.length > 0 && alreadyUpToDateMountNames.length > 0) {
      logger.warn(`Processing ${outdatedMountNames.length} outdated mount(s), skipping ${alreadyUpToDateMountNames.length} up-to-date mount(s)`);
    }
    // Keep only outdated mount names for the remaining update workflow
    body['mount-names'] = outdatedMountNames;
    var loaded = await p1LoadParameters.run({
      functionName: "initiatePmDataUpdate",
    });

    logger.info(`Validation passed: ${loaded.parameters.parameter}`);
    let waitTimeForSending = 0
    waitTimeForSending = Number(
      getParamFromFunction(
        loaded.parameters,
        "initiatePmDataUpdate",
        "waitTimeForSending",
        0,
      ),
    );
    logger.debug(`Wait time for sending requests: ${waitTimeForSending}ms`);

    // Get the MWDI base URL
    const baseMwdiUrl = mwdiUrl.replace('/v1/provide-device-status-metadata', '');
    const unconnectedMountNames = [];
    const missingMountNames = [];
    // Retrieve live control-construct data for each mount
    for (const mountName of outdatedMountNames) {
      logger.debug(`Processing mount: ${mountName}`);
      if (waitTimeForSending > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTimeForSending));
      }
     // Build the URL to retrieve the control-construct for the current mount
       const controlConstructUrl = `${baseMwdiUrl}/core-model-1-4:network-control-domain=cache/control-construct=${mountName}`;
      //const controlConstructUrl = `${baseMwdiUrl}/core-model-1-4:network-control-domain=live/control-construct=${mountName}`;
      try {
        // Retrieve the control-construct using a GET request
        const response = await fetch(controlConstructUrl, {
          method: "GET",
          headers: requestHeaders
        });

        if (response.ok) {
          const data = await response.json();
          logger.info(`Successfully retrieved control-construct for ${mountName}`);
        } else {
          // Attempt to parse the MWDI error response body ({ code, message })
          let errorBody = null;
          try {
            errorBody = await response.json();
          } catch (err) {
            logger.error(`Failed to parse MWDI error response for ${mountName}: ${err.message}`);
          }

          const mwdiErrorCode =
            (errorBody && typeof errorBody === "object" && errorBody.code) ||
            response.status;

          const mwdiErrorMessage =
            (errorBody && typeof errorBody === "object" && errorBody.message) ||
            "";

          if (mwdiErrorCode === 533) {
            // Resource not found at the Controller
            logger.error(
              `Mount ${mountName} resource unknown (HTTP ${response.status}: Resource unknown. The resource for the connected device does not exist at the Controller)`
);
            missingMountNames.push(mountName);
          } else if (
            mwdiErrorCode === 502 ||
            mwdiErrorCode === 530 ||
            mwdiErrorCode === 531 ||
            mwdiErrorCode === 532
          ) {
            // Device is unreachable or unavailable
            unconnectedMountNames.push(mountName);
            logger.error(
  `Mount ${mountName} not connected (HTTP ${response.status}: ${mwdiErrorMessage || 'Bad Gateway'})`
);
          } else {
            logger.warn(
              `Failed to retrieve control-construct for ${mountName}: ${response.status} - ${mwdiErrorMessage}`,
            );
          }
        }
      } catch (error) {
        logger.error(`Error retrieving control-construct for ${mountName}: ${error.message}`);
      }
    }
    // 10. Check whether any mount names reference resources that are unknown at the Controller 
    if (missingMountNames.length > 0) {
      throw {
        code: 533,
        message: "Resource unknown. The resource for the connected device does not exist at the Controller",
        "missing-mount-names": missingMountNames,
      };
    }
    // Handle mount names associated with unreachable or unavailable devices
    if (unconnectedMountNames.length > 0) {
      throw {
        code: 532,
        message: "Bad Gateway. Upstream server not responding.",
        "unconnected-mount-names": unconnectedMountNames,
      };
    }

    logger.info(`Completed processing ${inputMountNames.length} mount(s)`);
    logger.info("PM data update initiated successfully");

   // Build the internal success response
    const successResponse = {
      status: "success",
      message: "PM data update initiated successfully",
      timestamp: new Date().toISOString(),
      mwdiUrl,
      mwdiResponse: responseData,
    };
    // Add already up-to-date mount names for controller response handling
    if (alreadyUpToDateMountNames.length > 0) {
      successResponse['already-up-to-date-mount-names'] = alreadyUpToDateMountNames;
    }

    return successResponse;
  } catch (error) {
    // Handle any error raised during PM data update processing
    logger.error(`Error in initiatePmDataUpdate: ${error.message || error}`);
    // Propagate error 533 with the list of missing mount names
    if (error.code === 533) {
      throw {
        code: error.code,
        message: error.message,
        "missing-mount-names": error["missing-mount-names"],
      };
    }
    // Propagate error 532 with the list of unconnected mount names
    if (error.code === 532) {
      throw {
        code: error.code,
        message: error.message,
        "unconnected-mount-names": error["unconnected-mount-names"],
      };
    }
    // Propagate unexpected errors to the caller
    throw { error: error.message || ERRORS.MWDI_CONNECTION_FAILED };
  }
};

exports.documentPmDataProcessing = async function (body, user, originator, xCorrelator, traceIndicator, customerJourney) {
  try {
    const ownFunctionResult = await p1LoadParameters.run({
      functionName: 'documentPmDataProcessing'
    });

    const functionNameToDocument = getParamFromFunction(
      ownFunctionResult.parameters,
      'documentPmDataProcessing',
      'nameOfToBeDocumentedFunction'
    );

    if (!functionNameToDocument) {
      throw {
        code: 500,
        message: 'Missing nameOfToBeDocumentedFunction in documentPmDataProcessing configuration'
      };
    }

    const documentedFunctionResult = await p1LoadParameters.run({
      functionName: functionNameToDocument,
      configFile: ownFunctionResult.configFile
    });

    const documentation = await p1DocumentFunction({
      "parameters-of-to-be-documented-function": documentedFunctionResult.parameters
    });

    return documentation;
  } catch (error) {
    throw {
      code: 500,
      message: error.message || 'Failed to create PM data processing documentation'
    };
  }
};
