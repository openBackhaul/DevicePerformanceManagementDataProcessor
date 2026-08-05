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

var p1LoadParameters = require("../genericFunctions/p1LoadParameters/P1LoadParameters");
const {
  getParamFromFunction,
  findFunctionNode,
} = require("../utils/functionTree");

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
  appState,
) {
  try {
    logger.info(
      `Received mountsList from initiatePmDataUpdate: ${JSON.stringify(body, null, 2)}`,
    );

    // 1. Validazione
    const validationError = validateInput(body);
    if (validationError) {
      throw new Error(`Validation error: ${validationError}`);
    }

    // 2. Recupero URL e Header
    const mwdiUrl = getMwdiURL();
    const requestHeaders = {
      ...getCustomHeaders(),
      ...(body._headers || {}),
    };

    // 3. Chiamata HTTP
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

    logger.info(
      `MWDI Received response for provideDeviceStatusMetadata : ${JSON.stringify(responseData, null, 2)}`,
    );

    // 5. Validate response
    const responseError = validateMWDIResponse(responseData);
    if (responseError) {
      throw new Error(ERRORS.MWDI_CONNECTION_FAILED);
    }

    // 6. Extract metadata array (handle both direct array and wrapped format)
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

    logger.info("Validation mountNameDiscrepancy: " + mountNameDiscrepancy);

    // Handle error 533: Mount name discrepancy
    if (mountNameDiscrepancy) {
      // Find missing mount names (in input but not in response)
      const returnedSet = new Set(returnedMountNamesMWDI);
      const missingMountNames = inputMountNames.filter(
        (name) => !returnedSet.has(name),
      );

      logger.error(
        `Mount name discrepancy detected. Missing mount names: ${JSON.stringify(missingMountNames)}`,
      );

      // Throw error with code 533 and missing mount names
      const error533 = {
        code: 533,
        message: ERRORS.MOUNT_NAME_DISCREPANCY,
        "missing-mount-names": missingMountNames,
      };

      throw error533;
    }

    // 8. Validate connection status
    const connectionStatusError = validateConnectionStatus(
      metadataArrayMWDI,
      inputMountNames,
    );
    if (connectionStatusError) {
      logger.error(
        `Unconnected mounts detected: ${JSON.stringify(connectionStatusError.unconnectedMountNames)}`,
      );

      // Throw error with code 532 and unconnected mount names
      const error532 = {
        code: 532,
        message: ERRORS.UNCONNECTED_MOUNTS,
        "unconnected-mount-names": connectionStatusError.unconnectedMountNames,
      };

      throw error532;
    }

    logger.info("All validations passed");

    // 9. Check if update is needed (15-minute throttle) - AFTER all validations
    const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
    const currentTime = Date.now();
    const lastUpdateTime =
      appState?.lastSuccessfulCompleteControlConstructUpdateTime;

    // If there was a previous successful update and < 15 minutes have passed, return early
    if (lastUpdateTime !== null && lastUpdateTime !== undefined) {
      const timeSinceLastUpdate = currentTime - lastUpdateTime;

      if (timeSinceLastUpdate < FIFTEEN_MINUTES_MS) {
        logger.info(
          `Update skipped: only ${Math.floor(timeSinceLastUpdate / 1000)} seconds since last successful update (minimum 15 minutes required)`,
        );

        // Return 200 with already up-to-date mount names
        return {
          status: "success",
          message: "PM data is already up to date",
          "already-up-to-date-mount-names": body["mount-names"] || [],
          timestamp: new Date().toISOString(),
        };
      }
    }

    var loaded = await p1LoadParameters.run({
      functionName: "initiatePmDataUpdate",
    });

    logger.info("Validation passed: " + loaded.parameters.parameter);
/*
    let waitTimeForSending = Number(
      loaded.parameters.parameter.find(
        (p) => p["parameter-name"] === "waitTimeForSending",
      )?.value,
    );
*/let waitTimeForSending = 0
    console.log(waitTimeForSending); 
  
  
    waitTimeForSending = Number(
      getParamFromFunction(
        loaded.parameters,
        "initiatePmDataUpdate",
        "waitTimeForSending",
        0,
      ),
    );
    console.log(waitTimeForSending);

    logger.info("Validation passed, PM data update initiated successfully");

    // Update the last successful update time
    if (appState) {
      appState.lastSuccessfulCompleteControlConstructUpdateTime = Date.now();
      logger.info(
        `Updated lastSuccessfulCompleteControlConstructUpdateTime to ${new Date().toISOString()}`,
      );
    }

    // Esito positivos
    return {
      status: "success",
      message: "PM data update initiated successfully",
      timestamp: new Date().toISOString(),
      mwdiUrl,
      mwdiResponse: responseData,
    };
  } catch (error) {
    // CATCH GLOBALE: Gestisce QUALSIASI errore verificatosi nel blocco 'try'
    logger.error(`Error in initiatePmDataUpdate: ${error.message || error}`);

    // Handle error 533: Mount name discrepancy
    if (error.code === 533) {
      // Return error 533 with missing mount names
      throw {
        code: error.code,
        message: error.message,
        "missing-mount-names": error["missing-mount-names"],
      };
    }

    // Handle error 532: Unconnected mounts
    if (error.code === 532) {
      // Return error 532 with unconnected mount names
      throw {
        code: error.code,
        message: error.message,
        "unconnected-mount-names": error["unconnected-mount-names"],
      };
    }

    // Rilancia l'errore verso chi ha chiamato la funzione
    throw { error: error.message || ERRORS.MWDI_CONNECTION_FAILED };
  }
};
