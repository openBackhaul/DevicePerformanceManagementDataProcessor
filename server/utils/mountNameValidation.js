const ERRORS = require('../genericFunctions/p1ReadDataStoreDeviceData/ErrorsEnum');

module.exports = {
  validateMountName,
  ERRORS
};

/**
 * Validates the mount-name field of the request body.
 *
 * @param {Object} body
 * @returns {string} ERRORS constant or null if valid
 */
function validateMountName(body) {
  const mountName = body && body['mount-name'];

  if (mountName === undefined || mountName === null || mountName === '') {
    return ERRORS.MOUNTNAME_NOT_PROVIDED;
  }

  if (typeof mountName !== 'string') {
    return ERRORS.MOUNTNAME_INVALID;
  }

  return null;
}