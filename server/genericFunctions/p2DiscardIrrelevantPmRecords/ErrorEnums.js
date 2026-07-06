const ERRORS = {
  UUID_NOT_PROVIDED = "uuid not provided",
  UUID_INVALID = "uuid invalid",

  FORMER_MRPET_NOT_PROVIDED = "formerMostRecentPeriodEndTime not provided",
  FORMER_MRPET_INVALID = "formerMostRecentPeriodEndTime invalid",

  NEW_MRPET_NOT_PROVIDED = "newMostRecentPeriodEndTime not provided",
  NEW_MRPET_NOT_INVALID = "newMostRecentPeriodEndTime invalid",

  AMOUNTREC_NOT_PROVIDED = "amountReceived not provided",
  AMOUNTREC_INVALID = "amountReceived invalid",

  EXP_AMOUNT_COULDNT_BE_CALC = "expected amount could not be calculated",
  INTFPMDATAQUALITY_COULDNT_BE_CALC = "interfacePmDataQuality could not be calculated",

  GENERAL_ERROR: "General processing error"
}

module.exports = ERRORS;

