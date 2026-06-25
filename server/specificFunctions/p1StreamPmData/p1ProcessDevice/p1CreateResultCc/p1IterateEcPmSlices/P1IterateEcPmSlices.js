const ERRORS = require('./ErrorsEnum');
const p1CalculateEthernetKpis = require('../../../../../genericFunctions/p1CalculateEthernetKpis/P1CalculateEthernetKpis');
const p1RemoveDefaultValues = require('../../../../../genericFunctions/p1RemoveDefaultValues/P1RemoveDefaultValues');
const p1CalculateUtilization = require('../../../../../genericFunctions/p1CalculateUtilization/P1CalculateUtilization');

const GRANU_PERIOD_15M = "ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN";
const GRANU_PERIOD_24H = "ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS";

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

// ----------------- Helpers -----------------
function validateInput(input) {
  if (!input) {
    return ERRORS.PARAMETERS_NOT_PROVIDED;
  }

  if (!input.parameters) {
    return ERRORS.PARAMETERS_INVALID;
  }

  if (!input['historical-performance-data-list']) {
    return ERRORS.HISTORICAL_DATA_LIST_NOT_PROVIDED;
  }

  if (!Array.isArray(input['historical-performance-data-list'])) {
    return ERRORS.HISTORICAL_DATA_LIST_INVALID;
  }

  return "OK";
}


const p1IterateEcPmSlices = (input) => {
  try {
    if (Object.keys(input).length == 0) {
      return ERRORS.GENERAL_ERROR;
    }

    let result = validateInput(input);

    if (result !== "OK") {
      return result;
    }

    const parameters = input['parameters'];
    const historPerfDataList = JSON.parse(JSON.stringify(input['historical-performance-data-list']));
    const aggrGroup = input['aggregation-group'];
    const resultCC = JSON.parse(JSON.stringify(input['result-cc']));

    // Init Variables
    let mostRecentPeriodEndTime = EPOCH_TIME;
    let mostRecentPeriodEndTime24 = EPOCH_TIME;

    let processedDataList = [];

    for (let slice of historPerfDataList) {// histPerfData
      // 1. Add Ethernet KPIs
      let resultKpis;
      try {
        resultKpis = p1CalculateEthernetKpis({ 'historical-performance-data': slice['performance-data'] });

        if (typeof resultKpis === "string") {
          return ERRORS.KPI_CALCULATION_FAILED;
        }
      } catch (error) {
        return ERRORS.KPI_CALCULATION_FAILED;
      }

      // 2. Delete default values
      let resultPerfData;
      try {
        const defaultValuesParams = extractSubFunctionParameters(parameters, "p1RemoveDefaultValues");
        resultPerfData = p1RemoveDefaultValues({
          "parameters": defaultValuesParams,
          'input-object': resultKpis['historical-performance-data'],
        });

        if (typeof resultPerfData === "string") {
          return ERRORS.DEFAULT_VALUES_REMOVAL_FAILED;
        }
      } catch (error) {
        return ERRORS.DEFAULT_VALUES_REMOVAL_FAILED;
      }

      // Update slice
      slice['performance-data'] = resultPerfData['cleaned-object'];

      // 3. Add Utilization
      try {
        let resCalculation = p1CalculateUtilization({
          'historical-performance-data': slice,
          'aggregation-group': aggrGroup,
          'result-cc': resultCC
        })

        if (typeof resCalculation === "string") {
          return ERRORS.UTILIZATION_CALCULATION_FAILED;
        }

        slice = resCalculation['historical-performance-data'];  // Update slice
      } catch (error) {
        return ERRORS.UTILIZATION_CALCULATION_FAILED;
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

      // Push calculated data slice into array
      processedDataList.push(slice);
    }

    let retValue = {
      'historical-performance-data-list': processedDataList,
    }
    
    if (mostRecentPeriodEndTime != EPOCH_TIME) {
      retValue['most-recent-period-end-time'] = mostRecentPeriodEndTime;
    }

    if (mostRecentPeriodEndTime24 != EPOCH_TIME) {
      retValue['most-recent-period-end-time-24'] = mostRecentPeriodEndTime24;
    }

    return retValue;
  } catch (error) {
    return ERRORS.GENERAL_ERROR;
  }
};

module.exports = p1IterateEcPmSlices;
