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

// Trace function - enabled via ENABLE_TRACES environment variable
function trace(message) {
  if (process.env.ENABLE_TRACES === 'true') {
    console.log(message);
  }
}

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
    trace(
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

    trace(
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

    trace("Validation mountNameDiscrepancy: " + mountNameDiscrepancy);

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

    trace("All validations passed");

    // 9. Check if update is needed (15-minute throttle) - AFTER all validations
    // Per-mount throttle based on last-successful-complete-control-construct-update-time from MWDI
    const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
    const currentTime = Date.now();
    
    // Separate mount names into already-up-to-date and outdated based on MWDI timestamps
    const alreadyUpToDateMountNames = [];
    const outdatedMountNames = [];
    
    for (const metadata of metadataArrayMWDI) {
      const mountName = metadata['mount-name'];
      const lastSuccessfulUpdateTime = metadata['last-successful-complete-control-construct-update-time'];
      
      // If no previous update or timestamp is null/undefined, consider it outdated
      if (!lastSuccessfulUpdateTime) {
        outdatedMountNames.push(mountName);
        continue;
      }
      
      // Parse the timestamp and compare
      const lastUpdateDate = new Date(lastSuccessfulUpdateTime);
      const timeSinceLastUpdate = currentTime - lastUpdateDate.getTime();
      
      if (timeSinceLastUpdate < FIFTEEN_MINUTES_MS) {
        alreadyUpToDateMountNames.push(mountName);
      } else {
        outdatedMountNames.push(mountName);
      }
    }
    
    // If all mounts are already up-to-date, return early
    if (outdatedMountNames.length === 0 && alreadyUpToDateMountNames.length > 0) {
      trace(
        `Update skipped: all ${alreadyUpToDateMountNames.length} mount(s) are already up-to-date`,
      );
      
      return {
        "already-up-to-date-mount-names": alreadyUpToDateMountNames,
      };
    }
    
    // If some mounts are outdated, update the body to only process those
    if (outdatedMountNames.length > 0 && alreadyUpToDateMountNames.length > 0) {
      trace(
        `Processing ${outdatedMountNames.length} outdated mount(s), skipping ${alreadyUpToDateMountNames.length} up-to-date mount(s)`,
      );
    }
    
    // Update body to only contain outdated mount names for processing
    body['mount-names'] = outdatedMountNames;

    var loaded = await p1LoadParameters.run({
      functionName: "initiatePmDataUpdate",
    });

    trace("Validation passed: " + loaded.parameters.parameter);
/*
    let waitTimeForSending = Number(
      loaded.parameters.parameter.find(
        (p) => p["parameter-name"] === "waitTimeForSending",
      )?.value,
    );
*/let waitTimeForSending = 0
  
  
    waitTimeForSending = Number(
      getParamFromFunction(
        loaded.parameters,
        "initiatePmDataUpdate",
        "waitTimeForSending",
        0,
      ),
    );

    trace(`Wait time for sending requests: ${waitTimeForSending}ms`);

    // Estrai il base URL da mwdiUrl (rimuovi il path esistente)
    const baseMwdiUrl = mwdiUrl.replace('/v1/provide-device-status-metadata', '');

    // Array per raccogliere i risultati del ciclo live control-construct
    const liveControlConstructResults = [];

    // Ciclo attraverso tutti i mount names per recuperare i live control-construct
    for (const mountName of outdatedMountNames) {
      trace(`Processing mount: ${mountName}`);
      
      // Attendi waitTimeForSending ms prima di ogni richiesta
      if (waitTimeForSending > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTimeForSending));
      }
      
      // Costruisci l'URL per control-construct
      const controlConstructUrl = `${baseMwdiUrl}/core-model-1-4:network-control-domain=cache/control-construct=${mountName}`;
      
      try {
        // Esegui GET request
        const response = await fetch(controlConstructUrl, {
          method: "GET",
          headers: requestHeaders
        });
        
        if (response.ok) {
          const data = await response.json();
          trace(`✓ Successfully retrieved control-construct for ${mountName}`);
          liveControlConstructResults.push({
            mountName: mountName,
            status: "success",
            data: data
          });
        } else {
          trace(`✗ Failed to retrieve control-construct for ${mountName}: ${response.status}`);
          liveControlConstructResults.push({
            mountName: mountName,
            status: "failed",
            error: `HTTP ${response.status}`
          });
        }
        
      } catch (error) {
        trace(`✗ Error retrieving control-construct for ${mountName}: ${error.message}`);
        liveControlConstructResults.push({
          mountName: mountName,
          status: "error",
          error: error.message
        });
      }
    }

    trace(`Completed processing ${inputMountNames.length} mount(s)`);
    trace("PM data update initiated successfully");

    // Update the last successful update time
    if (appState) {
      appState.lastSuccessfulCompleteControlConstructUpdateTime = Date.now();
      trace(
        `Updated lastSuccessfulCompleteControlConstructUpdateTime to ${new Date().toISOString()}`,
      );
    }

    // Esito positivo
    const successResponse = {
      status: "success",
      message: "PM data update initiated successfully",
      timestamp: new Date().toISOString(),
      mwdiUrl,
      mwdiResponse: responseData,
    };
    
    // If there were already up-to-date mounts, include them in response
    if (alreadyUpToDateMountNames.length > 0) {
      successResponse['already-up-to-date-mount-names'] = alreadyUpToDateMountNames;
    }
    
    return successResponse;
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
