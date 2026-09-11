const ERRORS = {
  // Input validation errors
  PARAMETERS_NOT_PROVIDED: 'parameters not provided',
  PARAMETERS_INVALID: 'parameters invalid',
  HISTORICAL_DATA_LIST_NOT_PROVIDED: 'historicalPerformanceDataList not provided',
  HISTORICAL_DATA_LIST_INVALID: 'historicalPerformanceDataList invalid',
  TRANSMISSION_MODE_LIST_NOT_PROVIDED: 'transmissionModeList not provided',
  TRANSMISSION_MODE_LIST_INVALID: 'transmissionModeList invalid',

  // Processing errors
  INTERVAL_CAPACITY_ERROR: 'interval capacity could not be calculated',
  OUT_OF_RANGE_LEVELS_ERROR: 'out of range levels could not be removed',
  DEFAULT_VALUES_ERROR: 'default values could not be removed',

  // Output errors
  HISTORICAL_DATA_LIST_PROVIDE_ERROR: 'historicalPerformanceDataList could not be provided',

  // General error
  GENERAL_ERROR: 'general processing error'
};

module.exports = ERRORS;

