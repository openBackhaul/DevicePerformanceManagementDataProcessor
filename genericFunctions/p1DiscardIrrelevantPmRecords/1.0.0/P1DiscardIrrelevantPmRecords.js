/**
 * p1DiscardIrrelevantPmRecords
 */
const p1DiscardIrrelevantPmRecords = (input) => {
  try {
    // Validate input
    if (!input || !Array.isArray(input["historical-performance-data-list"])) {
      return "historicalPerformanceDataList not provided";
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
      console.log("Granularity: " + granularity);
      console.log("mostRecent15Date: " + mostRecent15Date);
      // Basic validation
      if (!granularity || !periodEndTime) {
        console.error("Error Basic Validation");
        return false;
      } else {
        console.log("Basic Validation OK");
      }

      // Granularity regex filter
      if (!granularityRegex.test(granularity)) {
        console.error("REGEX Granularity failing");
        return false;
      } else {
        console.log("REGEX Granularity OK");
      }

      const recordDate = new Date(periodEndTime);
      if (isNaN(recordDate)){
        console.error("is NaN");
        return false;
      } else {
        console.log("is not a NaN");
      }
      console.log(granularity)
      // 15-min filtering
      if (
        granularity.endsWith(":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN") &&
        mostRecent15Date
      ) {
        console.log("15 minutes analysis");
        if (recordDate <= mostRecent15Date) {
          return false;
        } else {
          console.log("is 15 min discarded");
        }
      } else {
        console.log("15 minute filter does")
      }

      // 24h filtering
      // -----------------------------------
      if (
        granularity.endsWith(":GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS") &&
        mostRecent24Date
      ) {
        console.log("24 hours analysis");
        if (recordDate <= mostRecent24Date) {
          console.error("is 24 discarded");
          return false;
        } else {
          console.log("24h NOT discarded");
        }
      }

      return true;
    });

    // Output
    console.log(filtered);
    return {
      "filtered-historical-performance-data-list": filtered,
    };
  } catch (e) {
    return "General processing error";
  }
}

module.exports = p1DiscardIrrelevantPmRecords;
