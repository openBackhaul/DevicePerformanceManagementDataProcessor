'use strict';

const ERRORS = require('./ErrorsEnum');
const p1CalculateEthernetKpis = require('../../../../../genericFunctions/p1CalculateEthernetKpis/P1CalculateEthernetKpis');
const p1RemoveDefaultValues = require('../../../../../genericFunctions/p1RemoveDefaultValues/P1RemoveDefaultValues');
const p1CalculateUtilization = require('../../../../../genericFunctions/p1CalculateUtilization/P1CalculateUtilization');
const p1CategorizeDataVolume = require('../../../../../genericFunctions/p1CategorizeDataVolume/P1CategorizeDataVolume');
const p1CalculateBusyHourPerformanceIndicators = require('../../../../../genericFunctions/p1CalculateBusyHourPerformanceIndicators/P1CalculateBusyHourPerformanceIndicators');

const PERIOD_15_MIN = 'GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN';
const PERIOD_24_HOURS = 'GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS';
const PERIOD_UNKNOWN = 'GRANULARITY_PERIOD_TYPE_PERIOD-UNKNOWN';
const PERIOD_NOT_DEFINED = 'GRANULARITY_PERIOD_TYPE_PERIOD-NOT_YET_DEFINED';
const PERIODS = [PERIOD_15_MIN, PERIOD_24_HOURS, PERIOD_UNKNOWN, PERIOD_NOT_DEFINED];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function granularity(slice) {
  return slice['granularity-period'].split(':').pop();
}

function isSlice(slice) {
  return isObject(slice) &&
    typeof slice['granularity-period'] === 'string' &&
    PERIODS.includes(granularity(slice)) &&
    typeof slice['period-end-time'] === 'string' &&
    Number.isFinite(Date.parse(slice['period-end-time'])) &&
    isObject(slice['performance-data']);
}

function validateInput(input) {
  if (!isObject(input)) {
    return ERRORS.GENERAL_ERROR;
  }

  if (input['parameters'] === undefined) {
    return ERRORS.PARAMETERS_NOT_PROVIDED;
  }
  if (!isObject(input['parameters'])) {
    return ERRORS.PARAMETERS_INVALID;
  }

  if (input['historical-performance-data-list'] === undefined) {
    return ERRORS.HISTORICAL_DATA_LIST_NOT_PROVIDED;
  }
  if (!Array.isArray(input['historical-performance-data-list']) ||
      !input['historical-performance-data-list'].every(isSlice)) {
    return ERRORS.HISTORICAL_DATA_LIST_INVALID;
  }

  if (input['result-cc'] === undefined) {
    return ERRORS.RESULT_CC_NOT_PROVIDED;
  }
  if (!isObject(input['result-cc'])) {
    return ERRORS.RESULT_CC_INVALID;
  }

  if (input['interface-status'] === undefined) {
    return ERRORS.INTERFACE_STATUS_NOT_PROVIDED;
  }
  if (!isObject(input['interface-status'])) {
    return ERRORS.INTERFACE_STATUS_INVALID;
  }

  // A missing/null group denotes an EthernetContainer on a single server.
  if (input['aggregation-group'] == null && input['uuid-of-ethernet-container'] == null) {
    return ERRORS.AGGREGATION_GROUP_NOT_PROVIDED;
  }
  if (input['aggregation-group'] != null && !isObject(input['aggregation-group'])) {
    return ERRORS.AGGREGATION_GROUP_INVALID;
  }
  if (typeof input['uuid-of-ethernet-container'] !== 'string' ||
      input['uuid-of-ethernet-container'].trim() === '') {
    // The public contract does not define a dedicated UUID error.
    return ERRORS.GENERAL_ERROR;
  }
}

function getSubFunctionParameters(parameters, functionName) {
  if (Array.isArray(parameters['sub-function'])) {
    const subFunction = parameters['sub-function'].find(entry =>
      isObject(entry) && entry['function-name'] === functionName
    );
    if (subFunction) return subFunction;
  }
  return parameters[functionName] || { parameter: [] };
}

function deepClone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function getGranularityPriority(granularityPeriod) {
  const period = granularityPeriod.split(':').pop();
  if (period === PERIOD_15_MIN) return 0;
  if (period === PERIOD_24_HOURS) return 1;
  return 2;
}

function comparePmSlices(a, b) {
  const priorityA = getGranularityPriority(a['granularity-period']);
  const priorityB = getGranularityPriority(b['granularity-period']);
  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  const timeStrA = a['period-end-time'];
  const timeStrB = b['period-end-time'];

  // Keep missing dates last within the same granularity, as in the AI iterator.
  if (timeStrA === null || timeStrA === undefined) {
    if (timeStrB === null || timeStrB === undefined) {
      return 0;
    }
    return 1;
  }
  if (timeStrB === null || timeStrB === undefined) {
    return -1;
  }

  const timeA = Date.parse(timeStrA);
  const timeB = Date.parse(timeStrB);
  if (!Number.isNaN(timeA) && !Number.isNaN(timeB)) {
    return timeA - timeB;
  }

  return String(timeStrA).localeCompare(String(timeStrB));
}

/**
 * Process Ethernet PM slices and carry busy-hour status between batches.
 * The caller initializes/persists interface-status. Inputs are never mutated.
 * @returns {Object|string} Processed slices and status, or a contract error.
 */
function p2IterateEcPmSlices(input) {
  try {
    const validationError = validateInput(input);
    if (validationError) return validationError;

    // Clone before any helper calls so a failed batch cannot partially change
    // caller-owned records, parameters, topology, or accumulated status.
    const inputClone = deepClone(input);
    const parameters = inputClone.parameters;
    const historicalPerformanceDataList = inputClone['historical-performance-data-list'];
    const aggregationGroup = inputClone['aggregation-group'] ?? null;
    const resultCc = inputClone['result-cc'];
    let interfaceStatus = inputClone['interface-status'];
    const uuidOfEthernetContainer = inputClone['uuid-of-ethernet-container'];
    const removeDefaultValuesParameters = getSubFunctionParameters(parameters, 'p1RemoveDefaultValues');

    // Sort PM slices: all 15-minute records first, then 24-hour records.
    // Within each priority group, process the oldest timestamp first.
    historicalPerformanceDataList.sort(comparePmSlices);

    for (let index = 0; index < historicalPerformanceDataList.length; index++) {
      let pmSlice = historicalPerformanceDataList[index];

      // 1. Calculate Ethernet KPIs.
      let ethernetKpisResult;
      try {
        ethernetKpisResult = p1CalculateEthernetKpis({
          'historical-performance-data': pmSlice['performance-data']
        });
      } catch (error) {
        return ERRORS.KPI_CALCULATION_FAILED;
      }
      if (!isObject(ethernetKpisResult) || !isObject(ethernetKpisResult['historical-performance-data'])) {
        return ERRORS.KPI_CALCULATION_FAILED;
      }
      pmSlice['performance-data'] = ethernetKpisResult['historical-performance-data'];

      // 2. Remove default values from performance-data.
      let removeDefaultValuesResult;
      try {
        removeDefaultValuesResult = p1RemoveDefaultValues({
          parameters: removeDefaultValuesParameters,
          'input-object': pmSlice['performance-data']
        });
      } catch (error) {
        return ERRORS.DEFAULT_VALUES_REMOVAL_FAILED;
      }
      if (!isObject(removeDefaultValuesResult) || !isObject(removeDefaultValuesResult['cleaned-object'])) {
        return ERRORS.DEFAULT_VALUES_REMOVAL_FAILED;
      }
      pmSlice['performance-data'] = removeDefaultValuesResult['cleaned-object'];

      // 3. Calculate utilization using the complete historical PM slice.
      let utilizationResult;
      try {
        utilizationResult = p1CalculateUtilization({
          'historical-performance-data': pmSlice,
          'aggregation-group': aggregationGroup,
          'result-cc': resultCc,
          'uuid-of-ethernet-container': uuidOfEthernetContainer
        });
      } catch (error) {
        return ERRORS.UTILIZATION_CALCULATION_FAILED;
      }
      if (!isObject(utilizationResult) || !isSlice(utilizationResult['historical-performance-data'])) {
        return ERRORS.UTILIZATION_CALCULATION_FAILED;
      }
      pmSlice = utilizationResult['historical-performance-data'];

      // 4. Categorize 15-minute values, carrying the returned status forward.
      if (granularity(pmSlice) === PERIOD_15_MIN) {
        let categorizeDataVolumeResult;
        try {
          categorizeDataVolumeResult = p1CategorizeDataVolume({
            'historical-performance-data': pmSlice,
            'interface-status': interfaceStatus
          });
        } catch (error) {
          return ERRORS.DATA_VOLUME_CATEGORIZATION_FAILED;
        }
        if (!isObject(categorizeDataVolumeResult) || !isObject(categorizeDataVolumeResult['interface-status'])) {
          return ERRORS.DATA_VOLUME_CATEGORIZATION_FAILED;
        }
        interfaceStatus = categorizeDataVolumeResult['interface-status'];
      }

      // 5. Calculate daily busy-hour KPIs from accumulated 15-minute status.
      if (granularity(pmSlice) === PERIOD_24_HOURS) {
        let busyHourResult;
        try {
          busyHourResult = p1CalculateBusyHourPerformanceIndicators({
            'historical-performance-data': pmSlice,
            'interface-status': interfaceStatus
          });
        } catch (error) {
          return ERRORS.BUSY_HOUR_CALCULATION_FAILED;
        }
        if (!isObject(busyHourResult) || !isSlice(busyHourResult['historical-performance-data'])) {
          return ERRORS.BUSY_HOUR_CALCULATION_FAILED;
        }
        pmSlice = busyHourResult['historical-performance-data'];
      }
      try {
        historicalPerformanceDataList[index] = pmSlice;
      } catch (error) {
        return ERRORS.HISTORICAL_DATA_LIST_PROVIDE_FAILED;
      }
    }

    // Check the assembled output as well as each helper response
    try {
      if (!Array.isArray(historicalPerformanceDataList) ||
          historicalPerformanceDataList.length !== input['historical-performance-data-list'].length ||
          !Array.from(historicalPerformanceDataList).every(isSlice)) {
        return ERRORS.HISTORICAL_DATA_LIST_PROVIDE_FAILED;
      }
      return {
        'historical-performance-data-list': historicalPerformanceDataList,
        'interface-status': interfaceStatus
      };
    } catch (error) {
      return ERRORS.HISTORICAL_DATA_LIST_PROVIDE_FAILED;
    }
  } catch (error) {
    return ERRORS.GENERAL_ERROR;
  }
}

module.exports = p2IterateEcPmSlices;
