const ERRORS = require('./ErrorsEnum');

const HISTPERFDATA = 'historical-performance-data';
const PERFDATA = 'performance-data';
const AGGGROUP = 'aggregation-group';
const RESCC = 'result-cc';
const LTP = 'logical-termination-point';
const PSYSERVERLTP = 'physical-server-ltp-list';
const ENDTIME = 'period-end-time';
const TOTBYTEOUT = 'total-bytes-output';
const TOTAIRIFCAP = 'total-air-interface-interval-capacity';
const TIMEPERIOD = 'time-period';

const GRAN_15MIN = 'GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN';
const GRAN_24H = 'GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS';
const GRAN_UNKN = 'GRANULARITY_PERIOD_TYPE_PERIOD-UNKNOWN';
const GRAN_NOTDEF = 'GRANULARITY_PERIOD_TYPE_PERIOD-NOT_YET_DEFINED';

// Aggregates the interval capacity of all transporting AirInterfaces
function calculateTotalAirInterfaceIntervalCapacity(input) {
  const ltpList = input[LTP]; // array
  const psyServerLTP = input[PSYSERVERLTP]; // array
  const periodEndTime = input[ENDTIME]; // string

  if (ltpList == null) {
    return ERRORS.LTP_LIST_NOT_PROVIDED;
  }
  // TODO: manage 'logicalTerminationPoint list invalid'

  if (psyServerLTP == null) {
    return ERRORS.PSY_SERVER_LTP_LIST_NOT_PROVIDED;
  }
  // TODO: manage 'physicalServerLtpList invalid'

  if (periodEndTime == null) {
    return ERRORS.PERIOD_ENDTIME_NOT_PROVIDED;
  }
  // TODO: manage 'periodEndTime invalid'

  const timeStamp = new Date(periodEndTime);

  let sumTot = 0;

  let cleanLTPlist = ltpList.filter((ltp) => psyServerLTP.includes(ltp['uuid']));


  let totalAirIfCap = cleanLTPlist.reduce((accLTP, currentLTP) => {
    let lp = currentLTP['layer-protocol'];
    let resLP = lp.reduce((accLP, currentLP) => {
      let histPerfList = currentLP['air-interface-2-0:air-interface-pac']['air-interface-historical-performances']['historical-performance-data-list'];
      let histDataClean = histPerfList.filter((perfData) => perfData[ENDTIME] == periodEndTime && perfData['granularity-period'] == `air-interface-2-0:${GRAN_15MIN}`);

      let resHistory = histDataClean.reduce((accHis, currHistory) => accHis += currHistory[PERFDATA]['interval-capacity'], 0);
      // acc+= sum;
      return accLP + resHistory;
    }, 0);
    return accLTP + resLP;
  }, 0);

  // 'Sum of the intervalCapacity of all AirInterfaces in the aggregation group that is transporting this EthernetContainer in kbps
  // from [sum of all {[/logical-termination-point={physical-server-ltp-list[*]}/layer-protocol=*/air-interface-2-0:air-interface-pac/air-interface-historical-performances/historical-performance-data-list={$input.period-end-time}/performance-data/interval-capacity}]
  //             with {[/logical-termination-point={physical-server-ltp-list[*]}/layer-protocol=*/air-interface-2-0:air-interface-pac/air-interface-historical-performances/historical-performance-data-list={$input.period-end-time}/granularity-period]}==air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN'

  // TODO: manage totalAirInterfaceIntervalCapacity could not be provided'
  return {
    'total-air-interface-interval-capacity': totalAirIfCap
  };
}

// Calculates the utilization
function calculateUtilization(input) {
  const totalByteOutput = input[TOTBYTEOUT]; //string
  const totalAirIfIntCap = input[TOTAIRIFCAP]; // integer
  const timePeriod = input[TIMEPERIOD]; // integer

  if (totalByteOutput == null) {
    return ERRORS.TOTAL_BYTE_OUTPUT_NOT_PROVIDED;
  }
  // TODO: manage 'totalBytesOutput invalid'

  if (totalAirIfIntCap == null) {
    return ERRORS.TOTAL_AIR_IF_INT_CAP_NOT_PROVIDED;
  }
  // TODO: manage totalAirInterfaceIntervalCapacity invalid

  if (timePeriod == null) {
    return ERRORS.TIME_PERIOD_NOT_PROVIDED;
  }
  // TODO: manage 'timePeriod invalid'

  // From Spec file: interface.yaml
  //    'Interval utilization in %
  //    from [ {total-bytes-output}*8 / ( {total-air-interface-interval-capacity}*1000 * {time-period} ) ]'
  const calcNum = Number(totalByteOutput) * 8;
  const calcDen = totalAirIfIntCap * 1000 * timePeriod;
  const result = (calcNum / calcDen) * 100;

  // Return result
  return {
    'utilization': result
  };
}

const p1CalculateUtilization = (input) => {
  try {
    const historicalPerfData = input[HISTPERFDATA]; // Object
    const aggGroup = input[AGGGROUP]; // Object
    const resultCC = input[RESCC];  // Object

    if (historicalPerfData == null) {
      return ERRORS.HIST_PERF_DATA_NOT_PROVIDED;
    } else if (historicalPerfData['granularity-period'] == null ||
      historicalPerfData[ENDTIME] == null ||
      historicalPerfData[PERFDATA] == null) {
      return ERRORS.HIST_PERF_DATA_INVALID;
    }

    if (aggGroup == null) {
      return ERRORS.AGG_GROUP_NOT_PROVIDED;
    } else if (aggGroup[PSYSERVERLTP] == null) {
      return ERRORS.AGG_GROUP_INVALID;
    }

    if (resultCC == null || resultCC[LTP]) {
      return ERRORS.RESULT_CC_NOT_PROVIDED;
    }
    // TODO: manage 'result-cc invalid'

    // TODO: manage 'Utilization could not be added'

    // Functions must process only 15 minutes of PM
    const granularityPeriod = historicalPerfData['granularity-period'];
    if (granularityPeriod.endsWith(GRAN_15MIN)) {
      // process data
    } else if (granularityPeriod.endsWith(GRAN_24H) || granularityPeriod.endsWith(GRAN_UNKN) || granularityPeriod.endsWith(GRAN_NOTDEF)) {
      return {
        'historical-performance-data': historicalPerfData
      };
    } else {
      return ERRORS.HIST_PERF_DATA_INVALID;
    }

    const inputCapacity = {
      'logical-termination-point': resultCC['core-model-1-4:control-construct'][0][LTP],
      'physical-server-ltp-list': aggGroup[PSYSERVERLTP],
      'period-end-time': historicalPerfData[ENDTIME],
    }
    let totAirCapacity = calculateTotalAirInterfaceIntervalCapacity(inputCapacity);
    historicalPerfData[PERFDATA][TOTAIRIFCAP] = totAirCapacity[TOTAIRIFCAP];

    const inputStruct = {
      'total-bytes-output': historicalPerfData[PERFDATA][TOTBYTEOUT], // string
      'total-air-interface-interval-capacity': historicalPerfData[PERFDATA][TOTAIRIFCAP], // integer
      'time-period': historicalPerfData[PERFDATA][TIMEPERIOD] // integer
    }
    let utilization = calculateUtilization(inputStruct);
    historicalPerfData[PERFDATA]['utilization'] = utilization['utilization'];

    // Return value
    return {
      'historical-performance-data': historicalPerfData
    };
  } catch (err) {
    return ERRORS.GENERAL_ERROR;
  }
};

module.exports = p1CalculateUtilization;