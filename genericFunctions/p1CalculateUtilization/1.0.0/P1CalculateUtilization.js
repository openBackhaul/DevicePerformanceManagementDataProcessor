const ERRORS = require('./ErrorsEnum');

// Aggregates the interval capacity of all transporting AirInterfaces
function calculateTotalAirInterfaceIntervalCapacity(input) {
  const ltpList = input['logical-termination-point']; // array
  const physServerLTP = input['physical-server-ltp-list']; // array
  const periodEndTime = input['period-end-time']; // string

  if (ltpList == null) {
    return ERRORS.LTP_LIST_NOT_PROVIDED;
  }
  // TODO: manage 'logicalTerminationPoint list invalid'

  if (physServerLTP == null) {
    return ERRORS.PHSY_SERVER_LTP_LIST_NOT_PROVIDED;
  }
  // TODO: manage 'physicalServerLtpList invalid'

  if (periodEndTime == null) {
    return ERRORS.PERIOD_ENDTIME_NOT_PROVIDED;
  }
  // TODO: manage 'periodEndTime invalid'

  const timeStamp = new Date(periodEndTime);

  // let utilizationStruct = {
  //   'total-bytes-output': historicalPerfData['performance-data']['total-bytes-output'],
  //   'total-air-interface-interval-capacity': historicalPerfData['performance-data']['total-air-interface-interval-capacity'],
  //   'time-period': historicalPerfData['performance-data']['time-period']
  // };
  // let utilizationResult = calculateUtilization(utilizationStruct);

  // 'Sum of the intervalCapacity of all AirInterfaces in the aggregation group that is transporting this EthernetContainer in kbps
  // from [sum of all {[/logical-termination-point={physical-server-ltp-list[*]}/layer-protocol=*/air-interface-2-0:air-interface-pac/air-interface-historical-performances/historical-performance-data-list={$input.period-end-time}/performance-data/interval-capacity}]
  //         with {[/logical-termination-point={physical-server-ltp-list[*]}/layer-protocol=*/air-interface-2-0:air-interface-pac/air-interface-historical-performances/historical-performance-data-list={$input.period-end-time}/granularity-period]}==air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN'

  // TODO: manage totalAirInterfaceIntervalCapacity could not be provided'
  return {
    'total-air-interface-interval-capacity': undefined
  };
}

// Calculates the utilization
function calculateUtilization(input) {
  const totalByteOutput = input['total-bytes-output']; //string
  const totalAirIfIntCap = input['total-air-interface-interval-capacity']; // integer
  const timePeriod = input['time-period']; // integer

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
  // 'Interval utilization in %
  // from [ {total-bytes-output}*8 / ( {total-air-interface-interval-capacity}*1000 * {time-period} ) ]'
  const calcNum = Number(totalByteOutput) * 8;
  const calcDen = totalAirIfIntCap * 1000 * timePeriod;
  const result = (calcNum / calcDen) * 100;
  return {
    'utilization' : result
  };
}

const p1CalculateUtilization = (input) => {
  try {
    const historicalPerfData = input['historical-performance-data']; // Object
    const aggGroup = input['aggregation-group']; // Object
    const resultCC = input['result-cc'];  // Object

    if (historicalPerfData == null) {
      return ERRORS.HIST_PERF_DATA_NOT_PROVIDED;
    } else if (historicalPerfData['granularity-period'] == null ||
        historicalPerfData['period-end-time'] == null ||
        historicalPerfData['performance-data'] == null) {
      return ERRORS.HIST_PERF_DATA_INVALID;
    } 

    if (aggGroup == null) {
      return ERRORS.AGG_GROUP_NOT_PROVIDED;
    } else if (aggGroup['physical-server-ltp-list'] == null) {
      return ERRORS.AGG_GROUP_INVALID;
    }

    if (resultCC == null || resultCC['logical-termination-point']) {
      return ERRORS.RESULT_CC_NOT_PROVIDED;
    }
    // TODO: manage 'result-cc invalid'

    // TODO: manage 'Utilization could not be added'

    const granularityPeriod = historicalPerfData['granularity-period'];
    if (granularityPeriod.endsWith('GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN')) {
      // process data
    } else if (granularityPeriod.endsWith('GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS') ||
      granularityPeriod.endsWith('GRANULARITY_PERIOD_TYPE_PERIOD-UNKNOWN') ||
      granularityPeriod.endsWith('GRANULARITY_PERIOD_TYPE_PERIOD-NOT_YET_DEFINED')) {
      return {
        'historical-performance-data': historicalPerfData
      };
    } else {
      return ERRORS.HIST_PERF_DATA_INVALID;
    }

    // let capacityStruct = {
    //   'logical-termination-point': resultCC[0],
    //   'physical-server-ltp-list': undefined,
    //   'period-end-time': undefined,
    // };
    // let capacityResult  = calculateTotalAirInterfaceIntervalCapacity(capacityStruct);
    // Return value
    return {
      'historical-performance-data': undefined
    };
  } catch (err) {
    return ERRORS.GENERAL_ERROR;
  }
};

module.exports = p1CalculateUtilization;