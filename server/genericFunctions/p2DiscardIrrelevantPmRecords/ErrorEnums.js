const ERRORS = {
  HISTORICAL_PERF_NOT_PROVIDED: "historicalPerformanceDataList not provided",
  HISTORICAL_PERF_INVALID: "historicalPerformanceDataList invalid",

  FORMER_MRPET_NOT_PROVIDED: "formerMostRecentPeriodEndTime not provided",
  FORMER_MRPET_INVALID: "formerMostRecentPeriodEndTime invalid",

  FORMER_MRPET24_NOT_PROVIDED: "formerMostRecentPeriodEndTime24 not provided",
  FORMER_MRPET24_INVALID: "formerMostRecentPeriodEndTime24 invalid",

  HISTORICAL_PERF_FILTER_ERROR: "historicalPerformanceDataList filtering error",

  UPDATE_NMRPET_ERROR: "updateNewMostRecentPeriodEndTime update error",
  NUMBER_RECV_15PM_COULDNT_UPDATE: "number of received 15min PM records could not be updated",

  // Internal processing
  RECV_NOT_UPDATED: "received not provided",
  RECV_INVALID: "received invalid",
  GRAN_NOT_PROVIDED: "granularityPeriod not provided",
  GRAN_INVALID: "granularityPeriod invalid",
  PERIOD_END_TIME_NOT_PROV: "periodEndTime not provided",
  PERIOD_END_TIME_INVALID: "periodEndTime invalid",

  NMRPET_NOT_PROVIDED: "newMostRecentPeriodEndTime not provided",
  NMRPET_INVALID: "newMostRecentPeriodEndTime invalid",
  NMRPET24_NOT_PROVIDED: "newMostRecentPeriodEndTime24 not provided",
  NMRPET24_INVALID: "newMostRecentPeriodEndTime24 invalid",
  NMRPET_COULDNT_PROVIDE: "newMostRecentPeriodEndTime could not be provided",

  GENERAL_ERROR: "General processing error"
}

module.exports = ERRORS;
