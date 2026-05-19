const ERRORS = require('./ErrorsEnum');

const p1DiscardIrrelevantPmRecords = (input) => {
  try {
    // Validate input
    if (!input) {
      return ERRORS.GENERAL_ERROR;
    }

    if (input["historical-performance-data-list"] == undefined) {
      return ERRORS.HISTPERF_NOT_PROVIDED;
    }

    if (!Array.isArray(input["historical-performance-data-list"])) {
      return ERRORS.HISTPERF_INVALID;
    }

    const records = input["historical-performance-data-list"];

    // Resolve parameters
    const relevantGranularitiesPattern =
      input["relevant-granularities"] ||
      ":GRANULARITY_PERIOD_TYPE_PERIOD-(?:15-MIN|24-HOURS)";

    const granularityRegex = new RegExp(relevantGranularitiesPattern);

    const recent15 = input["most-recent-period-end-time"];
    const recent24 = input["most-recent-period-end-time-24"];

    let mostRecent15;
    let mostRecent24;
    if (recent15 != undefined && typeof recent15 != "string") {
      return ERRORS.GENERAL_ERROR;
    } else if (recent15 == undefined) {
      mostRecent15 = new Date(null); // Process all data
    } else {
      mostRecent15 = recent15;
    }

    if (recent24 != undefined && typeof recent24 != "string") {
      return ERRORS.GENERAL_ERROR;
    } else if (recent24 == undefined) {
      mostRecent24 == new Date(null);  // Process all data
    } else {
      mostRecent24 = recent24;
    }


    // Convert to Date if present
    const mostRecent15Date = Date.parse(mostRecent15);
    const mostRecent24Date = Date.parse(mostRecent24);

    // Filter logic
    const filtered = records.filter((record) => {
      if (!record) {
        return false;
      }

      const granularity = record["granularity-period"];
      const periodEndTime = record["period-end-time"];

      // Basic validation
      if (!granularity || !periodEndTime) {
        return false;
      }

      // Granularity regex filter
      if (!granularityRegex.test(granularity)) {
        return false;
      }

      if (periodEndTime == undefined) {
        return false;
      } else if (typeof periodEndTime != "string") {
        return false;
      }

      // const recordDate = new Date(periodEndTime);
      const recordDate = Date.parse(periodEndTime);
      if (isNaN(recordDate)){
        return false;
      }

      //---- 15-min filtering -------------------------------------------------
      if (
        granularity.endsWith(":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN") &&
        mostRecent15Date
      ) {
        if (recordDate <= mostRecent15Date) {
          return false;
        }
      }

      //---- 24h filtering ----------------------------------------------------
      if (
        granularity.endsWith(":GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS") &&
        mostRecent24Date
      ) {
        if (recordDate <= mostRecent24Date) {
          return false;
        }
      }

      return true;
    });

    // Output
    return {
      "filtered-historical-performance-data-list": filtered,
    };
  } catch (e) {
    return ERRORS.GENERAL_ERROR;
  }
}

module.exports = p1DiscardIrrelevantPmRecords;
