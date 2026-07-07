const ERRORS = require('./ErrorsEnum');

const GRANULARITY_15_MIN = "ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN";

/**
 * Function p1CategorizeDataVolume
 * Performance data measured during 15-minute periods are categorized by day and hour.
 * 
 * The following parameters are categorized:
 * - period-end-time
 * - total-bytes-output
 * - total-air-interface-interval-capacity
 * - errored-frames-input
 * - dropped-frames-input
 *
 * When 15-minute-values-by-day exceeds two entries, the oldest entries are deleted (for example, entry 31 is older than entry 1).
 * @param {object} input
 * @returns {{ "interface-status": object }}
 */
function p1CategorizeDataVolume(input) {
  try {
    // Start validation input data
    if (!input || typeof input !== "object") {
      ERRORS.GENERAL_ERROR;
    }

    const historicalPerformanceData = input['historical-performance-data'];
    const interfaceStatus = input['interface-status'];

    if ((!historicalPerformanceData && !interfaceStatus) ||
      (historicalPerformanceData == undefined && interfaceStatus == undefined)) {
      return ERRORS.GENERAL_ERROR;
    }

    if (!historicalPerformanceData) {
      return ERRORS.HISTORICAL_PERF_NOT_PROVIDED;
    }

    if (typeof historicalPerformanceData !== "object") {
      return ERRORS.HISTORICAL_PERF_INVALID;
    }

    if (!interfaceStatus) {
      return ERRORS.INTERFACE_STATUS_NOT_PROVVIDED;
    }

    if (typeof interfaceStatus !== "object" || typeof interfaceStatus.uuid !== "string") {
      return ERRORS.INTERFACE_STATUS_INVALID;
    }

    const is15Min = checkGranularity(
      historicalPerformanceData['granularity-period']
    );

    if (!is15Min) {
      return ERRORS.PM_DATA_WRONG_GRAN_PROV;
    }

    const periodEndTime = historicalPerformanceData['period-end-time'];
    const date = new Date(periodEndTime);

    if (!periodEndTime || Number.isNaN(date.getTime())) {
      return ERRORS.HISTORICAL_PERF_INVALID;
    }

    const day = date.getUTCDate();
    const hour = date.getUTCHours();

    if (!Array.isArray(interfaceStatus['15-minute-values-by-day'])) {
      interfaceStatus['15-minute-values-by-day'] = [];
    }

    let valuesByDay = interfaceStatus['15-minute-values-by-day'];

    let dayBucket = valuesByDay.find(entry => entry['day'] === day);

    if (!dayBucket) {
      'dayBucket' = {
        day,
        '15-minute-values-by-hour': initializeHourlyBuckets()
      };

      valuesByDay.push(dayBucket);
    }

    /*
     * Keep only 2 day entries.
     * Important: day 31 is older than day 1, therefore sorting by day number
     * is not enough. We remove the first/oldest inserted entry.
     */
    while (valuesByDay.length > 2) {
      valuesByDay.shift();
    }

    const hourBucket = dayBucket['15-minute-values-by-hour'].find(
      entry => entry.hour === hour
    );

    if (!hourBucket) {
      return ERRORS.PM_DATA_CATEG_FAILED;
    }

    hourBucket['15-minute-values'] = categorizePmData(
      historicalPerformanceData,
      hourBucket['15-minute-values']
    );

    return {
      'interface-status': interfaceStatus
    };

  } catch (error) {
    return ERRORS.GENERAL_ERROR;
  }
}

/**
 * Checks whether PM data has 15-minute granularity.
 *
 * @param {string} granularity
 * @returns {boolean}
 */
function checkGranularity(granularity) {
  return granularity === GRANULARITY_15_MIN;
}

/**
 * Initializes 24 hourly buckets.
 *
 * @returns {Array<object>}
 */
function initializeHourlyBuckets() {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    '15-minute-values': []
  }));
}

/**
 * Appends PM data into the specific day/hour 15-minute bucket.
 *
 * @param {object} historicalPerformanceData
 * @param {Array<object>} fifteenMinuteValues
 * @returns {Array<object>}
 */
function categorizePmData(historicalPerformanceData, fifteenMinuteValues) {
  if (!Array.isArray(fifteenMinuteValues)) {
    fifteenMinuteValues = [];
  }

  const performanceData = historicalPerformanceData['performance-data'] || {};

  const categorizedValue = {
    'period-end-time': historicalPerformanceData['period-end-time'],
    'total-bytes-output': performanceData['total-bytes-output'],
    'total-air-interface-interval-capacity': performanceData['total-air-interface-interval-capacity'],
    'errored-frames-input': performanceData['errored-frames-input'],
    'dropped-frames-input': performanceData['dropped-frames-input']
  };

  fifteenMinuteValues.push(categorizedValue);

  /*
   * Each hour can contain max 4 values:
   * 00, 15, 30, 45 minutes.
   */
  while (fifteenMinuteValues.length > 4) {
    fifteenMinuteValues.shift();
  }

  return fifteenMinuteValues;
}

module.exports = p1CategorizeDataVolume;
