const ERRORS = {
    ERR_CONFIG_NOT_ACCESSIBLE : "configFile not found or not accessible",
    ERR_INVALID_JSON : "configFile is not valid JSON",
    ERR_INVALID_SCHEMA : "configFile does not conform to the expected schema",
    ERR_FUNCTION_NOT_FOUND : "functionName not found in configFile",
    ERR_UNKNOWN : "unknown error occurred",
    ERR_FUNCTION_NAME_NOT_PROVIDED : "functionName is mandatory"
}

const knownErrors = new Set([
    ERRORS.ERR_CONFIG_NOT_ACCESSIBLE,
    ERRORS.ERR_INVALID_JSON,
    ERRORS.ERR_INVALID_SCHEMA,
    ERRORS.ERR_FUNCTION_NOT_FOUND,
    ERRORS.ERR_UNKNOWN,
    ERRORS.ERR_FUNCTION_NAME_NOT_PROVIDED //not provided in spec but added for better error handling
]);

module.exports = { ERRORS, knownErrors };