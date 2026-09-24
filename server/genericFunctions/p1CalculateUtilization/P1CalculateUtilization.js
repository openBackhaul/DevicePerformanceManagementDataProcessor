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

const AIR_LAYER = 'air-interface-2-0:LAYER_PROTOCOL_NAME_TYPE_AIR_LAYER';
const INT64_MAX = 9223372036854775807n;
// yang:date-and-time, e.g. "2026-04-01T06:00:00.0+00:00" or "2026-04-01T06:00:00Z"
const DATE_AND_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;


function validateResultCC(input) {
  try {
    if (input[LTP] != null && Array.isArray(input[LTP])) {
      input[LTP].forEach(ltpObj => {
        if (Object.hasOwn(ltpObj, 'uuid') &&
          Object.hasOwn(ltpObj, 'layer-protocol')) {

          if (Array.isArray(ltpObj['layer-protocol'])) {
            const lp = ltpObj['layer-protocol'][0];
            if (lp != null && lp['layer-protocol-name'] == "air-interface-2-0:LAYER_PROTOCOL_NAME_TYPE_AIR_LAYER") {
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

function isLtpUuid(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidLtpList(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isLtpUuid);
}

// Stored LTP uuids carry the mount name ("121252295+LTP-MWPS-TTP-RADIO-1A")
// while client-ltp/server-ltp references do not ("LTP-MWPS-TTP-RADIO-1A").
function stripMountPrefix(uuid) {
  const value = String(uuid || '').trim();
  const plusIndex = value.lastIndexOf('+');
  return plusIndex >= 0 ? value.substring(plusIndex + 1) : value;
}

function sameLtpReference(left, right) {
  const leftValue = String(left || '').trim();
  const rightValue = String(right || '').trim();
  if (!leftValue || !rightValue) {
    return false;
  }
  return leftValue === rightValue || stripMountPrefix(leftValue) === stripMountPrefix(rightValue);
}

function hasLtpReference(referenceList, reference) {
  const references = Array.isArray(referenceList) ? referenceList : [referenceList];
  return references.some(item => sameLtpReference(item, reference));
}

function findLtp(ltpList, reference) {
  return ltpList.find(ltp => sameLtpReference(ltp.uuid, reference));
}

// The physical server of one serving structure, as
// {result-cc/logical-termination-point={serving-structure}/server-ltp[0]}.
//
// p1FieldsFilter keeps only AirInterface and EthernetContainer LTPs, so the
// structure itself is usually absent from resultCc. Its physical server is then
// taken from the reverse relation: the LTPs whose client-ltp names the
// structure. That relation is unordered, so 'server-ltp[0]' cannot be
// identified; the first one found is used, which keeps the cardinality of one
// physical server per serving structure (a structure lists several servers only
// where a single one is active at a time, e.g. 1+1 protection or a combo port).
function findPhysicalServerLtp(ltpList, structureReference) {
  const structure = findLtp(ltpList, structureReference);

  if (structure) {
    const servers = structure['server-ltp'];
    return Array.isArray(servers) && isLtpUuid(servers[0])
      ? findLtp(ltpList, servers[0])
      : undefined;
  }

  return ltpList.find(ltp => hasLtpReference(ltp['client-ltp'], structureReference));
}

// Prepares the list of physical servers for either an individual link or an
// aggregation group.
// input
// - aggregation-group (optional, already validated by the caller)
// - result-cc
// - uuid-of-ethernet-container
//
// Returns null when the list could not be provided.
function preparePhysicalServerLtpList(aggregationGroup, resultCc, uuidOfEthernetContainer) {
  if (aggregationGroup != null) {
    return aggregationGroup[PSYSERVERLTP];
  }

  if (!isLtpUuid(uuidOfEthernetContainer)) {
    return null;
  }
  const ltpList = resultCc[LTP];
  const ethernetContainer = findLtp(ltpList, uuidOfEthernetContainer);
  const servingStructureLtpList = ethernetContainer?.['server-ltp'];
  if (!isValidLtpList(servingStructureLtpList)) {
    return null;
  }

  const physicalServerLtpList = [];
  for (const structureReference of servingStructureLtpList) {
    const physicalServer = findPhysicalServerLtp(ltpList, structureReference);
    if (!physicalServer) {
      return null;
    }
    physicalServerLtpList.push(physicalServer.uuid);
  }
  return [...new Set(physicalServerLtpList)];
}

// Instant of a yang:date-and-time value, or null when the value is not one.
// Instants are compared because the same period-end-time can be written in
// different ways ("...T06:00:00Z", "...T06:00:00.0+00:00").
function toInstant(dateAndTime) {
  if (typeof dateAndTime !== 'string' || !DATE_AND_TIME.test(dateAndTime)) {
    return null;
  }
  const instant = Date.parse(dateAndTime);
  return Number.isFinite(instant) ? instant : null;
}

// Historical performance records of one AirInterface layer protocol
function airInterfaceHistoricalRecords(layerProtocol) {
  const airPerfHist = layerProtocol['air-interface-2-0:air-interface-pac']['air-interface-historical-performances'];
  if (Array.isArray(airPerfHist?.['historical-performance-data-list'])) {
    return airPerfHist['historical-performance-data-list'];
  }
  return Array.isArray(airPerfHist) ? airPerfHist : [];
}

// totalBytesOutput is the string representation of a (non-negative) int64
// value; a JSON number is tolerated, as in p1CalculateEthernetKpis
function isTotalBytesOutput(value) {
  if (typeof value === 'string') {
    return /^\d+$/.test(value) && BigInt(value) <= INT64_MAX;
  }
  return Number.isSafeInteger(value) && value >= 0;
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
    } else if (!Array.isArray(ltpList)) {
      return ERRORS.LTP_LIST_INVALID;
    }

    if (psyServerLTP == null) {
      return ERRORS.PSY_SERVER_LTP_LIST_NOT_PROVIDED;
    } else if (!isValidLtpList(psyServerLTP)) {
      return ERRORS.PSY_SERVER_LTP_LIST_INVALID;
    }

    if (periodEndTime == null) {
      return ERRORS.PERIOD_ENDTIME_NOT_PROVIDED;
    }
    const periodEndInstant = toInstant(periodEndTime);
    if (periodEndInstant == null) {
      return ERRORS.PERIOD_ENDTIME_INVALID;
    }

    // Filter out LTP no in ServerList
    const cleanLTPlist = ltpList.filter((ltp) => hasLtpReference(psyServerLTP, ltp['uuid']));

    // 'Sum of the intervalCapacity of all AirInterfaces in the aggregation group that is transporting this EthernetContainer in kbps
    // from [sum of all {[/logical-termination-point={physical-server-ltp-list[*]}/layer-protocol=*/air-interface-2-0:air-interface-pac/air-interface-historical-performances/historical-performance-data-list={$input.period-end-time}/performance-data/interval-capacity}]
    //             with {[/logical-termination-point={physical-server-ltp-list[*]}/layer-protocol=*/air-interface-2-0:air-interface-pac/air-interface-historical-performances/historical-performance-data-list={$input.period-end-time}/granularity-period]}==air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN'
    let totalAirIfCap = 0;
    let matchedRecords = 0;
    for (const ltp of cleanLTPlist) {
      const airLayers = ltp['layer-protocol'].filter(lpObj => lpObj['layer-protocol-name'] == AIR_LAYER);
      for (const airLayer of airLayers) {
        // The list is keyed by granularity-period and period-end-time: one record per instant
        const record = airInterfaceHistoricalRecords(airLayer).find(perfData =>
          perfData['granularity-period'] == `air-interface-2-0:${GRAN_15MIN}` &&
          toInstant(perfData[ENDTIME]) === periodEndInstant);
        if (record === undefined) {
          continue;
        }
        const intervalCapacity = record[PERFDATA]?.['interval-capacity'];
        if (!Number.isInteger(intervalCapacity) || intervalCapacity < 0) {
          return ERRORS.TOTAL_AIR_IF_INT_CAP_COULDNT_PROVIDED;
        }
        totalAirIfCap += intervalCapacity;
        matchedRecords++;
      }
    }

    // No AirInterface record for this period-end-time
    if (matchedRecords == 0) {
      return ERRORS.TOTAL_AIR_IF_INT_CAP_COULDNT_PROVIDED;
    }

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
    const totalByteOutput = input[TOTBYTEOUT];   // string (int64)
    const totalAirIfIntCap = input[TOTAIRIFCAP]; // integer, kbps
    const timePeriod = input[TIMEPERIOD];        // integer, seconds

    if (totalByteOutput == null) {
      return ERRORS.TOTAL_BYTE_OUTPUT_NOT_PROVIDED;
    } else if (!isTotalBytesOutput(totalByteOutput)) {
      return ERRORS.TOTAL_BYTE_OUTPUT_INVALID;
    }

    if (totalAirIfIntCap == null) {
      return ERRORS.TOTAL_AIR_IF_INT_CAP_NOT_PROVIDED;
    } else if (!Number.isInteger(totalAirIfIntCap) || totalAirIfIntCap < 0) {
      return ERRORS.TOTAL_AIR_IF_INT_CAP_INVALID;
    }

    if (timePeriod == null) {
      return ERRORS.TIME_PERIOD_NOT_PROVIDED;
    } else if (!Number.isInteger(timePeriod) || timePeriod <= 0) {
      return ERRORS.TIME_PERIOD_INVALID;
    }

    // From Spec file: interface.yaml
    //    'Interval utilization in %
    //    from [ {total-bytes-output}*8 / ( {total-air-interface-interval-capacity}*1000 * {time-period} ) ]'
    // Integer arithmetic: a float quotient turns e.g. 29 % into 28.999...
    const calcNum = BigInt(totalByteOutput) * 8n;
    const calcDen = BigInt(totalAirIfIntCap) * 1000n * BigInt(timePeriod);

    // Check if Denominator is 0 (no capacity)
    if (calcDen == 0n) {
      return ERRORS.UTILIZATION_COULDNT_PROVIDED;
    }
    // utilization is an integer: rounded down, like the busy-hour utilization
    const result = Number(calcNum * 100n / calcDen);

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
// - aggregation-group (optional: absent/null for an EthernetContainer on a single server)
// - result-cc
// - uuid-of-ethernet-container (used when aggregation-group is absent)
// 
// Errors - Utilization added:
// - 'historicalPerformanceData not provided'
// - 'historicalPerformanceData invalid'
// - 'aggregationGroup not provided' (neither group nor EthernetContainer UUID supplied)
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

    // Without a group, the EthernetContainer UUID is needed for topology lookup.
    if (aggGroup == null && input['uuid-of-ethernet-container'] == null) {
      return ERRORS.AGG_GROUP_NOT_PROVIDED;
    }

    // Omitted/null groups use topology lookup. A supplied malformed group
    // must fail rather than silently falling back to a different topology.
    if (aggGroup != null && (typeof aggGroup !== 'object' || Array.isArray(aggGroup) ||
        !isValidLtpList(aggGroup[PSYSERVERLTP]))) {
      return ERRORS.AGG_GROUP_INVALID;
    }

    // Valuidate Result CC
    if (resultCC == null) {
      return ERRORS.RESULT_CC_NOT_PROVIDED;
    } else if (!validateResultCC(resultCC)) {
      return ERRORS.RESULT_CC_INVALID;
    }

    const physicalServerLtpList = preparePhysicalServerLtpList(
      aggGroup,
      resultCC,
      input['uuid-of-ethernet-container']
    );
    if (!physicalServerLtpList) {
      return ERRORS.UTILIZATION_COULDNT_ADD;
    }

    // Functions must process only 15 minutes of PM
    let returnData;
    let retHistoricalPerfData = JSON.parse(JSON.stringify(historicalPerfData)); // Initializate return value
    const granularityPeriod = retHistoricalPerfData['granularity-period'];
    if (granularityPeriod.endsWith(GRAN_15MIN)) {
      const inputCapacity = {
        'logical-termination-point': resultCC[LTP],
        'physical-server-ltp-list': physicalServerLtpList,
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