const ERRORS = require('./ErrorsEnum');
const p1CalculateEthernetKpis = require('../../../../../genericFunctions/p1CalculateEthernetKpis/P1CalculateEthernetKpis');
const p1RemoveDefaultValues = require('../../../../../genericFunctions/p1RemoveDefaultValues/P1RemoveDefaultValues');
const p1CalculateUtilization = require('../../../../../genericFunctions/p1CalculateUtilization/P1CalculateUtilization');

const GRANU_PERIOD_15M = "ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN";
const GRANU_PERIOD_24H = "ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS";

const EPOCH_TIME = "1970-01-01T00:00:00+00:00";

function updateMostRecentPeriodEndTime(mostRecentPeriodEndTime, mostRecentPeriodEndTime24, granularityPeriod, periodEndTime) {

  if (!mostRecentPeriodEndTime) {
    return 'mostRecentPeriodEndTime not provided';
  }

  if (!mostRecentPeriodEndTime24) {
    return 'mostRecentPeriodEndTime24 not provided';
  }

  if (!granularityPeriod) {
    return 'granularityPeriod not provided';
  }

  if (!periodEndTime) {
    return 'periodEndTime not provided';
  }

  let updated15 = mostRecentPeriodEndTime;
  let updated24 = mostRecentPeriodEndTime24;

  if (granularityPeriod === GRANU_PERIOD_15M) {
    updated15 = periodEndTime;
  } else if (granularityPeriod === GRANU_PERIOD_24H) {
    updated24 = periodEndTime;
  }

  return {
    'most-recent-period-end-time': updated15,
    'most-recent-period-end-time-24': updated24
  };
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

function maxTime(t1, t2) {
  if (!t1) {
    return t2;
  }

  let res = validateInput(input);

  if (res !== "OK") {
    return res;
  }

  return t1 >= t2 ? t1 : t2;
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
    let mostRecentPeriodEndTime = new Date(0);
    let mostRecentPeriodEndTime24 = new Date(0);

    let processedList = [];

    let hist

    result = 'OK';
    for (const histPerfData of historPerfDataList) {
      let resultKpis = p1CalculateEthernetKpis({ 'historical-performance-data': histPerfData['performance-data'] });
      if (typeof resultKpis === "string") {
        result = ERRORS.KPI_CALCULATION_FAILED;
        break;
      }

      let resultPerfData = p1RemoveDefaultValues({
        'input-object': resultKpis['historical-performance-data'],
        'parameters': parameters['sub-function'][1] // To be update
      });
      if (typeof resultPerfData === "string") {
        result = ERRORS.DEFAULT_VALUES_REMOVAL_FAILED;
        break;
      }

      resultKpis['historical-performance-data'] = resultPerfData['cleaned-object'];

      histPerfData['performance-data'] = resultKpis['historical-performance-data'];

      let resCalculation = p1CalculateUtilization({
        'historical-performance-data': histPerfData,
        'aggregation-group': aggrGroup,
        'result-cc': resultCC
      })
      if (typeof resCalculation === "string") {
        result = ERRORS.UTILIZATION_CALCULATION_FAILED;
        break;
      }

      // if (resCalculation['historical-performance-data']['granularity-period'] == GRANU_PERIOD_15M) {
      //   if (mostRecentPeriodEndTime < (new Date(resCalculation['historical-performance-data']['period-end-time']))) {
      //     mostRecentPeriodEndTime = new Date(resCalculation['historical-performance-data']['period-end-time']);
      //   }
      // } else if (resCalculation['historical-performance-data']['granularity-period'] == GRANU_PERIOD_24H) {
      //   if (mostRecentPeriodEndTime24 < (new Date(resCalculation['historical-performance-data']['period-end-time']))) {
      //     mostRecentPeriodEndTime24 = new Date(resCalculation['historical-performance-data']['period-end-time']);
      //   }
      // }

      // 4. Update Timestamps
      try {
        const updateTimeResult = updateMostRecentPeriodEndTime(
          mostRecentPeriodEndTime,
          mostRecentPeriodEndTime24,
          histPerfData['granularity-period'],
          histPerfData['period-end-time']
        );

        if (typeof updateTimeResult === 'string') {
          return ERRORS.GENERAL_ERROR;
        }

        mostRecentPeriodEndTime = updateTimeResult['most-recent-period-end-time'];
        mostRecentPeriodEndTime24 = updateTimeResult['most-recent-period-end-time-24'];
      } catch (error) {
        return ERRORS.GENERAL_ERROR;
      }
      processedList.push(resCalculation['historical-performance-data']);
    }

    return {
      'historical-performance-data-list': processedList,
      'most-recent-period-end-time': mostRecentPeriodEndTime,
      'most-recent-period-end-time-24': mostRecentPeriodEndTime24
    };
  } catch (err) {
    return ERRORS.GENERAL_ERROR;
  }
};

module.exports = p1IterateEcPmSlices;
