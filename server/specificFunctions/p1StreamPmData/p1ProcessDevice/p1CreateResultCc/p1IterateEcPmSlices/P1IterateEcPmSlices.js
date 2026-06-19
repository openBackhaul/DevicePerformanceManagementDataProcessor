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
    let mostRecentPeriodEndTime = 0;
    let mostRecentPeriodEndTime24 = 0;

    for (const histPerfData of historPerfDataList) {
      let resultKpis = p1CalculateEthernetKpis({'historical-performance-data': histPerfData});
      // if (resultKpis instanceof "String") {
      //   result = resultKpis;
      //   break;
      // }

      resultKPI = p1RemoveDefaultValues({
        'historical-performance-data': histPerfData,
        'parameters': parameters
      });

      
    }

    // if (result !== "OK") {
    //   return result;
    // }


    return {
      // 'historical-performance-data-list': processedList,
      'most-recent-period-end-time': mostRecentPeriodEndTime,
      'most-recent-period-end-time-24': mostRecentPeriodEndTime24
    };
  } catch (err) {
    return ERRORS.GENERAL_ERROR;
  }
};

module.exports = p1IterateEcPmSlices;
