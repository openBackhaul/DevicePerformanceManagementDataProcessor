var { validateMountName, ERRORS } = require('../../../utils/mountNameValidation');

module.exports = {
  validateInput,
  mapReadDataStoreDeviceDataError,
  buildSuccessResponse,
  ERRORS
};

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

  return validateMountName(body);
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