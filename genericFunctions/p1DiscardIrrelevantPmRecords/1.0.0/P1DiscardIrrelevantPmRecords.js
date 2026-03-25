const ERRORS = require('./ErrorsEnum');

const p1DiscardIrrelevantPmRecords = (input) => {
  try {
    // Validate input
    if (!input || !Array.isArray(input["historical-performance-data-list"])) {
      return ERRORS.HISTPERF_NOT_PROVIDED;
    }

    const records = input["historical-performance-data-list"];

    // Resolve parameters
    const relevantGranularitiesPattern =
      input["relevant-granularities"] ||
      ":GRANULARITY_PERIOD_TYPE_PERIOD-(?:15-MIN|24-HOURS)";

    const granularityRegex = new RegExp(relevantGranularitiesPattern);

    const mostRecent15 = input["most-recent-period-end-time"];
    const mostRecent24 = input["most-recent-period-end-time-24"];

    // Convert to Date if present
    const mostRecent15Date = mostRecent15 ? new Date(mostRecent15) : null;
    const mostRecent24Date = mostRecent24 ? new Date(mostRecent24) : null;

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

      const recordDate = new Date(periodEndTime);
      if (isNaN(recordDate)){
        return false;
      }

      // 15-min filtering
      if (
        granularity.endsWith(":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN") &&
        mostRecent15Date
      ) {
        if (recordDate <= mostRecent15Date) {
          return false;
        }
      }

      // 24h filtering
      // -----------------------------------
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
