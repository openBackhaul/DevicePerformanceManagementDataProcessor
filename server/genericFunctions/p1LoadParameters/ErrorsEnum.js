const ERRORS = {
    ERR_CONFIG_NOT_ACCESSIBLE : "configFile not found or not accessible",
    ERR_INVALID_JSON : "configFile is not valid JSON",
    ERR_INVALID_SCHEMA : "configFile does not conform to the expected schema",
    ERR_FUNCTION_NOT_FOUND : "functionName not found in configFile",
    ERR_UNKNOWN : "unknown error occurred",
    ERR_FUNCTION_NAME_NOT_PROVIDED : "functionName is mandatory" //not provided in spec but added for better error handling
};

ERRORS.knownErrors = new Set(Object.values(ERRORS));

module.exports = { ERRORS };