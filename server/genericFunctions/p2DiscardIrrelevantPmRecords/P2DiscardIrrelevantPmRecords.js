'use strict';

const ERRORS = require('./ErrorsEnum');
const ISO_DATE_TIME_REGEX =
  /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})((\.[0-9]{1,}){0,1})(Z|[\+\-][0-9]{2}:[0-9]{2})$/;

const GRANULARITY_15_MIN = 'GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN';
const GRANULARITY_24_HOURS = 'GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS';

/**
 * Discards already processed PM records.
 *
 * @param {Object} input
 * @param {Array<Object>} input.historical-performance-data-list
 * @param {string} input.former-most-recent-period-end-time
 * @param {string} input.former-most-recent-period-end-time-24
 * @returns {Object}
 */
function p2DiscardIrrelevantPmRecords(input) {
  try {
    const validation = validateInput(input);

    if (validation != VALIDATION_OK) {
      return validation;
    }

    const historicalPerformanceDataList =
      input['historical-performance-data-list'];

    const formerMostRecentPeriodEndTime =
      input['former-most-recent-period-end-time'];

    const formerMostRecentPeriodEndTime24 =
      input['former-most-recent-period-end-time-24'];

    let newMostRecentPeriodEndTime = formerMostRecentPeriodEndTime;
    let newMostRecentPeriodEndTime24 = formerMostRecentPeriodEndTime24;

    let amountReceived = [];
    const filteredHistoricalPerformanceDataList = [];

    let errorCode = VALIDATION_OK;
    for (const record of historicalPerformanceDataList) {
      const granularityPeriod = record['granularity-period'];
      const periodEndTime = record['period-end-time'];

      errorCode = validateRecord(record);

      if (errorCode != VALIDATION_OK) {
        break;
      }

      const updateResult = updateNewMostRecentPeriodEndTime({
        'new-most-recent-period-end-time': newMostRecentPeriodEndTime,
        'new-most-recent-period-end-time-24': newMostRecentPeriodEndTime24,
        'granularity-period': granularityPeriod,
        'period-end-time': periodEndTime
      });

      if (typeof updateResult === "string") {
        errorCode = updateResult;
        break;
      }

      newMostRecentPeriodEndTime = updateResult['new-most-recent-period-end-time'];
      newMostRecentPeriodEndTime24 = updateResult['new-most-recent-period-end-time-24'];

      const isRelevant = isRecordNewerThanFormerTimestamp({
        granularityPeriod,
        periodEndTime,
        formerMostRecentPeriodEndTime,
        formerMostRecentPeriodEndTime24
      });

      if (!isRelevant) {
        continue;
      }

      filteredHistoricalPerformanceDataList.push(record);

      const countResult = countReceived15MinPmSlice({
        'amount-received': amountReceived,
        'granularity-period': granularityPeriod,
        'period-end-time': periodEndTime
      });

      if (typeof countResult === "string") {
        errorCode = countResult;
        break;
      }

      amountReceived = countResult['amount-received'];
    }

    if (errorCode != VALIDATION_OK) {
      return errorCode;
    }

    return {
      'filtered-historical-performance-data-list': filteredHistoricalPerformanceDataList,
      'new-most-recent-period-end-time': newMostRecentPeriodEndTime,
      'new-most-recent-period-end-time-24': newMostRecentPeriodEndTime24,
      'amount-received': amountReceived
    };
  } catch (error) {
    return ERRORS.GENERAL_ERROR;
  }
}

const VALIDATION_OK = "VALIDATION_PASSED";
function validateInput(input) {
  if (!input || typeof input !== 'object') {
    return ERRORS.GENERAL_ERROR;
  }

  if (!Object.prototype.hasOwnProperty.call(input, 'historical-performance-data-list')) {
    return ERRORS.HISTORICAL_PERF_NOT_PROVIDED;
  }

  if (!Array.isArray(input['historical-performance-data-list'])) {
    return ERRORS.HISTORICAL_PERF_INVALID;
  }

  if (!Object.prototype.hasOwnProperty.call(input, 'former-most-recent-period-end-time')) {
    return ERRORS.FORMER_MRPET_NOT_PROVIDED;
  }

  if (!isValidDateTime(input['former-most-recent-period-end-time'])) {
    return ERRORS.FORMER_MRPET_INVALID;
  }

  if (!Object.prototype.hasOwnProperty.call(input, 'former-most-recent-period-end-time-24')) {
    return ERRORS.FORMER_MRPET24_NOT_PROVIDED;
  }

  if (!isValidDateTime(input['former-most-recent-period-end-time-24'])) {
    return ERRORS.FORMER_MRPET24_INVALID;
  }

  return VALIDATION_OK;
}

function validateRecord(record) {
  if (!record || typeof record !== 'object') {
    return ERRORS.HISTORICAL_PERF_INVALID;
  }

  const granularityPeriod = record['granularity-period'];
  const periodEndTime = record['period-end-time'];

  if (!granularityPeriod) {
    return ERRORS.GRAN_NOT_PROVIDED;
  }

  if (!granularityPeriod.endsWith(GRANULARITY_15_MIN) && !granularityPeriod.endsWith(GRANULARITY_24_HOURS)) {
    return ERRORS.GRAN_INVALID;
  }

  if (!periodEndTime) {
    return ERRORS.PERIOD_END_TIME_NOT_PROV;
  }

  if (!isValidDateTime(periodEndTime)) {
    return ERRORS.PERIOD_END_TIME_INVALID;
  }

  if (!Object.prototype.hasOwnProperty.call(record, 'performance-data')) {
    return ERRORS.HISTORICAL_PERF_INVALID;
  }

  return VALIDATION_OK;
}

function isRecordNewerThanFormerTimestamp({
  granularityPeriod,
  periodEndTime,
  formerMostRecentPeriodEndTime,
  formerMostRecentPeriodEndTime24
}) {
  if (granularityPeriod.endsWith(GRANULARITY_15_MIN)) {
    return new Date(periodEndTime) > new Date(formerMostRecentPeriodEndTime);
  }

  if (granularityPeriod.endsWith(GRANULARITY_24_HOURS)) {
    return new Date(periodEndTime) > new Date(formerMostRecentPeriodEndTime24);
  }

  return false;
}

function updateNewMostRecentPeriodEndTime(input) {
  try {
    const newMostRecentPeriodEndTime = input['new-most-recent-period-end-time'];

    const newMostRecentPeriodEndTime24 = input['new-most-recent-period-end-time-24'];

    const granularityPeriod = input['granularity-period'];
    const periodEndTime = input['period-end-time'];

    if (!isValidDateTime(newMostRecentPeriodEndTime)) {
      return ERRORS.NMRPET_INVALID;
    }

    if (!isValidDateTime(newMostRecentPeriodEndTime24)) {
      return ERRORS.NMRPET24_INVALID;
    }

    if (!granularityPeriod.endsWith(GRANULARITY_15_MIN) && !granularityPeriod.endsWith(GRANULARITY_24_HOURS)) {
      return ERRORS.GRAN_INVALID;
    }

    if (!isValidDateTime(periodEndTime)) {
      return ERRORS.PERIOD_END_TIME_INVALID;
    }

    let updated15Min = newMostRecentPeriodEndTime;
    let updated24Hours = newMostRecentPeriodEndTime24;

    if (
      granularityPeriod.endsWith(GRANULARITY_15_MIN) &&
      new Date(periodEndTime) > new Date(newMostRecentPeriodEndTime)
    ) {
      updated15Min = periodEndTime;
    }

    if (
      granularityPeriod.endsWith(GRANULARITY_24_HOURS) &&
      new Date(periodEndTime) > new Date(newMostRecentPeriodEndTime24)
    ) {
      updated24Hours = periodEndTime;
    }

    return {
      'new-most-recent-period-end-time': updated15Min,
      'new-most-recent-period-end-time-24': updated24Hours
    };
  } catch (error) {
    return ERRORS.NMRPET_COULDNT_PROVIDE;
  }
}

function countReceived15MinPmSlice(input) {
  try {
    const amountReceived = input['amount-received'];
    const granularityPeriod = input['granularity-period'];
    const periodEndTime = input['period-end-time'];

    if (!Array.isArray(amountReceived)) {
      return ERRORS.RECV_INVALID;
    }

    if (!granularityPeriod.endsWith(GRANULARITY_15_MIN) && !granularityPeriod.endsWith(GRANULARITY_24_HOURS)) {
      return ERRORS.GRAN_INVALID;
    }

    if (!isValidDateTime(periodEndTime)) {
      return ERRORS.PERIOD_END_TIME_INVALID;
    }

    if (!granularityPeriod.endsWith(GRANULARITY_15_MIN)) {
      return {
        'amount-received': amountReceived
      };
    }

    const receivedDate = formatDateYYYYMMDD(periodEndTime);

    const existingEntry = amountReceived.find(
      item => item.date === receivedDate
    );

    if (existingEntry) {
      existingEntry.count += 1;
    } else {
      amountReceived.push({
        date: receivedDate,
        count: 1
      });
    }

    return {
      'amount-received': amountReceived
    };
  } catch (error) {
    return ERRORS.GENERAL_ERROR;
  }
}

function isValidDateTime(value) {
  if (typeof value !== 'string') {
    return false;
  }

  if (!ISO_DATE_TIME_REGEX.test(value)) {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function formatDateYYYYMMDD(dateTimeString) {
  const date = new Date(dateTimeString);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}/${month}/${day}`;
}

module.exports = p2DiscardIrrelevantPmRecords;