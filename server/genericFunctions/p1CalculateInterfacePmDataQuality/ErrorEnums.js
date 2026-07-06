const ERRORS = {
  HISTORICAL_PERF_NOT_PROVIDED: "historicalPerformanceDataList not provided",
  HISTORICAL_PERF_INVALID: "historicalPerformanceDataList invalid",

  FORMER_MRPET_NOT_PROVIDED: "formerMostRecentPeriodEndTime not provided",
  FORMER_MRPET_INVALID: "formerMostRecentPeriodEndTime invalid",

  FORMER_MRPET24_NOT_PROVIDED: "formerMostRecentPeriodEndTime24 not provided",
  FORMER_MRPET24_INVALID: "formerMostRecentPeriodEndTime24 invalid",

  HISTORICAL_PERF_FILTER_ERROR: "historicalPerformanceDataList filtering error",
  UPDATE_NMRPET_UPDATE_ERROR: "updateNewMostRecentPeriodEndTime update error",
  NUMBER_RECV_15M_COULDNT_UPDATED: "number of received 15min PM records could not be updated",

  GENERAL_ERROR: "General processing error"
}

module.exports = ERRORS;

