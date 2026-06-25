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
  MOST_RECENT_END_TIME_PROVIDE_ERROR: 'mostRecentPeriodEndTime could not be provided',
  MOST_RECENT_END_TIME_24_PROVIDE_ERROR: 'mostRecentPeriodEndTime24 could not be provided',
  
  // Update Most Recent errors
  
  // Internal functions
  MOST_RECENT_PERIOD_END_TIME_NOT_PROVIDED: 'mostRecentPeriodEndTime not provided',
  MOST_RECENT_PERIOD_END_TIME_INVALID: 'mostRecentPeriodEndTime invalid',
  MOST_RECENT_PERIOD_END_TIME24_NOT_PROVIDED: 'mostRecentPeriodEndTime24 not provided',
  MOST_RECENT_PERIOD_END_TIME24_INVALID: 'mostRecentPeriodEndTime24 invalid',

  GRANULARITY_PERIOD_NOT_PROVIDED: 'granularityPeriod not provided',
  GRANULARITY_PERIOD_INVALID: 'granularityPeriod invalid',
  
  PERIOD_END_TIME_NOT_PROVIDED: 'periodEndTime not provided',
  PERIOD_END_TIME_INVALID: 'periodEndTime invalid',
  
  // General error
  GENERAL_ERROR: 'General processing error'
};

module.exports = ERRORS;



