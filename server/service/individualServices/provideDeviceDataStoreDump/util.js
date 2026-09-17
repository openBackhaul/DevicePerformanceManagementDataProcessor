var ERRORS = require('../../../genericFunctions/p1ReadDataStoreDeviceData/ErrorsEnum');

module.exports = {
  validateInput,
  mapReadDataStoreDeviceDataError,
  buildSuccessResponse,
  createError,
  ERRORS
};

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

// NB: qui NON deve esserci un secondo `module.exports`, altrimenti sovrascrive
// l'export completo dichiarato sopra (validateInput, mapReadDataStoreDeviceDataError,
// buildSuccessResponse, createError, ERRORS).

/**
 * Validates the body of the provideDeviceDataStoreDump service.
 * The mount-name is mandatory and must be a non-empty string.
 *
 * @param {Object} body
 * @returns {string} ERRORS constant or null if valid
 */
function validateInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return ERRORS.MOUNTNAME_NOT_PROVIDED;
  }

  const mountName = body['mount-name'];
  if (mountName === undefined || mountName === null || mountName === '') {
    return ERRORS.MOUNTNAME_NOT_PROVIDED;
  }
  if (typeof mountName !== 'string') {
    return ERRORS.MOUNTNAME_INVALID;
  }

  return null;
}

/**
 * Maps the error messages returned by p1ReadDataStoreDeviceData to
 * the HTTP error objects propagated to the controller.
 *
 * @param {string} message
 * @returns {{ code: number, message: string }}
 */
function mapReadDataStoreDeviceDataError(message) {
  switch (message) {
    case ERRORS.MOUNTNAME_NOT_FOUND:
      return { code: 404, message };

    case ERRORS.MOUNTNAME_NOT_PROVIDED:
    case ERRORS.MOUNTNAME_INVALID:
    case ERRORS.DATA_STORE_NOT_PROVIDED:
    case ERRORS.DATA_STORE_INVALID:
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
  if (!readResult || !Array.isArray(readResult['device-pm-data'])) {
    throw new Error('Invalid p1ReadDataStoreDeviceData result');
  }

  return {
    'device-pm-data': readResult['device-pm-data']
  };

  
}