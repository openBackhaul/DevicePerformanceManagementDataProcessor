'use strict';

const p1CalculateIntervalCapacity = require('../../../../../genericFunctions/p1CalculateIntervalCapacity/P1CalculateIntervalCapacity');
const p1RemoveOutOfRangeLevels = require('../../../../../genericFunctions/p1RemoveOutOfRangeLevels/p1RemoveOutOfRangeLevels');
const p1RemoveDefaultValues = require('../../../../../genericFunctions/p1RemoveDefaultValues/p1RemoveDefaultValues');

const ERRORS = require('./ErrorsEnum');

/**
 * Iterates through all AirInterface historical performance data slices
 * and applies:
 *
 * 1. p1CalculateIntervalCapacity
 * 2. p1RemoveOutOfRangeLevels
 * 3. p1RemoveDefaultValues
 *
 * 15min PM slices are always processed before 24h PM slices.
 *
 * @param {Object} input
 * @returns {Promise<Object|string>}
 */
async function p2IterateAiPmSlices(input) {

  try {

    // ---------------------------------------------------------
    // Input validation
    // ---------------------------------------------------------
    if (!input || !Object.prototype.hasOwnProperty.call(input, 'parameters')) {
      return ERRORS.PARAMETERS_NOT_PROVIDED
    }

    if (!isObject(input['parameters'])) {
      return ERRORS.PARAMETERS_INVALID;
    }

    if (!Object.prototype.hasOwnProperty.call(input, 'historical-performance-data-list')) {
      return ERRORS.HISTORICAL_DATA_LIST_NOT_PROVIDED;
    }

    if (!Array.isArray(input['historical-performance-data-list'])) {
      return ERRORS.HISTORICAL_DATA_LIST_INVALID;
    }

    if (!Object.prototype.hasOwnProperty.call(input, 'transmission-mode-list')) {
      return ERRORS.TRANSMISSION_MODE_LIST_NOT_PROVIDED;
    }

    if (!Array.isArray(input['transmission-mode-list'])) {
      return ERRORS.TRANSMISSION_MODE_LIST_INVALID;
    }

    const parameters = input['parameters'];
    const transmissionModeList = input['transmission-mode-list'];

    /*
     * Clone the array because sorting with Array.sort() changes
     * the original input array.
     *
     * We keep the PM objects themselves because they will be
     * progressively updated during processing.
     */
    const historicalPerformanceDataList = [...input['historical-performance-data-list']];

    // ---------------------------------------------------------
    // Validate historical PM records
    // ---------------------------------------------------------
    for (const pmSlice of historicalPerformanceDataList) {
      if (!isObject(pmSlice)) {
        return ERRORS.HISTORICAL_DATA_LIST_INVALID;
      }

      if (
        !Object.prototype.hasOwnProperty.call(pmSlice, 'granularity-period') ||
        !Object.prototype.hasOwnProperty.call(pmSlice, 'period-end-time') ||
        !isObject(pmSlice['performance-data'])) {
        return ERRORS.HISTORICAL_DATA_LIST_INVALID;
      }
    }


    // ---------------------------------------------------------
    // Sort PM slices
    //
    // Requirement:
    // All 15min slices MUST be processed before 24h slices.
    //
    // Within the same granularity, period-end-time determines
    // processing order.
    // ---------------------------------------------------------
    historicalPerformanceDataList.sort(comparePmSlices);

    // ---------------------------------------------------------
    // Retrieve parameters of sub-functions
    // ---------------------------------------------------------
    const removeOutOfRangeParameters = getSubFunctionParameters(parameters, 'p1RemoveOutOfRangeLevels');

    const removeDefaultValuesParameters = getSubFunctionParameters(parameters, 'p1RemoveDefaultValues');

    // ---------------------------------------------------------
    // Iterate PM slices
    // ---------------------------------------------------------
    for (const pmSlice of historicalPerformanceDataList) {
      let performanceData = pmSlice['performance-data'];

      // =====================================================
      // 1. Calculate interval capacity
      // =====================================================
      const timeXStatesList = performanceData['time-xstates-list'];

      let intervalCapacityResult;
      try {
        intervalCapacityResult =
          p1CalculateIntervalCapacity({
            'time-xstates-list':
              Array.isArray(timeXStatesList)
                ? timeXStatesList
                : [],
            'transmission-mode-list': transmissionModeList
          });
      } catch (error) {
        return ERRORS.INTERVAL_CAPACITY_ERROR;
      }

      if (!isObject(intervalCapacityResult) ||
        !Object.prototype.hasOwnProperty.call(intervalCapacityResult, 'interval-capacity')) {
        return ERRORS.INTERVAL_CAPACITY_ERROR;
      }

      performanceData['interval-capacity'] = intervalCapacityResult['interval-capacity'];

      // =====================================================
      // 2. Remove out-of-range levels
      // =====================================================
      let removeOutOfRangeResult;

      try {
        removeOutOfRangeResult = p1RemoveOutOfRangeLevels({
            'parameters': removeOutOfRangeParameters,
            'performance-data': performanceData
          });

      } catch (error) {
        return ERRORS.OUT_OF_RANGE_LEVELS_ERROR;
      }

      if (!isObject(removeOutOfRangeResult) ||
        !isObject(removeOutOfRangeResult['performance-data'])) {
        return ERRORS.OUT_OF_RANGE_LEVELS_ERROR;
      }

      performanceData = removeOutOfRangeResult['performance-data'];

      // =====================================================
      // 3. Remove default values
      // =====================================================
      let removeDefaultValuesResult;

      try {
        removeDefaultValuesResult =
          p1RemoveDefaultValues({
            parameters: removeDefaultValuesParameters,
            'input-object': performanceData
          });

      } catch (error) {
        return ERRORS.DEFAULT_VALUES_ERROR;
      }

      if (!isObject(removeDefaultValuesResult) ||
        !isObject(removeDefaultValuesResult['cleaned-object'])) {
        return ERRORS.DEFAULT_VALUES_ERROR;
      }

      performanceData = removeDefaultValuesResult['cleaned-object'];

      // -----------------------------------------------------
      // Store the completely processed performance-data
      // back into the current PM slice
      // -----------------------------------------------------

      pmSlice['performance-data'] = performanceData;
    }

    // ---------------------------------------------------------
    // Output
    // ---------------------------------------------------------
    return {
      'historical-performance-data-list': historicalPerformanceDataList
    };

  } catch (error) {
    return ERRORS.GENERAL_ERROR;
  }
}


/**
 * Checks whether a value is a non-null object.
 */
function isObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}


/**
 * Sorts PM slices according to:
 *
 * 1. granularity-period
 *      15min first
 *      24h second
 *
 * 2. period-end-time
 *      oldest first
 */
function comparePmSlices(a, b) {

  const granularityA = getGranularityPriority(a['granularity-period']);

  const granularityB = getGranularityPriority(b['granularity-period']);

  if (granularityA !== granularityB) {
    return granularityA - granularityB;
  }

  const timeA = new Date(a['period-end-time']).getTime();

  const timeB = new Date(b['period-end-time']).getTime();

  if (!Number.isNaN(timeA) && !Number.isNaN(timeB)) {
    return timeA - timeB;
  }


  /*
   * Fallback if period-end-time cannot be converted
   * into a Date.
   *
   * ISO-8601 timestamps can also be compared
   * lexicographically.
   */
  return String(a['period-end-time']).localeCompare(String(b['period-end-time']));
}


/**
 * Converts granularity-period into a sorting priority.
 *
 * Supports some possible representations because OpenBackhaul
 * models sometimes use slightly different strings.
 */
function getGranularityPriority(granularity) {

  if (typeof granularity !== 'string') {
    return Number.MAX_SAFE_INTEGER;
  }

  const normalized =
    granularity
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/-/g, '');


  if (
    normalized === '15min' ||
    normalized === '15m' ||
    normalized === '15minute' ||
    normalized === '15minutes'
  ) {
    return 0;
  }


  if (
    normalized === '24h' ||
    normalized === '24hour' ||
    normalized === '24hours' ||
    normalized === '1d' ||
    normalized === '1day'
  ) {
    return 1;
  }


  /*
   * Unknown granularities are processed after the
   * known 15min and 24h records.
   */
  return 2;
}


/**
 * Extracts the configuration of a sub-function from the
 * hierarchical parameters object.
 *
 * This helper supports both:
 *
 * parameters: {
 *   p1RemoveOutOfRangeLevels: {...}
 * }
 *
 * and structures containing a "sub-function" array.
 */
function getSubFunctionParameters(parameters, functionName) {
  if (!isObject(parameters)) {
    return {};
  }

  // Direct representation
  if (isObject(parameters[functionName])) {
    return parameters[functionName];
  }


  // Example:
  //
  // "sub-function": [
  //   {
  //      "function-name": "p1RemoveOutOfRangeLevels",
  //      ...
  //   }
  // ]

  if (Array.isArray(parameters['sub-function'])) {

    const subFunction =
      parameters['sub-function'].find(entry => {

        if (!isObject(entry)) {
          return false;
        }

        return (
          entry['function-name'] === functionName ||
          entry.functionName === functionName ||
          entry.name === functionName
        );
      });


    if (subFunction) {
      return subFunction;
    }
  }


  return {};
}


module.exports = p2IterateAiPmSlices;