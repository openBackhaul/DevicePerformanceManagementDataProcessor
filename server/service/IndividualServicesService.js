"use strict";

const logger = require("./LoggingService.js").getLogger();

const { loadConfigFile } = require("../utils/config");

var p1LoadParameters = require("../genericFunctions/p1LoadParameters/P1LoadParameters");
var p1DocumentFunction = require("../genericFunctions/p1DocumentFunction/P1DocumentFunction"); // TODO
var p1ResolveEsAddress = require("../genericFunctions/p1ResolveEsAddress/P1ResolveEsAddress");
var p1ReadDataStoreDeviceData = require("../genericFunctions/p1ReadDataStoreDeviceData/P1ReadDataStoreDeviceData");
var {
  getParamFromFunction,
  findFunctionNode,
} = require("../utils/functionTree");

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
exports.bequeathYourDataAndDie = function (
  body,
  user,
  originator,
  xCorrelator,
  traceIndicator,
  customerJourney,
) {
  return new Promise(function (resolve, reject) {
    resolve();
  });
};

/**
 * Updates PM data for the specified devices.
 */

exports.initiatePmDataUpdate = async function (
  body,
  user,
  originator,
  xCorrelator,
  traceIndicator,
  customerJourney,
) {
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
      throw new Error("Failed to connect to MWDI service");
    }
    if (!mwdiResponse.ok) {
      throw new Error("Failed to connect to MWDI service");
    }
    const responseData = await mwdiResponse.json();

    logger.debug(
      responseData,
      `MWDI Received response for initiatePmDataUpdate:`,
    );

    // 4. Validate response and normalise the metadata array (handle both direct array and wrapped response formats)
    const metadataArrayMWDI = validateMWDIResponse(responseData);
    if (!metadataArrayMWDI) {
      throw new Error("Failed to connect to MWDI service");
    }
    // 5. Verify mount names match
   // const inputMountNames = body["mount-names"].sort();
    const inputMountNames = [...body["mount-names"]].sort();
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

      logger.error(
        missingMountNames,
        `Mount name discrepancy detected. Missing mount names`,
      );

      // Throw error with code 533 and missing mount names
      const error533 = {
        code: 533,
        message:
          "Resource unknown. The resource for the connected device does not exist at the Controller",
        "missing-mount-names": missingMountNames,
      };

      throw error533;
    }
    // 6. Validate that all requested devices are connected and available
    const connectionStatusError = validateConnectionStatus(
      metadataArrayMWDI,
      inputMountNames,
    );
    if (connectionStatusError) {
      logger.error(
        connectionStatusError.unconnectedMountNames,
        `Unconnected mounts detected: `,
      );
      // Throw error with code 532 and unconnected mount names
      const error532 = {
        code: 532,
        message: "Bad Gateway. Upstream server not responding.",
        "unconnected-mount-names": connectionStatusError.unconnectedMountNames,
      };

      throw error532;
    }

    logger.debug("All validations passed");
    // 7. Check whether a PM data update is required (15-minute threshold)
    // Classify mount names based on the last successful update timestamp from MWDI
    const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
    const currentTime = Date.now();
    const alreadyUpToDateMountNames = [];
    const outdatedMountNames = [];
    for (const metadata of metadataArrayMWDI) {
      const mountName = metadata["mount-name"];
      const lastSuccessfulUpdateTime =
        metadata["last-successful-complete-control-construct-update-time"];
      if (
        lastSuccessfulUpdateTime === undefined ||
        lastSuccessfulUpdateTime === null
      ) {
        outdatedMountNames.push(mountName);
        continue;
      }
      const lastUpdateDate = new Date(lastSuccessfulUpdateTime);
      if (isNaN(lastUpdateDate.getTime())) {
        outdatedMountNames.push(mountName);
        continue;
      }

      const timeSinceLastUpdate = currentTime - lastUpdateDate.getTime();

      if (timeSinceLastUpdate < FIFTEEN_MINUTES_MS) {
        alreadyUpToDateMountNames.push(mountName);
      } else {
        outdatedMountNames.push(mountName);
      }
    }
    // Skip processing if all mounts are already up to date
    if (
      outdatedMountNames.length === 0 &&
      alreadyUpToDateMountNames.length > 0
    ) {
      logger.debug(
        `Update skipped: all ${alreadyUpToDateMountNames.length} mount(s) are already up-to-date`,
      );
      return {
        code: 200,
        "already-up-to-date-mount-names": alreadyUpToDateMountNames,
      };
    }
    // If only a subset of mounts requires an update, process the outdated ones only
    if (outdatedMountNames.length > 0 && alreadyUpToDateMountNames.length > 0) {
      logger.warn(
        `Processing ${outdatedMountNames.length} outdated mount(s), skipping ${alreadyUpToDateMountNames.length} up-to-date mount(s)`,
      );
    }
    const loaded = await p1LoadParameters.run({
      functionName: "initiatePmDataUpdate",
    });

    logger.debug(
      `Validation passed: ${JSON.stringify(loaded.parameters.parameter)}`,
    );
    let waitTimeForSending = 0;
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
    const baseMwdiUrl = mwdiUrl.replace(
      "/v1/provide-device-status-metadata",
      "",
    );

    // Retrieve live control-construct data for each mount (best effort, errors are logged but ignored)
    let firstRequest = true;
    for (const mountName of outdatedMountNames) {
      if (!firstRequest && waitTimeForSending > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTimeForSending));
      } else {
        firstRequest = false;
      }
      //const controlConstructUrl = `${baseMwdiUrl}/core-model-1-4:network-control-domain=live/control-construct=${mountName}`;
      const controlConstructUrl = `${baseMwdiUrl}/core-model-1-4:network-control-domain=cache/control-construct=${mountName}`;
      try {
        await fetch(controlConstructUrl, {
          method: "GET",
          headers: requestHeaders,
        });
      } catch (err) {
        // Handle fetch errors : error has to be ignored for live control-construct;  we just log them
        logger.warn(
          `Ignoring MWDI error for mount ${mountName}: ${err.message}`,
        );
      }
    }
    logger.debug(`Completed processing ${inputMountNames.length} mount(s)`);
    logger.debug("PM data update initiated successfully");
    // Build the success response
    if (alreadyUpToDateMountNames.length > 0) {
      return {
        code: 200,
        "already-up-to-date-mount-names": alreadyUpToDateMountNames,
      };
    }
    return {
      code: 204,
    };
  } catch (error) {
    logger.error(`Error in initiatePmDataUpdate: ${error.message || error}`);
    if (Number.isInteger(error.code)) {
      throw error;
    }
    throw {
      code: 500,
      message: error.message || "Failed to connect to MWDI service",
    };
  }
};

exports.documentPmDataProcessing = async function (
  body,
  user,
  originator,
  xCorrelator,
  traceIndicator,
  customerJourney,
) {
  try {
    const ownFunctionResult = await p1LoadParameters.run({
      functionName: "documentPmDataProcessing",
    });

    const functionNameToDocument = getParamFromFunction(
      ownFunctionResult.parameters,
      "documentPmDataProcessing",
      "nameOfToBeDocumentedFunction",
    );

    if (!functionNameToDocument) {
      throw {
        code: 500,
        message:
          "Missing nameOfToBeDocumentedFunction in documentPmDataProcessing configuration",
      };
    }

    const documentedFunctionResult = await p1LoadParameters.run({
      functionName: functionNameToDocument,
      configFile: ownFunctionResult.configFile,
    });

    const documentation = await p1DocumentFunction({
      "parameters-of-to-be-documented-function":
        documentedFunctionResult.parameters,
    });

    return documentation;
  } catch (error) {
    throw {
      code: 500,
      message:
        error.message || "Failed to create PM data processing documentation",
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
exports.provideDeviceDataStoreDump = async function (
  body,
  user,
  originator,
  xCorrelator,
  traceIndicator,
  customerJourney,
) {
  try {
    // 1. Input validation: mount-name is mandatory and must be a non-empty string
    const validationError = validateProvideDeviceDataStoreDumpInput(body);
    if (validationError) {
      throw createError(400, validationError);
    }
    logger.debug(
      { body },
      "Received body in provideDeviceDataStoreDump service",
    );
    const mountName = body["mount-name"];

    // 2. Load the parameters of the function from the control construct
    const loaded = await p1LoadParameters.run({
      functionName: "provideDeviceDataStoreDump",
    });
    if (!loaded || !loaded.parameters) {
      throw createError(500, "Failed to load function parameters");
    }
    // 3. Resolve the address of the DataStore Elasticsearch client
    const p1ResolveEsAddressParameters = findFunctionNode(
      loaded.parameters,
      "p1ResolveEsAddress",
    );
    if (!p1ResolveEsAddressParameters) {
      throw createError(500, "Missing p1ResolveEsAddress configuration");
    }
    logger.debug(
      { p1ResolveEsAddressParameters },
      "Result of findFunctionNode",
    );
    const { esAddress } = await p1ResolveEsAddress.run({
      parameters: p1ResolveEsAddressParameters,
      configFile: loaded.configFile,
      esName: "dataStoreEsClient",
    });
    logger.debug({ esAddress }, "Resolved DataStore Elasticsearch address");
    logger.debug(
      { keys: Object.keys(p1ResolveEsAddressParameters) },
      "Available ES names",
    );
    // Finds the URL "https://my-es-server:9200"
    // 4. Read the PM data of the device from the DataStore
    const readResult = await p1ReadDataStoreDeviceData({
      "data-store-es-client": esAddress,
      "mount-name": mountName,
    });

    // 5. Map the error messages returned by the generic function to HTTP errors
    if (typeof readResult === "string") {
      throw mapReadDataStoreDeviceDataError(readResult);
    }

    logger.debug(
      `PM data of device ${mountName} read from the DataStore successfully`,
    );

    // 6. Build the success response as expected by the OpenAPI specification
    return buildSuccessResponse(readResult);
  } catch (error) {
    // Propagate errors that already carry an HTTP status code
    if (error && Number.isInteger(error.code)) {
      logger.error(
        `Error in provideDeviceDataStoreDump: ${error.message || error}`,
      );
      throw error;
    }

    // Wrap unexpected errors into a 500 response
    const message = (error && error.message) || "General processing error";
    logger.error(`Error in provideDeviceDataStoreDump: ${message}`);
    throw createError(500, message);
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
 * @returns {string} error message or null if valid
 */
function validatePmDataUpdateInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return "Input is not a valid object";
  }

  if (!Object.prototype.hasOwnProperty.call(input, "mount-names")) {
    return "mountNames not provided";
  }

  if (!isValidMountNamesList(input["mount-names"])) {
    return "mountNames invalid";
  }

  return null;
}

/**
 * Validates the mount-names list: it must be a non-empty array of non-empty strings.
 *
 * @param {*} mountNames
 * @returns {boolean} true when the list is valid
 */
function isValidMountNamesList(mountNames) {
  return (
    Array.isArray(mountNames) &&
    mountNames.length > 0 &&
    mountNames.every((item) => typeof item === "string" && item.trim() !== "")
  );
}

/**
 * Validates and normalises the MWDI /v1/provide-device-status-metadata response.
 * The response can be either:
 * - A direct array of device status metadata objects
 * - An object with 'device-status-metadata' field containing the array
 *
 * @param {Object|Array} responseData
 * @returns {Array|null} normalised metadata array, or null when the response is invalid
 */
function validateMWDIResponse(responseData) {
  if (!responseData || typeof responseData !== "object") {
    return null;
  }

  // Handle direct array response (actual MWDI format)
  let metadataArray;
  if (Array.isArray(responseData)) {
    metadataArray = responseData;
  }
  // Handle object with 'device-status-metadata' field (for backward compatibility)
  else if (
    Object.prototype.hasOwnProperty.call(responseData, "device-status-metadata")
  ) {
    if (!Array.isArray(responseData["device-status-metadata"])) {
      return null;
    }
    metadataArray = responseData["device-status-metadata"];
  } else {
    return null;
  }

  // Validate each item in the array
  for (const item of metadataArray) {
    if (!item || typeof item !== "object") {
      return null;
    }
    if (
      !Object.prototype.hasOwnProperty.call(item, "mount-name") ||
      !Object.prototype.hasOwnProperty.call(item, "connection-status")
    ) {
      return null;
    }
  }

  return metadataArray;
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
    const mountName = item["mount-name"];
    const connectionStatus = item["connection-status"];

    // Only check mounts that are in the input list
    if (!inputMountNamesSet.has(mountName)) {
      continue;
    }

    // If connection-status is not "connected", add to unconnected list
    if (connectionStatus !== "connected") {
      unconnectedMountNames.push(mountName);
    }
  }

  // Return unconnected mounts if any found
  if (unconnectedMountNames.length > 0) {
    return {
      unconnectedMountNames: unconnectedMountNames,
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
      throw new Error("Config file contains invalid JSON");
    }

    console.error("Error occurred while loading config file:", error);
    throw new Error("Error occurred while loading config file");
  }

  const mwdiMetadata = "/v1/provide-device-status-metadata";

  const ltps =
    configFile["core-model-1-4:control-construct"]["logical-termination-point"];
  //solo una riga nel file ha  tcp-c-mwdi-  in  uid ( "uuid": "dpmdp-1-1-0-tcp-c-mwdi-1-1-2-000")
  const mwdiTcpLtp = ltps.find((ltp) => ltp.uuid.includes("-tcp-c-mwdi-"));

  if (!mwdiTcpLtp) {
    throw new Error("TCP Client MWDI non trovato");
  }

  const tcpConfig =
    mwdiTcpLtp["layer-protocol"][0][
      "tcp-client-interface-1-0:tcp-client-interface-pac"
    ]["tcp-client-interface-configuration"];

  const ip = tcpConfig["remote-address"]["ip-address"]["ipv-4-address"];

  const port = tcpConfig["remote-port"];

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
    "Content-Type": "application/json",
    accept: process.env.HTTP_ACCEPT || "application/json",
    user: process.env.HTTP_USER || "User Name",
    originator: process.env.HTTP_ORIGINATOR || "Resolver",
    "x-correlator":
      process.env.HTTP_X_CORRELATOR || "550e8400-e29b-11d4-a716-446655440000",
    "trace-indicator": process.env.HTTP_TRACE_INDICATOR || "1.3.1",
    "customer-journey": process.env.HTTP_CUSTOMER_JOURNEY || "Unknown value",
    "operation-key":
      process.env.HTTP_OPERATION_KEY || "Operation key not yet provided.",
  };
}

// ---------------------------------------------------------------------------
// provideDeviceDataStoreDump utilities
// ---------------------------------------------------------------------------

/**
 * Builds the error object propagated to the controller as {code, message}.
 * NOTE: it deliberately returns a PLAIN object (not an `Error` instance) because:
 *  - the controller serialises it directly into the HTTP response body
 *    (an `Error` instance would serialise to `{}`, since `message` is not enumerable);
 *  - it is the same convention used by initiatePmDataUpdate (plain {code, message} objects);
 *  - the unit tests assert `rejects.toEqual({ code, message })`.
 */
function createError(code, message) {
  return { code, message };
}

/**
 * Validates the body of the provideDeviceDataStoreDump service.
 * The mount-name is mandatory and must be a non-empty string.
 *
 * @param {Object} body
 * @returns {string} error message or null if valid
 */
function validateProvideDeviceDataStoreDumpInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "mountName not provided";
  }

  const mountName = body["mount-name"];
  if (mountName === undefined || mountName === null || mountName === "") {
    return "mountName not provided";
  }
  if (typeof mountName !== "string") {
    return "mountName invalid";
  }

  return null;
}

/**
 * Maps the error messages returned
 *
 * @param {string} message
 * @returns {{ code: number, message: string }}
 */
function mapReadDataStoreDeviceDataError(message) {
  switch (message) {
    case "mountName not found in DataStore":
      return { code: 404, message };

    case "mountName not provided":
    case "mountName invalid":
    case "dataStoreUrl not provided":
    case "dataStoreUrl invalid":
      return { code: 400, message };

    default:
      return { code: 500, message };
  }
}

/**
 * Builds the success response expected by the OpenAPI specification.
 *
 * @param {Object} readResult Result returned by p1ReadDataStoreDeviceData
 * @returns {Object} { 'device-pm-data': [...] }
 */
function buildSuccessResponse(readResult) {
  if (!readResult || !Array.isArray(readResult["device-pm-data"])) {
    throw new Error("Invalid p1ReadDataStoreDeviceData result");
  }

  return {
    "device-pm-data": readResult["device-pm-data"],
  };
}
