const fs = require("fs");

const AIR_INTERFACE_PAC_KEY = "air-interface-2-0:air-interface-pac";
const ETHERNET_CONTAINER_PAC_KEY = "ethernet-container-2-0:ethernet-container-pac";

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function isValidTimestamp(value) {
  if (value === undefined || value === null || value === "") {
    return false;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time);
}

function toEpoch(value) {
  return new Date(value).getTime();
}

function is15MinGranularity(value) {
  return String(value || "").includes("PERIOD-15-MIN");
}

function is24HourGranularity(value) {
  return String(value || "").includes("PERIOD-24-HOURS");
}

function getMostRecentPeriodEndTime(records, granularityMatcher) {
  if (!Array.isArray(records)) {
    return undefined;
  }

  const matchingTimes = records
    .filter((record) => {
      return (
        isPlainObject(record) &&
        granularityMatcher(record["granularity-period"]) &&
        isValidTimestamp(record["period-end-time"])
      );
    })
    .map((record) => record["period-end-time"])
    .sort((a, b) => toEpoch(a) - toEpoch(b));

  return matchingTimes.length > 0
    ? matchingTimes[matchingTimes.length - 1]
    : undefined;
}

function collectHistoricalRecords(layerProtocol) {
  const records = [];

  const airPac = layerProtocol[AIR_INTERFACE_PAC_KEY];
  if (isPlainObject(airPac)) {
    const airHistory =
      airPac["air-interface-historical-performances"]?.["historical-performance-data-list"];

    if (Array.isArray(airHistory)) {
      records.push(...airHistory);
    }
  }

  const ethernetPac = layerProtocol[ETHERNET_CONTAINER_PAC_KEY];
  if (isPlainObject(ethernetPac)) {
    const ethernetHistory =
      ethernetPac["ethernet-container-historical-performances"]?.["historical-performance-data-list"];

    if (Array.isArray(ethernetHistory)) {
      records.push(...ethernetHistory);
    }
  }

  return records;
}

function extractInterfaceMetadataListFromRawResponse(rawResponse) {
  const controlConstruct =
    rawResponse?.body?._source?.["core-model-1-4:control-construct"];

  if (!isPlainObject(controlConstruct)) {
    throw new Error("Invalid raw response: missing core-model-1-4:control-construct");
  }

  const ltpList = Array.isArray(controlConstruct["logical-termination-point"])
    ? controlConstruct["logical-termination-point"]
    : [];

  return ltpList
    .filter((ltp) => isPlainObject(ltp) && ltp.uuid)
    .map((ltp) => {
      const layerProtocolList = Array.isArray(ltp["layer-protocol"])
        ? ltp["layer-protocol"]
        : [];

      const allRecords = layerProtocolList.flatMap(collectHistoricalRecords);

      const mostRecentPeriodEndTime = getMostRecentPeriodEndTime(
        allRecords,
        is15MinGranularity
      );

      const mostRecentPeriodEndTime24 = getMostRecentPeriodEndTime(
        allRecords,
        is24HourGranularity
      );

      return {
        uuid: ltp.uuid,
        mostRecentPeriodEndTime,
        mostRecentPeriodEndTime24
      };
    })
    .filter(
      (item) =>
        item.mostRecentPeriodEndTime !== undefined ||
        item.mostRecentPeriodEndTime24 !== undefined
    );
}

function main() {
  const inputPath = process.argv[2] || "withRetry.rawResponse.json";
  const outputPath = process.argv[3] || "interfaceMetadata.json";

  const raw = fs.readFileSync(inputPath, "utf8");
  const parsed = JSON.parse(raw);

  const interfaceMetadataList =
    extractInterfaceMetadataListFromRawResponse(parsed);

  fs.writeFileSync(
    outputPath,
    JSON.stringify(interfaceMetadataList, null, 2) + "\n",
    "utf8"
  );

  console.log(`Wrote ${interfaceMetadataList.length} records to ${outputPath}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  extractInterfaceMetadataListFromRawResponse
};