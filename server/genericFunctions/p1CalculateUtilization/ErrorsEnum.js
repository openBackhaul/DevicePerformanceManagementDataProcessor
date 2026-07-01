const ERRORS = {
  // p1CalculateUtilization
  HIST_PERF_DATA_NOT_PROVIDED: 'historicalPerformanceData not provided',
  HIST_PERF_DATA_INVALID: 'historicalPerformanceData invalid',
  AGG_GROUP_NOT_PROVIDED: 'aggregationGroup not provided',
  AGG_GROUP_INVALID: 'aggregationGroup invalid',
  RESULT_CC_NOT_PROVIDED: 'result-cc not provided',
  RESULT_CC_INVALID: 'result-cc invalid',
  UTILIZATION_COULDNT_ADD: "Utilization could not be added",

  // calculateTotalAirInterfaceIntervalCapacity
  LTP_LIST_NOT_PROVIDED: 'logicalTerminationPoint list not provided',
  LTP_LIST_INVALID: 'logicalTerminationPoint list invalid',
  PSY_SERVER_LTP_LIST_NOT_PROVIDED: 'physicalServerLtpList not provided',
  PSY_SERVER_LTP_LIST_INVALID: 'physicalServerLtpList invalid',
  PERIOD_ENDTIME_NOT_PROVIDED: 'periodEndTime not provided',
  PERIOD_ENDTIME_INVALID: 'periodEndTime invalid',
  TOTAL_AIR_IF_INT_CAP_COULDNT_PROVIDED: 'totalAirInterfaceIntervalCapacity could not be provided',

  // calculateUtilization
  TOTAL_BYTE_OUTPUT_NOT_PROVIDED: 'totalBytesOutput not provided',
  TOTAL_BYTE_OUTPUT_INVALID: 'totalBytesOutput invalid',
  TOTAL_AIR_IF_INT_CAP_NOT_PROVIDED: 'totalAirInterfaceIntervalCapacity not provided',
  TOTAL_AIR_IF_INT_CAP_INVALID: 'totalAirInterfaceIntervalCapacity invalid',
  TIME_PERIOD_NOT_PROVIDED: 'timePeriod not provided',
  TIME_PERIOD_INVALID: 'timePeriod invalid',
  UTILIZATION_COULDNT_PROVIDED: 'utilization could not be provided',

  GENERAL_ERROR: "General processing error"
}

module.exports = ERRORS;