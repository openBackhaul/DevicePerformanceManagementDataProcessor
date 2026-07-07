const ERRORS = require('./ErrorsEnum');

const GRANULARITY_15M = "GRANULARITY_PERIOD_TYPE_PERIOD-15-MINUTES";

const MINUTES_BY_DAY = "15-minute-values-by-day";
const MINUTES_BY_HOUR = "15-minute-values-by-hour";

const GRANULARITY_PERIOD = "granularity-period";
const PERIOD_END_TIME = "period-end-time";

// Calculates busy hour KPIs based on the status data derived from iterating the 15-min periods
// - historical-performance-data
// - interface-status
function p1CalculateBusyHourPerformanceIndicators(input) {
  try {
    const historicalPerformanceData = input?.["historical-performance-data"];
    const interfaceStatus = input?.["interface-status"];

    if (input == null || (historicalPerformanceData == undefined && interfaceStatus == undefined)) {
      return ERRORS.GENERAL_ERROR;
    }

    if (!historicalPerformanceData) {
      return ERRORS.HISTORICAL_PERF_NOT_PROVIDED;
    }

    if (!interfaceStatus) {
      return ERRORS.INT_STATUS_NOT_PROVIDED;
    }

    if (checkGranularity(historicalPerformanceData[GRANULARITY_PERIOD])) {
      return ERRORS.HISTORICAL_PERF_WRONG_GRAN_PROV;
    }

    const periodEndTime = historicalPerformanceData[PERIOD_END_TIME];

    if (!periodEndTime) {
      return ERRORS.HISTORICAL_PERF_INVALID;
    }

    const day = parseDayOfMonth(periodEndTime);

    const dayEntry = interfaceStatus[MINUTES_BY_DAY]
      ?.find(entry => entry.day === day);

    if (!dayEntry || !Array.isArray(dayEntry[MINUTES_BY_HOUR])) {
      return ERRORS.INT_STATUS_INVALID;
    }

    const aggregatedTotalBytesOutputByHour =
      aggregateTotalBytesOutput(dayEntry[MINUTES_BY_HOUR]);

    const busyHourIdentifier =
      identifyBusyHour(aggregatedTotalBytesOutputByHour);

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

function checkGranularity(granularity) {
  return granularity.endsWith(GRANULARITY_15M);
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

  const erroredFrames = values.reduce((sum, value) => {
    return sum + toNumber(value["errored-frames-input"]);
  }, 0);

  const droppedFrames = values.reduce((sum, value) => {
    return sum + toNumber(value["dropped-frames-input"]);
  }, 0);

  const aggregatedTotalBytesOutput =
    busyHourIdentifier["aggregated-total-bytes-output"];

  const throughput = Math.floor(
    aggregatedTotalBytesOutput * 8 / (1000 * 3600)
  );

  const capacity = Math.floor(totalCapacity / 4);

  const utilization = capacity > 0
    ? Math.floor((throughput / capacity) * 100)
    : 0;

  return {
    "period-end-time-list": periodEndTimeList,
    "label": buildBusyHourLabel(periodEndTime24h, busyHourIdentifier.hour),
    "throughput": throughput,
    "capacity": capacity,
    "utilization": utilization,
    "errored-frames": erroredFrames,
    "dropped-frames": droppedFrames,
    "suspicious-result-flag": values.length < 4
  };
}

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
