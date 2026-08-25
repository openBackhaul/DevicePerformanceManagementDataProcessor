const { loadConfigFile } = require("../../../utils/config");
const ERRORS = require("./errorsEnumInitiatePmDataUpdate");

module.exports = {
  validateInput,
  getMwdiURL,
  getCustomHeaders,
  validateMWDIResponse,
  validateConnectionStatus,
  ERRORS
};

/**
 * Validates the input body structure.
 *
 * @param {Object} input
 * @returns {string} ERRORS constant or null if valid
 */
function validateInput(input) {
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
 * Validates the MWDI  /v1/provide-device-status-metadata response structure.
 * The response can be either:
 * - A direct array of device status metadata objects
 * - An object with 'device-status-metadata' field containing the array
 *
 * @param {Object|Array} responseData
 * @returns {string} ERRORS constant or null if valid
 */

function validateResponse(responseData) {
  if (!responseData || typeof responseData !== "object") {
    return ERRORS.MWDI_INVALID_RESPONSE;
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
      return ERRORS.MWDI_INVALID_RESPONSE;
    }
    metadataArray = responseData["device-status-metadata"];
  } else {
    return ERRORS.MWDI_INVALID_RESPONSE;
  }

  // Validate each item in the array
  for (const item of metadataArray) {
    if (!item || typeof item !== "object") {
      return ERRORS.MWDI_INVALID_RESPONSE;
    }
    if (
      !Object.prototype.hasOwnProperty.call(item, "mount-name") ||
      !Object.prototype.hasOwnProperty.call(item, "connection-status")
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
 * trova URL per la post   /v1/provide-device-status-metadata response structuerror or the URL
  */


function getMwdiURL () {
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


/**
 * Validates the MWDI response structure.
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
