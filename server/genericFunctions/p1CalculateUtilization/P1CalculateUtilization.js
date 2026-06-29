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


function validateResultCC(input) {
  try {
    if (input[LTP] != null && Array.isArray(input[LTP])) {
      input[LTP].forEach(ltpObj => {
        if (Object.hasOwn(ltpObj, 'uuid') &&
          Object.hasOwn(ltpObj, 'layer-protocol')) {

          if (Array.isArray(ltpObj['layer-protocol'])) {
            const lp = ltpObj['layer-protocol'][0];
            if (lp['layer-protocol-name'] == "air-interface-2-0:LAYER_PROTOCOL_NAME_TYPE_AIR_LAYER") {
              ltpObj['layer-protocol'].forEach(lpObj => {
                if (Object.hasOwn(lpObj, 'local-id') &&
                  Object.hasOwn(lpObj, 'layer-protocol-name') &&
                  Object.hasOwn(lpObj, 'air-interface-2-0:air-interface-pac')) {
                  const aiPac = lpObj['air-interface-2-0:air-interface-pac'];
                  if (Object.hasOwn(aiPac, 'air-interface-historical-performances') && aiPac['air-interface-historical-performances']['number-of-historical-performance-sets'] == 0) {
                    // No data to check
                  } else if (Object.hasOwn(aiPac, 'air-interface-historical-performances') &&
                    Object.hasOwn(aiPac['air-interface-historical-performances'], 'historical-performance-data-list') &&
                    Array.isArray(aiPac['air-interface-historical-performances']['historical-performance-data-list'])) {
                    const hPerf = aiPac['air-interface-historical-performances']['historical-performance-data-list'];
                    hPerf.forEach(perfData => {
                      if (Object.hasOwn(perfData, 'granularity-period') &&
                        Object.hasOwn(perfData, 'period-end-time') &&
                        Object.hasOwn(perfData, 'performance-data') && Object.hasOwn(perfData['performance-data'], 'interval-capacity')) {
                        // Validation passed
                      } else {
                        throw new Error(ERRORS.RESULT_CC_INVALID);
                      }
                    });
                  } else {
                    // No dataset available
                    // throw new Error(ERRORS.RESULT_CC_INVALID);
                  }
                } else {
                  throw new Error(ERRORS.RESULT_CC_INVALID);
                }
              });
            }
            // else // Do nothing
          } else {
            throw new Error(ERRORS.RESULT_CC_INVALID);
          }
        } else {
          throw new Error(ERRORS.RESULT_CC_INVALID);
        }
      });
    } else {
      throw new Error(ERRORS.RESULT_CC_INVALID);
    }
  } catch (error) {
    return false
  }

  return true;
}

// Aggregates the interval capacity of all transporting AirInterfaces
// input
// - logical-termination-point
// - physical-server-ltp-list
// - period-end-time
// 
// Errors:
// - 'logicalTerminationPoint list not provided'
// - 'logicalTerminationPoint list invalid'
// - 'physicalServerLtpList not provided'
// - 'physicalServerLtpList invalid'
// - 'periodEndTime not provided'
// - 'periodEndTime invalid'
// - 'totalAirInterfaceIntervalCapacity could not be provided'
// - 'General processing error'
function calculateTotalAirInterfaceIntervalCapacity(input) {
  try {
    const ltpList = input[LTP];               // array
    const psyServerLTP = input[PSYSERVERLTP]; // array
    const periodEndTime = input[ENDTIME];     // string

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

    // Filter out LTP no in ServerList
    const cleanLTPlist = ltpList.filter((ltp) => psyServerLTP.includes(ltp['uuid']));

    // Reduce function to calculate all AirInterfaceCapacity for the aggration
    let totalAirIfCap = cleanLTPlist.reduce((accLTP, currentLTP) => {
      let lp = currentLTP['layer-protocol'];
      lp = lp.filter(lpObj => lpObj['layer-protocol-name'] == "air-interface-2-0:LAYER_PROTOCOL_NAME_TYPE_AIR_LAYER");
      const resLP = lp.reduce((accLP, currentLP) => {
        const airPerfHist = currentLP['air-interface-2-0:air-interface-pac']['air-interface-historical-performances'];
        // In case of no pm history set Accumulator equal to 0
        if (airPerfHist['number-of-historical-performance-sets'] == 0) {
          return accLP + 0;
        }
        // Pick-up historical performance data array
        const histPerfList = currentLP['air-interface-2-0:air-interface-pac']['air-interface-historical-performances']['historical-performance-data-list'];
        // Filter out data that is not related to air-interface 15 minutes and should match period end time
        const histDataClean = histPerfList.filter((perfData) => perfData[ENDTIME] == periodEndTime && perfData['granularity-period'] == `air-interface-2-0:${GRAN_15MIN}`);
        // Sum all interval-capacity
        const resHistory = histDataClean.reduce((accHis, currHistory) => accHis += currHistory[PERFDATA]['interval-capacity'], 0);

        return accLP + resHistory;
      }, 0); // 0 is initial accumulator
      return accLTP + resLP;
    }, 0); // 0 is initial accumulator

    // 'Sum of the intervalCapacity of all AirInterfaces in the aggregation group that is transporting this EthernetContainer in kbps
    // from [sum of all {[/logical-termination-point={physical-server-ltp-list[*]}/layer-protocol=*/air-interface-2-0:air-interface-pac/air-interface-historical-performances/historical-performance-data-list={$input.period-end-time}/performance-data/interval-capacity}]
    //             with {[/logical-termination-point={physical-server-ltp-list[*]}/layer-protocol=*/air-interface-2-0:air-interface-pac/air-interface-historical-performances/historical-performance-data-list={$input.period-end-time}/granularity-period]}==air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN'

    // TODO: manage totalAirInterfaceIntervalCapacity could not be provided'
    return {
      'total-air-interface-interval-capacity': totalAirIfCap
    };
  } catch (err) {
    return ERRORS.GENERAL_ERROR;
  }

}

// Calculates the utilization
// input
// - total-bytes-output
// - total-air-interface-interval-capacity
// - time-period
// 
// Errors:
// - 'totalBytesOutput not provided'
// - 'totalBytesOutput invalid'
// - 'totalAirInterfaceIntervalCapacity not provided'
// - 'totalAirInterfaceIntervalCapacity invalid'
// - 'timePeriod not provided'
// - 'timePeriod invalid'
// - 'utilization could not be provided'
// - 'General processing error'
function calculateUtilization(input) {
  try {
    const totalByteOutput = input[TOTBYTEOUT];   //string
    const totalAirIfIntCap = input[TOTAIRIFCAP]; // integer
    const timePeriod = input[TIMEPERIOD];        // integer

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
    let result;
    // Check if Denominator is 0, then set by default to 0
    if (calcDen == 0) {
      return ERRORS.UTILIZATION_COULDNT_PROVIDED;
    } else {
      result = (calcNum / calcDen) * 100;
    }

    // Return result
    return {
      'utilization': result
    };
  } catch (err) {
    return ERRORS.GENERAL_ERROR;
  }
}

// Calculates utilization of the aggregated physical resources in a performance data slice
// input:
// - historical-performance-data
// - aggregation-group
// - result-cc
// 
// Errors - Utilization added:
// - 'historicalPerformanceData not provided'
// - 'historicalPerformanceData invalid'
// - 'aggregationGroup not provided'
// - 'aggregationGroup invalid'
// - 'result-cc not provided'
// - 'result-cc invalid'
// - 'Utilization could not be added'
// - 'General processing error'
const p1CalculateUtilization = (input) => {
  try {
    const historicalPerfData = input[HISTPERFDATA]; // Object
    const aggGroup = input[AGGGROUP];               // Object
    const resultCC = input[RESCC];                  // Object

    // Validate Historical Performance Data
    if (historicalPerfData == null) {
      return ERRORS.HIST_PERF_DATA_NOT_PROVIDED;
    } else if (historicalPerfData['granularity-period'] == null ||
      historicalPerfData[ENDTIME] == null ||
      historicalPerfData[PERFDATA] == null) {
      return ERRORS.HIST_PERF_DATA_INVALID;
    }

    // Validate Aggreghation Group
    if (aggGroup && aggGroup != undefined) {
      if (aggGroup[PSYSERVERLTP] == null ||
        aggGroup[PSYSERVERLTP].length == 0) {
        return ERRORS.AGG_GROUP_INVALID;
      }
    }

    // Valuidate Result CC
    if (resultCC == null) {
      return ERRORS.RESULT_CC_NOT_PROVIDED;
    } else if (!validateResultCC(resultCC)) {
      return ERRORS.RESULT_CC_INVALID;
    }

    // TODO: manage 'Utilization could not be added'

    // Functions must process only 15 minutes of PM
    let returnData;
    let retHistoricalPerfData = JSON.parse(JSON.stringify(historicalPerfData)); // Initializate return value
    const granularityPeriod = retHistoricalPerfData['granularity-period'];
    if (granularityPeriod.endsWith(GRAN_15MIN)) {
      const inputCapacity = {
        'logical-termination-point': resultCC[LTP],
        'physical-server-ltp-list': aggGroup[PSYSERVERLTP],
        'period-end-time': retHistoricalPerfData[ENDTIME],
      }
      let totAirCapacity = calculateTotalAirInterfaceIntervalCapacity(inputCapacity);
      if (typeof totAirCapacity == "string") {
        return ERRORS.UTILIZATION_COULDNT_ADD;
      }
      retHistoricalPerfData[PERFDATA][TOTAIRIFCAP] = totAirCapacity[TOTAIRIFCAP];

      const inputStruct = {
        'total-bytes-output': retHistoricalPerfData[PERFDATA][TOTBYTEOUT], // string
        'total-air-interface-interval-capacity': retHistoricalPerfData[PERFDATA][TOTAIRIFCAP], // integer
        'time-period': retHistoricalPerfData[PERFDATA][TIMEPERIOD] // integer
      }
      let utilization = calculateUtilization(inputStruct);
      if (typeof utilization == "string") {
        return ERRORS.UTILIZATION_COULDNT_ADD;
      }

      retHistoricalPerfData[PERFDATA]['utilization'] = utilization['utilization'];
      returnData = {
        'historical-performance-data': retHistoricalPerfData
      };
    } else if (granularityPeriod.endsWith(GRAN_24H) || granularityPeriod.endsWith(GRAN_UNKN) || granularityPeriod.endsWith(GRAN_NOTDEF)) {
      returnData = {
        'historical-performance-data': retHistoricalPerfData
      };
    } else {
      return ERRORS.HIST_PERF_DATA_INVALID;
    }

    // Return value
    return returnData;
  } catch (err) {
    return ERRORS.GENERAL_ERROR;
  }
};

module.exports = p1CalculateUtilization;