const ERRORS = require('./ErrorsEnum');
const p1CalculateIntervalCapacity = require('../../../../../genericFunctions/p1CalculateIntervalCapacity/P1CalculateIntervalCapacity');
const p1RemoveOutOfRangeLevels = require('../../../../../genericFunctions/p1RemoveOutOfRangeLevels/P1RemoveOutOfRangeLevels');
const p1RemoveDefaultValues = require('../../../../../genericFunctions/p1RemoveDefaultValues/P1RemoveDefaultValues');

const GRANU_PERIOD_15M = "air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN";
const GRANU_PERIOD_24H = "air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS";

const EPOCH_TIME = "1970-01-01T00:00:00+00:00";

function updateMostRecentPeriodEndTime(mostRecentPeriodEndTime, mostRecentPeriodEndTime24, granularityPeriod, periodEndTime) {

  if (!mostRecentPeriodEndTime) {
    return ERRORS.MOST_RECENT_PERIOD_END_TIME_NOT_PROVIDED;
  }

  if (!mostRecentPeriodEndTime24) {
    return ERRORS.MOST_RECENT_PERIOD_END_TIME24_NOT_PROVIDED;
  }

  if (!granularityPeriod) {
    return ERRORS.GRANULARITY_PERIOD_NOT_PROVIDED;
  }

  if (!periodEndTime) {
    return ERRORS.PERIOD_END_TIME_NOT_PROVIDED;
  }

  let updated15 = mostRecentPeriodEndTime;
  let updated24 = mostRecentPeriodEndTime24;

  if (granularityPeriod === GRANU_PERIOD_15M) {
    updated15 = mostRecentPeriodEndTime > periodEndTime ? mostRecentPeriodEndTime : periodEndTime;
  } else if (granularityPeriod === GRANU_PERIOD_24H) {
    updated24 = mostRecentPeriodEndTime24 > periodEndTime ? mostRecentPeriodEndTime24 : periodEndTime;
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

function p2IterateAiPmSlices(input) {
  try {
    if (!input) {
      return ERRORS.GENERAL_ERROR;
    }

    if (input.parameters == undefined &&
      input["historical-performance-data-list"] == undefined &&
      input["transmission-mode-list"] == undefined) {
      return ERRORS.GENERAL_ERROR;
    }

    const {
      parameters,
      "historical-performance-data-list": historicalPerformanceDataList,
      "transmission-mode-list": transmissionModeList
    } = input;


    if (!input || input.parameters === undefined) {
      return ERRORS.PARAMETERS_NOT_PROVIDED;
    }

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

    // let mostRecentPeriodEndTime = EPOCH_TIME;  // maybe to be use from epoch
    // let mostRecentPeriodEndTime24 = EPOCH_TIME;

    // const processedDataList = [];

    // for (const slice of historicalPerformanceDataList) {
    //   let currentPerformanceData = slice['performance-data'] || {};
    //   const timeXStatesList = currentPerformanceData['time-xstates-list'] || [];

    //   // 1. Calculate Capacity
    //   try {
    //     const capacityResult = p1CalculateIntervalCapacity({
    //       "time-xstates-list": timeXStatesList,
    //       "transmission-mode-list": transmissionModeList
    //     });

    //     if (typeof capacityResult === 'string') {
    //       return ERRORS.INTERVAL_CAPACITY_ERROR;
    //     }

    //     currentPerformanceData['interval-capacity'] = capacityResult['interval-capacity'];
    //   } catch (error) {
    //     return ERRORS.INTERVAL_CAPACITY_ERROR;
    //   }

    //   // 2. Remove Out of Range Levels
    //   try {
    //     const outOfRangeParams = extractSubFunctionParameters(parameters, "p1RemoveOutOfRangeLevels");
    //     const removeRangeResult = p1RemoveOutOfRangeLevels({
    //       "parameters": outOfRangeParams,
    //       "performance-data": currentPerformanceData
    //     });

    //     if (typeof removeRangeResult === 'string') {
    //       return ERRORS.OUT_OF_RANGE_LEVELS_ERROR;
    //     }

    //     currentPerformanceData = removeRangeResult['performance-data'];
    //   } catch (error) {
    //     return ERRORS.OUT_OF_RANGE_LEVELS_ERROR;
    //   }

    //   // 3. Remove Default Values
    //   try {
    //     const defaultValuesParams = extractSubFunctionParameters(parameters, "p1RemoveDefaultValues");
    //     const removeDefaultResult = p1RemoveDefaultValues({
    //       "parameters": defaultValuesParams,
    //       "input-object": currentPerformanceData
    //     });

    //     if (typeof removeDefaultResult === 'string') {
    //       return ERRORS.DEFAULT_VALUES_ERROR;
    //     }

    //     currentPerformanceData = removeDefaultResult['cleaned-object'];
    //   } catch (error) {
    //     return ERRORS.DEFAULT_VALUES_ERROR;
    //   }

    //   // 4. Update Timestamps
    //   try {
    //     const updateTimeResult = updateMostRecentPeriodEndTime(
    //       mostRecentPeriodEndTime,
    //       mostRecentPeriodEndTime24,
    //       slice['granularity-period'],
    //       slice['period-end-time']
    //     );

    //     if (typeof updateTimeResult === 'string') {
    //       return ERRORS.GENERAL_ERROR;
    //     }

    //     mostRecentPeriodEndTime = updateTimeResult['most-recent-period-end-time'];
    //     mostRecentPeriodEndTime24 = updateTimeResult['most-recent-period-end-time-24'];
    //   } catch (error) {
    //     return ERRORS.GENERAL_ERROR;
    //   }

    //   processedDataList.push({
    //     ...slice,
    //     'performance-data': currentPerformanceData
    //   });
    // }

    // let retValue = {
    //   'historical-performance-data-list': processedDataList,
    // }

    // if (mostRecentPeriodEndTime != EPOCH_TIME) {
    //   retValue['most-recent-period-end-time'] = mostRecentPeriodEndTime;
    // }

    // if (mostRecentPeriodEndTime24 != EPOCH_TIME) {
    //   retValue['most-recent-period-end-time-24'] = mostRecentPeriodEndTime24;
    // }

    // return retValue;
  } catch (error) {
    return ERRORS.GENERAL_ERROR;
  }
}

module.exports = p2IterateAiPmSlices;
