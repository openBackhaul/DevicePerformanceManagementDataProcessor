const ERRORS = {
  // Parameters
  PARAMETERS_NOT_PROVIDED: 'parameters not provided',
  PARAMETERS_INVALID: 'parameters invalid',

  // Historical data list
  HISTORICAL_DATA_LIST_NOT_PROVIDED: 'historicalPerformanceDataList not provided',
  HISTORICAL_DATA_LIST_INVALID: 'historicalPerformanceDataList invalid',

  // Processing errors (as per YAML contract)
  KPI_CALCULATION_FAILED: 'Ethernet KPIs could not be calculated',
  DEFAULT_VALUES_REMOVAL_FAILED: 'Default values could not be removed',
  UTILIZATION_CALCULATION_FAILED: 'Utilization could not be calculated',

  // Output errors
  HISTORICAL_DATA_LIST_OUTPUT_FAILED: 'historicalPerformanceDataList could not be provided',

  MOST_RECENT_PERIOD_END_TIME_FAILED: 'mostRecentPeriodEndTime could not be provided',
  MOST_RECENT_PERIOD_END_TIME_24_FAILED: 'mostRecentPeriodEndTime24 could not be provided',

  // updateMostRecentPeriodEndTime
  MOST_RECENT_PERIOD_END_TIME_NOT_PROVIDED: 'mostRecentPeriodEndTime not provided',
  MOST_RECENT_PERIOD_END_TIME_INVALID: 'mostRecentPeriodEndTime invalid',
  MOST_RECENT_PERIOD_END_TIME_24_NOT_PROVIDED: 'mostRecentPeriodEndTime24 not provided',
  MOST_RECENT_PERIOD_END_TIME_24_INVALID: 'mostRecentPeriodEndTime24 invalid',

  GRAN_PERIOD_NOT_PROV: 'granularityPeriod not provided',
  GRAN_PERIOD_INVALID: 'granularityPeriod invalid',

  PERIOD_ENDTIME_NOT_PROVIDED: 'periodEndTime not provided',
  PERIOD_ENDTIME_INVALID: 'periodEndTime invalid',

  // General
  GENERAL_ERROR: 'General processing error',
};

module.exports = ERRORS;
