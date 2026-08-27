const ERRORS = {
  UUID_NOT_PROVIDED: "uuid not provided",
  UUID_INVALID: "uuid invalid",

  FORMER_MRPET_NOT_PROVIDED: "formerMostRecentPeriodEndTime not provided",
  FORMER_MRPET_INVALID: "formerMostRecentPeriodEndTime invalid",

  NEW_MRPET_NOT_PROVIDED: "newMostRecentPeriodEndTime not provided",
  NEW_MRPET_INVALID: "newMostRecentPeriodEndTime invalid",

  AMOUNT_RECV_NOT_PROVIDED: "amountReceived not provided",
  AMOUNT_RECV_INVALID: "amountReceived invalid",

  EXP_AMOUNT_COULDNT_CALC: "expected amount could not be calculated",
  INTF_PM_DATA_QUALITY_COULDNT_CALC: "interfacePmDataQuality could not be calculated",

  // Internal Functions:
  MONITORING_PERIOD_COULNT_CALC: "monitoring period length could not be calculated",

  AMOUNT_EXP_COULDNT_CALC: "amount expected could not be calculated",
  AMOUNT_EXP_NOT_PROVIDED: "amountExpected not provided",
  AMOUNT_EXP_INVALID: "amountExpected invalid",

  GENERAL_ERROR: "General processing error"
}

module.exports = ERRORS;
