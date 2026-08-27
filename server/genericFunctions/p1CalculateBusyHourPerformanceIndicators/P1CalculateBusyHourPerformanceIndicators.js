const ERRORS = require('./ErrorsEnum');

const GRANULARITY_15M = "GRANULARITY_PERIOD_TYPE_PERIOD-15-MINUTES";
const GRANULARITY_24h = "GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS"

const MINUTES_BY_DAY = "15-minute-values-by-day";
const MINUTES_BY_HOUR = "15-minute-values-by-hour";

const GRANULARITY_PERIOD = "granularity-period";
const PERIOD_END_TIME = "period-end-time";

// Calculates busy hour KPIs based on the status data derived from iterating the 15-min periods
// - historical-performance-data
// - interface-status
function p1CalculateBusyHourPerformanceIndicators(input) {
  try {

    // Validation of input data
    if (input == null || input == undefined) {
      return ERRORS.GENERAL_ERROR;
    }

    if (input["historical-performance-data"] == undefined && input["interface-status"] == undefined) {
      return ERRORS.GENERAL_ERROR;
    }

    // Validation of historical-performance-data property
    if (input["historical-performance-data"] == undefined) {
      return ERRORS.HISTORICAL_PERF_NOT_PROVIDED;
    }

    if (typeof input["historical-performance-data"] !== "object" || Array.isArray(input["historical-performance-data"])) {
      return ERRORS.HISTORICAL_PERF_INVALID;
    }

    // Validation of interface-status property
    if (input["interface-status"] == undefined) {
      return ERRORS.INT_STATUS_NOT_PROVIDED;
    }

    if (typeof input["interface-status"] !== "object" || Array.isArray(input["interface-status"])) {
      return ERRORS.INT_STATUS_INVALID;
    }

    const historicalPerformanceData = input["historical-performance-data"];
    const interfaceStatus = input["interface-status"];
    if (!checkGranularity24H(historicalPerformanceData[GRANULARITY_PERIOD])) {
      return ERRORS.HISTORICAL_PERF_WRONG_GRAN_PROV;
    }

    const periodEndTime = historicalPerformanceData[PERIOD_END_TIME];

    if (!periodEndTime || typeof periodEndTime == "number" || typeof periodEndTime == "object") {
      return ERRORS.HISTORICAL_PERF_INVALID;
    }

    const day = parseDayOfMonth(periodEndTime);

    // Validating interface-status content
    if (interfaceStatus[MINUTES_BY_DAY] == undefined) {
      return ERRORS.INT_STATUS_INVALID;
    }

    const dayEntry = interfaceStatus[MINUTES_BY_DAY].find(entry => entry.day === day);

    if (!dayEntry || !Array.isArray(dayEntry[MINUTES_BY_HOUR])) {
      return ERRORS.INT_STATUS_INVALID;
    }

    // Aggregate Total Bytes Ouput per Day
    const aggregatedTotalBytesOutputByHour =
      aggregateTotalBytesOutput(dayEntry[MINUTES_BY_HOUR]);

    // Identifying BusyHour
    const busyHourIdentifier =
      identifyBusyHour(aggregatedTotalBytesOutputByHour);

    // Calculate Busy Hours KPIs
    const busyHourValues = calculateBusyHourKpis(
      dayEntry[MINUTES_BY_HOUR],
      busyHourIdentifier,
      periodEndTime
    );

    if (!historicalPerformanceData["performance-data"]) {
      historicalPerformanceData["performance-data"] = {};
    }

    historicalPerformanceData["performance-data"]["busy-hour"] = busyHourValues;

    return {
      "historical-performance-data": historicalPerformanceData
    };
  } catch (error) {
    return ERRORS.GENERAL_ERROR;
  }

}

function checkGranularity24H(granularity) {
  return granularity.endsWith(GRANULARITY_24h);
}

function aggregateTotalBytesOutput(valuesByHour) {
  return valuesByHour.map(hourEntry => {
    const values = Array.isArray(hourEntry["15-minute-values"])
      ? hourEntry["15-minute-values"]
      : [];

    const aggregatedTotalBytesOutput = values.reduce((sum, value) => {
      return sum + toNumber(value["total-bytes-output"]);
    }, 0);

    return {
      hour: hourEntry.hour,
      "aggregated-total-bytes-output": aggregatedTotalBytesOutput
    };
  });
}

function identifyBusyHour(aggregatedByHour) {
  return aggregatedByHour.reduce((busyHour, currentHour) => {
    if (
      currentHour["aggregated-total-bytes-output"] >
      busyHour["aggregated-total-bytes-output"]
    ) {
      return currentHour;
    }

    return busyHour;
  }, {
    hour: 0,
    "aggregated-total-bytes-output": -1
  });
}

function calculateBusyHourKpis(valuesByHour, busyHourIdentifier, periodEndTime24h) {
  const busyHourEntry = valuesByHour.find(
    entry => entry.hour === busyHourIdentifier.hour
  );

  const values = Array.isArray(busyHourEntry?.["15-minute-values"])
    ? busyHourEntry["15-minute-values"]
    : [];

  const periodEndTimeList = values
    .map(value => value[PERIOD_END_TIME])
    .filter(Boolean);

  const totalCapacity = values.reduce((sum, value) => {
    return sum + toNumber(value["total-air-interface-interval-capacity"]);
  }, 0);

  //  'errored frames during the busy hour
  // from { sum( {$input#/15-minute-values-by-hour={$input#/busy-hour-identifier/hour}/15-minute-values[*]/errored-frames-input} ) }'
  const erroredFrames = values.reduce((sum, value) => {
    return sum + toNumber(value["errored-frames-input"]);
  }, 0);

  // 'dropped frames during the busy hour
  // from { sum( {$input#/15-minute-values-by-hour={$input#/busy-hour-identifier/hour}/15-minute-values[*]/dropped-frames-input} ) }'
  const droppedFrames = values.reduce((sum, value) => {
    return sum + toNumber(value["dropped-frames-input"]);
  }, 0);

  const aggregatedTotalBytesOutput =
    busyHourIdentifier["aggregated-total-bytes-output"];

  // 'throughput during the busy hour
  // aggregated-total-bytes-output transformed from byte to kbit, and divided by assumed 3600 seconds of the measurement period
  // from { {$input#/busy-hour-identifier/aggregated-total-bytes-output} * 8 / ( 1000 * 3600 ) }'
  const throughput = Math.floor(
    aggregatedTotalBytesOutput * 8 / (1000 * 3600)
  );

  // 'capacity during the busy hour
  // sum of total-air-interface-interval-capacity values divided by assumed four 15-min periods
  // from { sum( {$input#/15-minute-values-by-hour={$input#/busy-hour-identifier/hour}/15-minute-values[*]/total-air-interface-interval-capacity} ) / 4 }'
  const capacity = Math.floor(totalCapacity / 4);

  // 'utilization during the busy hour
  // throughput / capacity, transformed to percentage
  // from { {$output#/busy-hour-values/throughput} / {$output#/busy-hour-values/capacity} * 100 }'
  const utilization = capacity > 0
    ? Math.floor((throughput / capacity) * 100)
    : 0;

  // 'label of the busy hour with the format YYYY/MM/DD/hh/mm
  // from { parsed and composed from earliest date in {$output#/busy-hour-values/period-end-time-list} }'
  const bhLabel = buildBusyHourLabel(periodEndTime24h, busyHourIdentifier.hour);

  // 'flag indicating suspicious busy hour KPIs
  // from { {true} if in any of the period-end-time-list, capacity, errored-frames, or dropped-frames calculations less than 4 valid 15-minute values were available, otherwise {false} }'
  const suspResultFlag = values.length < 4;

  // Return Dataset
  return {
    "period-end-time-list": periodEndTimeList,
    "label": bhLabel,
    "throughput": throughput,
    "capacity": capacity,
    "utilization": utilization,
    "errored-frames": erroredFrames,
    "dropped-frames": droppedFrames,
    "suspicious-result-flag": suspResultFlag
  };
}

// Return label as per spec 
// 'label of the busy hour with the format YYYY/MM/DD/hh/mm
// from { parsed and composed from earliest date in {$output#/busy-hour-values/period-end-time-list} }'
function buildBusyHourLabel(periodEndTime24h, hour) {
  const date = new Date(periodEndTime24h);

  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");

  return `${yyyy}/${mm}/${dd}/${hh}/00`;
}

function parseDayOfMonth(periodEndTime) {
  const date = new Date(periodEndTime);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid period-end-time");
  }

  return date.getUTCDate();
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

module.exports = p1CalculateBusyHourPerformanceIndicators;
