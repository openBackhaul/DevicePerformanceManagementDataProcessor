
const ERRORS = {
    // PARAMETERS_MISSING: 'parameters missing',
    // PARAMETERS_INVALID: 'parameters invalid',
    // CONFIG_FILE_MISSING: 'config-file missing',
    // CONFIG_FILE_INVALID: 'config-file invalid',
    ES_NAME_NOT_FOUND_IN_PARAMETERS: 'es-name not found in parameters',
    ES_CLIENT_UUID_COULD_NOT_BE_RESOLVED: 'es-client-uuid could not be resolved',
    ES_CLIENT_LTP_NOT_FOUND: 'es-client LTP could not be found in config-file',
    HTTP_CLIENT_UUID_COULD_NOT_BE_RESOLVED: 'http-client-uuid could not be resolved',
    HTTP_CLIENT_LTP_NOT_FOUND: 'http-client LTP could not be found in config-file',
    TCP_CLIENT_UUID_COULD_NOT_BE_RESOLVED: 'tcp-client-uuid could not be resolved',
    TCP_CLIENT_LTP_NOT_FOUND: 'tcp-client LTP could not be found in config-file',
    URL_COULD_NOT_BE_RESOLVED: 'url could not be resolved',
    API_KEY_COULD_NOT_BE_RESOLVED: 'api-key could not be resolved',
    INDEX_ALIAS_COULD_NOT_BE_RESOLVED: 'index-alias could not be resolved',
    SERVICE_RECORDS_POLICY_COULD_NOT_BE_RESOLVED: 'service-records-policy could not be resolved',
    OPERATIONAL_STATE_COULD_NOT_BE_RESOLVED: 'operational-state could not be resolved',
    LIFE_CYCLE_STATE_COULD_NOT_BE_RESOLVED: 'life-cycle-state could not be resolved',
    UNKNOWN_ERROR_OCCURRED: 'unknown error occurred',
};

ERRORS.knownErrors = new Set(Object.values(ERRORS));

module.exports = ERRORS;
