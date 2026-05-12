const ERRORS = require('./ErrorsEnum');
const p1CalculateIntervalCapacity = require('../../../../../genericFunctions/p1CalculateIntervalCapacity/P1CalculateIntervalCapacity');
const p1RemoveOutOfRangeLevels = require('../../../../../genericFunctions/p1RemoveOutOfRangeLevels/P1RemoveOutOfRangeLevels');
const p1RemoveDefaultValues = require('../../../../../genericFunctions/p1RemoveDefaultValues/P1RemoveDefaultValues');

// Local helper for updateMostRecentPeriodEndTime
function updateMostRecentPeriodEndTime(mostRecentPeriodEndTime, mostRecentPeriodEndTime24, granularityPeriod, periodEndTime) {
  if (!mostRecentPeriodEndTime || !mostRecentPeriodEndTime24 || !granularityPeriod || !periodEndTime) {
    if (!mostRecentPeriodEndTime) return 'mostRecentPeriodEndTime not provided';
    if (!mostRecentPeriodEndTime24) return 'mostRecentPeriodEndTime24 not provided';
    if (!granularityPeriod) return 'granularityPeriod not provided';
    if (!periodEndTime) return 'periodEndTime not provided';
  }

  let updated15 = mostRecentPeriodEndTime;
  let updated24 = mostRecentPeriodEndTime24;

  if (granularityPeriod === 'air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN') {
    updated15 = periodEndTime;
  } else if (granularityPeriod === 'air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS') {
    updated24 = periodEndTime;
  }

  return {
    'most-recent-period-end-time': updated15,
    'most-recent-period-end-time-24': updated24
  };
}

function extractSubFunctionParameters(parameters, functionName) {
  const subFunctions = parameters["sub-function"];
  if (!Array.isArray(subFunctions)) {
    return {};
  }

  const subFunction = subFunctions.find(
    fn => fn?.["function-name"] === functionName
  );

  return Array.isArray(subFunction?.parameter)
    ? { "parameter": subFunction.parameter }
    : {};
}

function p1IterateAiPmSlices(input) {
  try {
    if (!input || input.parameters === undefined) {
      return ERRORS.PARAMETERS_NOT_PROVIDED;
    }

    const {
      parameters,
      "historical-performance-data-list": historicalPerformanceDataList,
      "transmission-mode-list": transmissionModeList
    } = input;

    if (typeof parameters !== 'object' || Array.isArray(parameters) || parameters === null) {
      return ERRORS.PARAMETERS_INVALID;
    }

    if (historicalPerformanceDataList === undefined) {
      return ERRORS.HISTORICAL_DATA_LIST_NOT_PROVIDED;
    }
    if (!Array.isArray(historicalPerformanceDataList)) {
      return ERRORS.HISTORICAL_DATA_LIST_INVALID;
    }

    if (transmissionModeList === undefined) {
      return ERRORS.TRANSMISSION_MODE_LIST_NOT_PROVIDED;
    }
    if (!Array.isArray(transmissionModeList)) {
      return ERRORS.TRANSMISSION_MODE_LIST_INVALID;
    }

    let mostRecentPeriodEndTime = '2010-11-20T14:00:00+01:00';
    let mostRecentPeriodEndTime24 = '2010-11-20T14:00:00+01:00';

    const processedDataList = [];

    for (const slice of historicalPerformanceDataList) {
      let currentPerformanceData = slice['performance-data'] || {};
      const timeXStatesList = currentPerformanceData['time-xstates-list'] || [];

      // 1. Calculate Capacity
      try {
        const capacityResult = p1CalculateIntervalCapacity({
          "time-xstates-list": timeXStatesList,
          "transmission-mode-list": transmissionModeList
        });
        
        if (typeof capacityResult === 'string') {
           return ERRORS.INTERVAL_CAPACITY_ERROR;
        }

        currentPerformanceData['interval-capacity'] = capacityResult['interval-capacity'];
      } catch (error) {
        return ERRORS.INTERVAL_CAPACITY_ERROR;
      }

      // 2. Remove Out of Range Levels
      try {
        const outOfRangeParams = extractSubFunctionParameters(parameters, "p1RemoveOutOfRangeLevels");
        const removeRangeResult = p1RemoveOutOfRangeLevels({
          "parameters": outOfRangeParams,
          "performance-data": currentPerformanceData
        });

        if (typeof removeRangeResult === 'string') {
          return ERRORS.OUT_OF_RANGE_LEVELS_ERROR;
        }

        currentPerformanceData = removeRangeResult['performance-data'];
      } catch (error) {
        return ERRORS.OUT_OF_RANGE_LEVELS_ERROR;
      }

      // 3. Remove Default Values
      try {
        const defaultValuesParams = extractSubFunctionParameters(parameters, "p1RemoveDefaultValues");
        const removeDefaultResult = p1RemoveDefaultValues({
          "parameters": defaultValuesParams,
          "input-object": currentPerformanceData
        });

        if (typeof removeDefaultResult === 'string') {
          return ERRORS.DEFAULT_VALUES_ERROR;
        }

        currentPerformanceData = removeDefaultResult['cleaned-object'];
      } catch (error) {
        return ERRORS.DEFAULT_VALUES_ERROR;
      }

      // 4. Update Timestamps
      try {
        const updateTimeResult = updateMostRecentPeriodEndTime(
          mostRecentPeriodEndTime,
          mostRecentPeriodEndTime24,
          slice['granularity-period'],
          slice['period-end-time']
        );

        if (typeof updateTimeResult === 'string') {
          return ERRORS.GENERAL_ERROR;
        }

        mostRecentPeriodEndTime = updateTimeResult['most-recent-period-end-time'];
        mostRecentPeriodEndTime24 = updateTimeResult['most-recent-period-end-time-24'];
      } catch (error) {
        return ERRORS.GENERAL_ERROR;
      }

      processedDataList.push({
        ...slice,
        'performance-data': currentPerformanceData
      });
    }

    return {
      'historical-performance-data-list': processedDataList,
      'most-recent-period-end-time': mostRecentPeriodEndTime,
      'most-recent-period-end-time-24': mostRecentPeriodEndTime24
    };

  } catch (error) {
    return ERRORS.GENERAL_ERROR;
  }
}

module.exports = {
  p1IterateAiPmSlices,
  updateMostRecentPeriodEndTime
};
