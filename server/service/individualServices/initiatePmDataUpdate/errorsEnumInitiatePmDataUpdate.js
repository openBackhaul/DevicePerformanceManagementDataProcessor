'use strict';

const ERRORS = {
  INPUT_INVALID: 'Input is not a valid object',
  MOUNT_NAME_LIST_NOT_PROVIDED: 'mount-name-list not provided',
  MOUNT_NAME_LIST_INVALID: 'mount-name-list must be a non-empty array of strings',
  MOUNT_NAME_LIST_EMPTY: 'mount-name-list is empty',
  MOUNT_NAME_DISCREPANCY: 'Resource unknown. The resource for the connected device does not exist',
  UNCONNECTED_MOUNTS: 'unconnectedMounts',
  MWDI_CONNECTION_FAILED: 'Failed to connect to MWDI service',
  MWDI_INVALID_RESPONSE: 'Invalid response from MWDI service',
  ERR_INVALID_JSON: 'Config file contains invalid JSON',
  ERR_CONFIG_NOT_ACCESSIBLE: 'Error occurred while loading config file'
};

module.exports = ERRORS;