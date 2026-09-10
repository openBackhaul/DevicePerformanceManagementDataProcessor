'use strict';

const p1CalculateIntervalCapacity = require('../../../../../genericFunctions/p1CalculateIntervalCapacity/P1CalculateIntervalCapacity');
const p1RemoveOutOfRangeLevels = require('../../../../../genericFunctions/p1RemoveOutOfRangeLevels/P1RemoveOutOfRangeLevels');
const p1RemoveDefaultValues = require('../../../../../genericFunctions/p1RemoveDefaultValues/P1RemoveDefaultValues');

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
    if (!isObject(input)) {
      return ERRORS.GENERAL_ERROR;
    }

    if (!Object.prototype.hasOwnProperty.call(input, 'parameters') || input['parameters'] === undefined) {
      return ERRORS.PARAMETERS_NOT_PROVIDED;
    }

    if (!isObject(input['parameters'])) {
      return ERRORS.PARAMETERS_INVALID;
    }

    if (
      !Object.prototype.hasOwnProperty.call(input, 'historical-performance-data-list') ||
      input['historical-performance-data-list'] === undefined
    ) {
      return ERRORS.HISTORICAL_DATA_LIST_NOT_PROVIDED;
    }

    if (!Array.isArray(input['historical-performance-data-list'])) {
      return ERRORS.HISTORICAL_DATA_LIST_INVALID;
    }

    if (
      !Object.prototype.hasOwnProperty.call(input, 'transmission-mode-list') ||
      input['transmission-mode-list'] === undefined
    ) {
      return ERRORS.TRANSMISSION_MODE_LIST_NOT_PROVIDED;
    }

    if (!Array.isArray(input['transmission-mode-list'])) {
      return ERRORS.TRANSMISSION_MODE_LIST_INVALID;
    }

    const parameters = input['parameters'];
    const transmissionModeList = input['transmission-mode-list'];

    /*
     * Deep-clone the historical-performance-data-list so that
     * modifications do not mutate the caller's objects, and if processing
     * stops midway due to an error, the caller's input is not left in a partially modified state.
     */
    const historicalPerformanceDataList = deepClone(input['historical-performance-data-list']);

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
        !isObject(pmSlice['performance-data'])
      ) {
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
        intervalCapacityResult = p1CalculateIntervalCapacity({
          'time-xstates-list': timeXStatesList,
          'transmission-mode-list': transmissionModeList
        });
      } catch (error) {
        return ERRORS.INTERVAL_CAPACITY_ERROR;
      }

      if (
        !isObject(intervalCapacityResult) ||
        !Object.prototype.hasOwnProperty.call(intervalCapacityResult, 'interval-capacity')
      ) {
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

      if (
        !isObject(removeOutOfRangeResult) ||
        !isObject(removeOutOfRangeResult['performance-data'])
      ) {
        return ERRORS.OUT_OF_RANGE_LEVELS_ERROR;
      }

      performanceData = removeOutOfRangeResult['performance-data'];

      // =====================================================
      // 3. Remove default values
      // =====================================================
      let removeDefaultValuesResult;
      try {
        removeDefaultValuesResult = p1RemoveDefaultValues({
          'parameters': removeDefaultValuesParameters,
          'input-object': performanceData
        });
      } catch (error) {
        return ERRORS.DEFAULT_VALUES_ERROR;
      }

      if (
        !isObject(removeDefaultValuesResult) ||
        !isObject(removeDefaultValuesResult['cleaned-object'])
      ) {
        return ERRORS.DEFAULT_VALUES_ERROR;
      }

      performanceData = removeDefaultValuesResult['cleaned-object'];

      // Store the completely processed performance-data back into the slice
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
 *      15min first (priority 0)
 *      24h second (priority 1)
 *      other third (priority 2)
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

  return String(a['period-end-time']).localeCompare(String(b['period-end-time']));
}

/**
 * Converts granularity-period into a sorting priority.
 *
 * OpenBackhaul uses standard YANG identifiers such as:
 * - air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN
 * - air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS
 * as well as shorthand forms ('15min', '24h').
 */
function getGranularityPriority(granularity) {
  if (typeof granularity !== 'string') {
    return Number.MAX_SAFE_INTEGER;
  }

  const lower = granularity.toLowerCase();

  // 15-minute intervals (priority 0)
  if (
    lower.includes('15-min') ||
    lower.includes('15min') ||
    lower.includes('15m') ||
    lower.includes('15-minute') ||
    lower.includes('15minute')
  ) {
    return 0;
  }

  // 24-hour intervals (priority 1)
  if (
    lower.includes('24-hour') ||
    lower.includes('24hour') ||
    lower.includes('24h') ||
    lower.includes('1-day') ||
    lower.includes('1day') ||
    lower.includes('1d')
  ) {
    return 1;
  }

  // Unknown / other granularities (priority 2)
  return 2;
}

/**
 * Extracts the configuration of a sub-function from the
 * hierarchical parameters object.
 *
 * Returns an object with a 'parameter' array compatible with sub-functions
 * (like p1RemoveOutOfRangeLevels and p1RemoveDefaultValues).
 */
function getSubFunctionParameters(parameters, functionName) {
  if (!isObject(parameters)) {
    return { parameter: [] };
  }

  let subConfig = null;

  if (parameters[functionName] !== undefined) {
    subConfig = parameters[functionName];
  } else if (Array.isArray(parameters['sub-function'])) {
    subConfig = parameters['sub-function'].find(entry => {
      if (!isObject(entry)) {
        return false;
      }
      return (
        entry['function-name'] === functionName ||
        entry.functionName === functionName ||
        entry.name === functionName
      );
    });
  }

  if (!subConfig) {
    return { parameter: [] };
  }

  if (Array.isArray(subConfig)) {
    return { parameter: subConfig };
  }

  if (isObject(subConfig) && Array.isArray(subConfig.parameter)) {
    return subConfig;
  }

  if (isObject(subConfig) && Array.isArray(subConfig.parameters)) {
    return { parameter: subConfig.parameters };
  }

  if (isObject(subConfig)) {
    return subConfig;
  }

  return { parameter: [] };
}

/**
 * Deep-clones an object or array.
 * Uses native structuredClone if available, falling back to JSON serialization.
 *
 * @param {*} value
 * @returns {*}
 */
function deepClone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

module.exports = p2IterateAiPmSlices;