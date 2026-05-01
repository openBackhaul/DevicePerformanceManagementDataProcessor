function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deriveMostRecentTimes(records) {
  let mostRecentPeriodEndTime = null;
  let mostRecentPeriodEndTime24 = null;

  for (const record of records || []) {
    const periodEndTime =
      record.periodEndTime || record["period-end-time"] || record.timestamp || null;

    const granularity = String(record.granularity || record["granularity-period"] || "");

    if (!periodEndTime) {
      continue;
    }

    if (!mostRecentPeriodEndTime || periodEndTime > mostRecentPeriodEndTime) {
      mostRecentPeriodEndTime = periodEndTime;
    }

    if (/24-HOURS/.test(granularity)) {
      if (!mostRecentPeriodEndTime24 || periodEndTime > mostRecentPeriodEndTime24) {
        mostRecentPeriodEndTime24 = periodEndTime;
      }
    }
  }

  return {
    mostRecentPeriodEndTime,
    mostRecentPeriodEndTime24
  };
}

/**
 * Request:
 * {
 *   parameters,
 *   rawCc
 * }
 *
 * Response:
 * {
 *   resultCc,
 *   interfaceMetadataList
 * }
 */
async function run(request) {
  try {
    const { parameters, rawCc, mountName, logger } = request;

    if (!parameters || !rawCc) {
      logger.error(
          {
            label: "invalid-input", 
            mountName
          },
          "Invalid input: parameters and rawCc are mandatory"
        );
      throw new Error("parameters and rawCc are mandatory");
    }

    const resultCc = clone(rawCc);
    const interfaceMetadataList = [];

    for (const ltp of resultCc["logical-termination-point"] || []) {
      let mostRecentPeriodEndTime = null;
      let mostRecentPeriodEndTime24 = null;

      for (const layerProtocol of ltp["layer-protocol"] || []) {
        const aiPac = layerProtocol["air-interface-2-0:air-interface-pac"];
        if (aiPac) {
          const times = deriveMostRecentTimes(
            aiPac["air-interface-historical-performances"]["historical-performance-data-list"] || []
          );

          mostRecentPeriodEndTime =
            [mostRecentPeriodEndTime, times.mostRecentPeriodEndTime]
              .filter(Boolean)
              .sort()
              .slice(-1)[0] || mostRecentPeriodEndTime;

          mostRecentPeriodEndTime24 =
            [mostRecentPeriodEndTime24, times.mostRecentPeriodEndTime24]
              .filter(Boolean)
              .sort()
              .slice(-1)[0] || mostRecentPeriodEndTime24;
        }

        const ecPac = layerProtocol["ethernet-container-2-0:ethernet-container-pac"];
        if (ecPac) {
          const times = deriveMostRecentTimes(
            ecPac["ethernet-container-historical-performances"] || []
          );

          mostRecentPeriodEndTime =
            [mostRecentPeriodEndTime, times.mostRecentPeriodEndTime]
              .filter(Boolean)
              .sort()
              .slice(-1)[0] || mostRecentPeriodEndTime;

          mostRecentPeriodEndTime24 =
            [mostRecentPeriodEndTime24, times.mostRecentPeriodEndTime24]
              .filter(Boolean)
              .sort()
              .slice(-1)[0] || mostRecentPeriodEndTime24;
        }
      }

      interfaceMetadataList.push({
        uuid: ltp.uuid,
        mostRecentPeriodEndTime,
        mostRecentPeriodEndTime24
      });
    }

    resultCc["interface-metadata-list"] = interfaceMetadataList;

    return {
      resultCc,
      interfaceMetadataList,
      mountName
    };
  } catch (error) {
    error.stage = "p1CreateResultCc";
    logger.error(
        {
          label: "process-device-p1CreateResultCc",
          error: error.message || error
        },
        "Failed to process device in p1CreateResultCc"
    );
    throw error;
  }
}

module.exports = { run };