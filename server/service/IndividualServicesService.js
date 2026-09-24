"use strict";

const logger = require("./LoggingService.js").getLogger();
const createHttpError = require("http-errors");

const { loadConfigFile } = require("../utils/config");


/**
 * Catalog of error messages for initiatePmDataUpdate.
 * Consumed by this module and by the unit tests (exports.ERRORS):
 * MOUNT_NAME_DISCREPANCY, UPSTREAM_SERVER_NOT_RESPONDING,
 * MWDI_CONNECTION_FAILED and MWDI_INVALID_RESPONSE.
 */
const ERRORS = {
  INPUT_INVALID: 'Input is not a valid object',
  MOUNT_NAME_LIST_NOT_PROVIDED: 'mountNames not provided',
  MOUNT_NAME_LIST_INVALID: 'mountNames invalid',
  MOUNT_NAME_LIST_EMPTY: 'mountNames invalid',
  MOUNT_NAME_DISCREPANCY: 'Resource unknown. The resource for the connected device does not exist at the Controller',
  UPSTREAM_SERVER_NOT_RESPONDING: 'Bad Gateway. Upstream server not responding.',
  MWDI_CONNECTION_FAILED: 'Failed to connect to MWDI service',
  MWDI_INVALID_RESPONSE: 'Invalid response from MWDI service',
  ERR_INVALID_JSON: 'Config file contains invalid JSON',
  ERR_CONFIG_NOT_ACCESSIBLE: 'Error occurred while loading config file'
};

exports.ERRORS = ERRORS;


var p1LoadParameters = require('../genericFunctions/p1LoadParameters/P1LoadParameters');
var p1DocumentFunction = require('../genericFunctions/p1DocumentFunction/P1DocumentFunction');// TODO
var p1ResolveEsAddress = require('../genericFunctions/p1ResolveEsAddress/P1ResolveEsAddress');
var p1ReadDataStoreDeviceData = require('../genericFunctions/p1ReadDataStoreDeviceData/P1ReadDataStoreDeviceData');
var { getParamFromFunction, findFunctionNode } = require('../utils/functionTree');

//================ SERVICES ================

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
    const validationError = validatePmDataUpdateInput(body);
    if (validationError) {
      throw { code: 400, message: validationError };
    }

    // 2. Retrieve URL ('http://xx/v1/provide-device-status-metadata') and headers
    const mwdiUrl = getMwdiURL();
    const requestHeaders = {
      ...getCustomHeaders(),
      ...(body._headers || {}),
    };
    // 3. Call MWDI REST API to get device status metadata
    let mwdiResponse;
    try {
      mwdiResponse = await fetch(mwdiUrl, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({
          "mount-name-list": body["mount-names"],
        }),
      });
    } catch (error) {
      throw new Error(ERRORS.MWDI_CONNECTION_FAILED);
    }
    if (!mwdiResponse.ok) {
      throw new Error(ERRORS.MWDI_CONNECTION_FAILED);
    }
    const responseData = await mwdiResponse.json();

    logger.debug(responseData, `MWDI Received response for initiatePmDataUpdate:`);

    // 5. Validate response
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
    logger.debug(`Validation mountNameDiscrepancy: ${mountNameDiscrepancy}`);
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
        message: ERRORS.UPSTREAM_SERVER_NOT_RESPONDING,
        "unconnected-mount-names": connectionStatusError.unconnectedMountNames,
      };

      throw error532;
    }

    logger.debug("All validations passed");
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
      logger.debug(`Update skipped: all ${alreadyUpToDateMountNames.length} mount(s) are already up-to-date`);

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

    logger.debug(`Validation passed: ${JSON.stringify(loaded.parameters.parameter)}`);
    /*
        let waitTimeForSending = Number(
          loaded.parameters.parameter.find(
            (p) => p["parameter-name"] === "waitTimeForSending",
          )?.value,
        );
    */
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
      const isLocalMwdi =
        baseMwdiUrl.toLowerCase().includes('localhost') ||
        baseMwdiUrl.includes('127.0.0.1');

      let controlConstructUrl;
//##########################################################################
/*   
      if (isLocalMwdi) {
        logger.info(`Local Test - using cache control-construct`);
        controlConstructUrl =
          `${baseMwdiUrl}/core-model-1-4:network-control-domain=cache/control-construct=${mountName}`;
      } else {
*/
        logger.info(`Live Environment - using live control-construct`);
        controlConstructUrl =
          `${baseMwdiUrl}/core-model-1-4:network-control-domain=live/control-construct=${mountName}`;
/*  
      }
*/
//##########################################################################
      try {
        // Retrieve the control-construct using a GET request
        const response = await fetch(controlConstructUrl, {
          method: "GET",
          headers: requestHeaders
        });

        if (response.ok) {
          const data = await response.json();
          logger.debug(`Successfully retrieved control-construct for ${mountName}`);
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
        message: ERRORS.MOUNT_NAME_DISCREPANCY,
        "missing-mount-names": missingMountNames,
      };
    }
    // Handle mount names associated with unreachable or unavailable devices
    if (unconnectedMountNames.length > 0) {
      throw {
        code: 532,
        message: ERRORS.UPSTREAM_SERVER_NOT_RESPONDING,
        "unconnected-mount-names": unconnectedMountNames,
      };
    }

    logger.debug(`Completed processing ${inputMountNames.length} mount(s)`);
    logger.debug("PM data update initiated successfully");

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
    // Propagate unexpected errors to the caller, preserving the { code, message }
    // shape required by the documented errorDescription schema
    throw {
      code: Number.isInteger(error.code) ? error.code : 500,
      message: error.message || ERRORS.MWDI_CONNECTION_FAILED,
    };
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

/**
 * Provides a dump of the PM data of a device from the data store.
 *
 * body V1_providedevicedatastoredump_body
 * user String User identifier from the system starting the service call
 * originator String 'Identification for the system consuming the API, as defined in  [/core-model-1-4:control-construct/logical-termination-point={uuid}/layer-protocol=0/http-client-interface-1-0:http-client-interface-pac/http-client-interface-configuration/application-name]'
 * xCorrelator String UUID for the service execution flow that allows to correlate requests and responses
 * traceIndicator String Sequence of request numbers along the flow
 * customerJourney String Holds information supporting customer's journey to which the execution applies
 * no response value expected for this operation
 **/
exports.provideDeviceDataStoreDump = async function (body, user, originator, xCorrelator, traceIndicator, customerJourney) {
  try {
    // 1. Input validation: mount-name is mandatory and must be a non-empty string
    const mountName = body && body['mount-name'];
    if (mountName === undefined || mountName === null || mountName === '') {
      throw new createHttpError.BadRequest('mount-name must not be empty');
    }
    if (typeof mountName !== 'string') {
      throw new createHttpError.BadRequest('mount-name must be a string');
    }
    logger.debug({ body }, 'Received body in provideDeviceDataStoreDump service');

    // 2. Load the parameters of the function from the control construct
    const loaded = await p1LoadParameters.run({
      functionName: 'provideDeviceDataStoreDump'
    });
    if (!loaded || !loaded.parameters) {
      throw new Error("Failed to load function parameters");
    }
    // 3. Resolve the address of the DataStore Elasticsearch client
    const p1ResolveEsAddressParameters = findFunctionNode(
      loaded.parameters,
      'p1ResolveEsAddress'
    );
    if (!p1ResolveEsAddressParameters) {
      throw new Error('Missing p1ResolveEsAddress configuration');
    }
    logger.debug({ p1ResolveEsAddressParameters }, 'Result of findFunctionNode');
    const { esAddress } = await p1ResolveEsAddress.run({
      parameters: p1ResolveEsAddressParameters,
      configFile: loaded.configFile,
      esName: 'dataStoreEsClient'
    });
    logger.debug({ esAddress }, 'Resolved DataStore Elasticsearch address');
    logger.debug(
      { keys: Object.keys(p1ResolveEsAddressParameters) },
      'Available ES names'
    );
    // Finds the URL "https://my-es-server:9200"
    /*
     const dataStoreEsClient = (
       await p1ResolveEsAddress.run({
         parameters: p1ResolveEsAddressParameters,
         configFile: loaded.configFile,
         esName: "dataStoreEsClient"
       })
     ).esAddress;
     logger.debug({ dataStoreEsClient }, 'Resolved  Elasticsearch address');
     */
    // 4. Read the PM data of the device from the DataStore
    const readResult = await p1ReadDataStoreDeviceData({
      'data-store-es-client': esAddress,
      'mount-name': mountName
    });

    // 5. No PM data stored for the device: 404 as per OpenAPI specification
    if (readResult['device-pm-data'].length === 0) {
      throw new createHttpError.NotFound(`mount-name ${mountName} not found in DataStore`);
    }

    logger.debug(`PM data of device ${mountName} read from the DataStore successfully`);

    return readResult;
  } catch (error) {
    // HttpErrors are answered with their own status code by the ResponseBuilder,
    // any other error is answered with 500
    logger.error(`Error in provideDeviceDataStoreDump: ${error.message}`);
    throw error;
  }
};




//================ UTILITIES ================

// ---------------------------------------------------------------------------
// initiatePmDataUpdate utilities
// ---------------------------------------------------------------------------

/**
 * Validates the input body structure.
 *
 * @param {Object} input
 * @returns {string} ERRORS constant or null if valid
 */
function validatePmDataUpdateInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return ERRORS.INPUT_INVALID;
  }

  if (!Object.prototype.hasOwnProperty.call(input, "mount-names")) {
    return ERRORS.MOUNT_NAME_LIST_NOT_PROVIDED;
  }

  if (!Array.isArray(input["mount-names"])) {
    return ERRORS.MOUNT_NAME_LIST_INVALID;
  }

  if (input["mount-names"].length === 0) {
    return ERRORS.MOUNT_NAME_LIST_EMPTY;
  }

  for (const item of input["mount-names"]) {
    if (typeof item !== "string" || item.trim() === "") {
      return ERRORS.MOUNT_NAME_LIST_INVALID;
    }
  }

  return null;
}

/**
 * Validates the MWDI /v1/provide-device-status-metadata response structure.
 * The response can be either:
 * - A direct array of device status metadata objects
 * - An object with 'device-status-metadata' field containing the array
 *
 * @param {Object|Array} responseData
 * @returns {string} ERRORS constant or null if valid
 */
function validateMWDIResponse(responseData) {
  if (!responseData || typeof responseData !== 'object') {
    return ERRORS.MWDI_INVALID_RESPONSE;
  }

  // Handle direct array response (actual MWDI format)
  let metadataArray;
  if (Array.isArray(responseData)) {
    metadataArray = responseData;
  }
  // Handle object with 'device-status-metadata' field (for backward compatibility)
  else if (Object.prototype.hasOwnProperty.call(responseData, 'device-status-metadata')) {
    if (!Array.isArray(responseData['device-status-metadata'])) {
      return ERRORS.MWDI_INVALID_RESPONSE;
    }
    metadataArray = responseData['device-status-metadata'];
  }
  else {
    return ERRORS.MWDI_INVALID_RESPONSE;
  }

  // Validate each item in the array
  for (const item of metadataArray) {
    if (!item || typeof item !== 'object') {
      return ERRORS.MWDI_INVALID_RESPONSE;
    }
    if (
      !Object.prototype.hasOwnProperty.call(item, 'mount-name') ||
      !Object.prototype.hasOwnProperty.call(item, 'connection-status')
    ) {
      return ERRORS.MWDI_INVALID_RESPONSE;
    }
  }

  return null;
}
/**
 * Validates that all mounts in the metadata array are in connected state.
 *
 * @param {Array} metadataArray - Array of device status metadata objects
 * @param {Array} inputMountNames - Array of mount names from the input request
 * @returns {Object|null} Object with unconnectedMountNames array or null if all connected
 */
function validateConnectionStatus(metadataArray, inputMountNames) {
  const unconnectedMountNames = [];

  // Create a set of input mount names for efficient lookup
  const inputMountNamesSet = new Set(inputMountNames);

  // Check each mount's connection status
  for (const item of metadataArray) {
    const mountName = item['mount-name'];
    const connectionStatus = item['connection-status'];

    // Only check mounts that are in the input list
    if (!inputMountNamesSet.has(mountName)) {
      continue;
    }

    // If connection-status is not "connected", add to unconnected list
    if (connectionStatus !== 'connected') {
      unconnectedMountNames.push(mountName);
    }
  }

  // Return unconnected mounts if any found
  if (unconnectedMountNames.length > 0) {
    return {
      unconnectedMountNames: unconnectedMountNames
    };
  }

  return null;
}


/**
 * finds URL for the POST  
 * ex:  /v1/provide-device-status-metadata response structuerror or the URL
  */
function getMwdiURL() {
  let configFile;

  try {
    configFile = loadConfigFile();
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error("Config file contains invalid JSON:", error);
      throw new Error(ERRORS.ERR_INVALID_JSON);
    }

    console.error("Error occurred while loading config file:", error);
    throw new Error(ERRORS.ERR_CONFIG_NOT_ACCESSIBLE);
  }

  const mwdiMetadata = "/v1/provide-device-status-metadata";

  const ltps =
    configFile["core-model-1-4:control-construct"]["logical-termination-point"];
  //solo una riga nel file ha  tcp-c-mwdi-  in  uid ( "uuid": "dpmdp-1-1-0-tcp-c-mwdi-1-1-2-000")
  const mwdiTcpLtp = ltps.find(
    (ltp) => ltp.uuid.includes("-tcp-c-mwdi-")
  );

  if (!mwdiTcpLtp) {
    throw new Error("TCP Client MWDI non trovato");
  }

  const tcpConfig =
    mwdiTcpLtp["layer-protocol"][0][
    "tcp-client-interface-1-0:tcp-client-interface-pac"
    ]["tcp-client-interface-configuration"];

  const ip =
    tcpConfig["remote-address"]["ip-address"]["ipv-4-address"];

  const port =
    tcpConfig["remote-port"];

  const mwdiUrl = `http://${ip}:${port}${mwdiMetadata}`;
  return mwdiUrl;
}

/**
 * Returns custom headers for the MWDI API call.
 * Headers are read from environment variables with sensible defaults.
 *
 * @returns {Object}
 */
function getCustomHeaders() {
  return {
    'Content-Type': 'application/json',
    'accept': process.env.HTTP_ACCEPT || 'application/json',
    'user': process.env.HTTP_USER || 'User Name',
    'originator': process.env.HTTP_ORIGINATOR || 'Resolver',
    'x-correlator': process.env.HTTP_X_CORRELATOR || '550e8400-e29b-11d4-a716-446655440000',
    'trace-indicator': process.env.HTTP_TRACE_INDICATOR || '1.3.1',
    'customer-journey': process.env.HTTP_CUSTOMER_JOURNEY || 'Unknown value',
    'operation-key': process.env.HTTP_OPERATION_KEY || 'Operation key not yet provided.'
  };
}
