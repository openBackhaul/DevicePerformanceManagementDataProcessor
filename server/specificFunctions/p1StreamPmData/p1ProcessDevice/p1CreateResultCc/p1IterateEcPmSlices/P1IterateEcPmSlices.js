const ERRORS = require('./ErrorsEnum');
const p1CalculateEthernetKpis = require('../../../../../genericFunctions/p1CalculateEthernetKpis/P1CalculateEthernetKpis');
const p1RemoveDefaultValues = require('../../../../../genericFunctions/p1RemoveDefaultValues/P1RemoveDefaultValues');
const p1CalculateUtilization = require('../../../../../genericFunctions/p1CalculateUtilization/P1CalculateUtilization');

const GRANULARITY_15 =
  'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN';
const GRANULARITY_24 =
  'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS';

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

// TODO
// -- init
// mostRecentPerioEndTime
// mostRecentPerioEndTime24

// input
// - parameters
// - historical-performance-data-list   --> Array
// - aggregation-group
// - result-cc
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
    const historPerfDataList = input['historical-performance-data-list'];
    const aggrGroup = input['aggregation-group'];
    const resultCC = input['result-cc'];

    // Init Variables
    let mostRecentPeriodEndTime = new Date(0);
    let mostRecentPeriodEndTime24 = new Date(0);

    let processedList = []; // = JSON.parse(JSON.stringify(historPerfDataList)); // Initializate return value

    for (const histPerfData of historPerfDataList) {
      let resultKpis = p1CalculateEthernetKpis({'historical-performance-data': histPerfData});
      //TODO @latta-siae manage Errors
      // if (resultKpis instanceof "String") {
      //   result = resultKpis;
      //   break;
      // }

      let resultPerfData = p1RemoveDefaultValues({
        // 'historical-performance-data': resultKpis,
        'input-object': resultKpis['historical-performance-data']['performance-data'],
        'parameters': parameters['sub-function'][1]
      });
      
      resultKpis['historical-performance-data']['performance-data'] = resultPerfData['cleaned-object'];

      let resCalculation = p1CalculateUtilization({
        'historical-performance-data': resultKpis['historical-performance-data'],
        'aggregation-group': aggrGroup,
        'result-cc': resultCC
      })

      if (resCalculation['historical-performance-data']['granularity-period'] == GRANULARITY_15) {
        if (mostRecentPeriodEndTime < (new Date(resCalculation['historical-performance-data']['period-end-time']))) {
          mostRecentPeriodEndTime = new Date(resCalculation['historical-performance-data']['period-end-time']);
        }
      } else if (resCalculation['historical-performance-data']['granularity-period'] == GRANULARITY_24) {
        if (mostRecentPeriodEndTime24 < (new Date(resCalculation['historical-performance-data']['period-end-time']))) {
          mostRecentPeriodEndTime24 = new Date(resCalculation['historical-performance-data']['period-end-time']);
        }
      } else {
        console.log("error");
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
