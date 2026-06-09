const onfAdapter = require("../../../../infra/onf/onfAdapter");
const { getParamFromFunction } = require("../../../../utils/functionTree");
const { withRetry } = require("../../../../utils/retry");
const p1FieldsFilter = require("./../../../../genericFunctions/p1FieldsFilter/P1FieldsFilter");
const p1DiscardIrrelevantPmRecords = require("./../../../../genericFunctions/p1DiscardIrrelevantPmRecords/P1DiscardIrrelevantPmRecords");
const logger = require('../../../../service/LoggingService.js').getLogger();

const AIR_INTERFACE_PAC_KEY = "air-interface-2-0:air-interface-pac";
const ETHERNET_CONTAINER_PAC_KEY = "ethernet-container-2-0:ethernet-container-pac";

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function isRelevantLayerProtocol(layerProtocol) {
  if (!isPlainObject(layerProtocol)) {
    return false;
  }

  return (
    isPlainObject(layerProtocol[AIR_INTERFACE_PAC_KEY]) ||
    isPlainObject(layerProtocol[ETHERNET_CONTAINER_PAC_KEY])
  );
}

function cleanupCurrentPerformanceDataList(layerProtocol) {
  const airPac = layerProtocol[AIR_INTERFACE_PAC_KEY];

  if (!isPlainObject(airPac)) {
    return layerProtocol;
  }

  const currentPerformance =
    airPac["air-interface-current-performance"];

  if (!isPlainObject(currentPerformance)) {
    return layerProtocol;
  }

  const currentPerformanceDataList =
    currentPerformance["current-performance-data-list"];

  if (!Array.isArray(currentPerformanceDataList)) {
    delete currentPerformance["current-performance-data-list"];
    return layerProtocol;
  }

  const cleanedList = currentPerformanceDataList
    .map((record) => {
      if (!isPlainObject(record)) {
        return undefined;
      }

      if (
        record["granularity-period"] === undefined ||
        record.timestamp === undefined ||
        record["granularity-period"] === "" ||
        record.timestamp === ""
      ) {
        return undefined;
      }

      return {
        "granularity-period": record["granularity-period"],
        timestamp: record.timestamp
      };
    })
    .filter(Boolean);

  if (cleanedList.length > 0) {
    currentPerformance["current-performance-data-list"] = cleanedList;
  } else {
    delete currentPerformance["current-performance-data-list"];
  }

  return layerProtocol;
}

function normalizeRawCcAfterFieldsFilter(rawCc) {
  if (!rawCc || typeof rawCc !== "object") {
    return rawCc;
  }

  const ltpList = Array.isArray(rawCc["logical-termination-point"])
    ? rawCc["logical-termination-point"]
    : [];

  rawCc["logical-termination-point"] = ltpList
    .map((ltp) => {
      if (!isPlainObject(ltp)) {
        return undefined;
      }

      const layerProtocolList = Array.isArray(ltp["layer-protocol"])
        ? ltp["layer-protocol"]
        : [];

      const cleanedLayerProtocolList = layerProtocolList
        .filter(isRelevantLayerProtocol)
        .map(cleanupCurrentPerformanceDataList);

      if (cleanedLayerProtocolList.length === 0) {
        return undefined;
      }

      return {
        ...ltp,
        "layer-protocol": cleanedLayerProtocolList
      };
    })
    .filter(Boolean);

  return rawCc;
}

async function loadInterfaceMetadataList(
  dataStoreClient,
  dataStoreIndex,
  mountName,
  logger
) {
  const response = await withRetry(
    async () =>
      dataStoreClient.get({
        index: dataStoreIndex,
        id: mountName
      }),
    {
      label: `loadInterfaceMetadataList:${mountName}`,
      retryIntervalMs: 10000,
      logger
    }
  ).catch((error) => {
      /* logger.error(
        {
          label: "load-interface-metadata-list",
          error: error.message || error
        },
        "Failed to load interface metadata list"
      ); */
      //if (error.meta && error.meta.statusCode === 404) {
        return [];
      //}
    });

  const source = (response || {}).body?._source || {};
  return source["interface-metadata-list"] || [];
}

function isValidDiscardResponse(response) {
  return (
    response &&
    typeof response === "object" &&
    Array.isArray(response["filtered-historical-performance-data-list"])
  );
}

function buildDiscardPmError(response, inputSummary) {
  const error = new Error(
    `p1DiscardIrrelevantPmRecords returned error response: ${JSON.stringify(response)}`
  );

  error.stage = "p1DiscardIrrelevantPmRecords";
  error.vendorResponse = response;
  error.inputSummary = inputSummary;

  return error;
}

async function filterHistoricalList(
  list,
  relevantGranularities,
  mostRecentPeriodEndTime,
  mostRecentPeriodEndTime24,
  logger
) {

  const discardInput = {
    ...list,
    "relevant-granularities":relevantGranularities,
    "most-recent-period-end-time": mostRecentPeriodEndTime,//(mostRecentPeriodEndTime != undefined) ? new Date(mostRecentPeriodEndTime) : mostRecentPeriodEndTime,
    "most-recent-period-end-time-24": mostRecentPeriodEndTime24,//(mostRecentPeriodEndTime24 != undefined) ? new Date(mostRecentPeriodEndTime24) : mostRecentPeriodEndTime24
  };
  const response = await p1DiscardIrrelevantPmRecords(discardInput);

  if (isValidDiscardResponse(response)) {
    return response["filtered-historical-performance-data-list"];
  }
  
  const inputSummary = {
    inputRecordCount: list.length,
    relevantGranularities,
    mostRecentPeriodEndTime: discardInput["most-recent-period-end-time"],
    mostRecentPeriodEndTime24: discardInput["most-recent-period-end-time-24"]
  };

  if (logger && logger.error) {
    logger.error(
      {
        label: "p1-discard-irrelevant-pm-records-error",
        vendorResponse: response,
        inputSummary
      },
      "p1DiscardIrrelevantPmRecords returned an error response"
    );
  }

  throw buildDiscardPmError(response, inputSummary);
}

const DEFAULT_BATCH_TIMESTAMP = "2010-11-20T14:00:00+01:00";

function isValidTimestamp(value) {
  if (value === undefined || value === null || value === "") {
    return false;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time);
}

function getTimestampEpoch(value) {
  return new Date(value).getTime();
}

function getAirInterfaceCurrentPerformanceDataList(layerProtocol) {
  const airPac = layerProtocol[AIR_INTERFACE_PAC_KEY];

  if (!isPlainObject(airPac)) {
    return [];
  }

  const currentPerformance =
    airPac["air-interface-current-performance"];

  if (!isPlainObject(currentPerformance)) {
    return [];
  }

  const currentPerformanceDataList =
    currentPerformance["current-performance-data-list"];

  if (!Array.isArray(currentPerformanceDataList)) {
    return [];
  }

  return currentPerformanceDataList;
}

function sortCurrentPerformanceDataListByTimestamp(layerProtocol) {
  const airPac = layerProtocol[AIR_INTERFACE_PAC_KEY];

  if (!isPlainObject(airPac)) {
    return;
  }

  const currentPerformance =
    airPac["air-interface-current-performance"];

  if (!isPlainObject(currentPerformance)) {
    return;
  }

  const currentPerformanceDataList =
    currentPerformance["current-performance-data-list"];

  if (!Array.isArray(currentPerformanceDataList)) {
    return;
  }

  /*
   * Keep only records having valid timestamp.
   * Sort by timestamp so the latest record can be derived safely.
   */
  currentPerformance["current-performance-data-list"] =
    currentPerformanceDataList
      .filter((record) => {
        return (
          isPlainObject(record) &&
          isValidTimestamp(record.timestamp)
        );
      })
      .sort((left, right) => {
        return getTimestampEpoch(left.timestamp) - getTimestampEpoch(right.timestamp);
      });
}

function addBatchTimestamp(rawCc) {
  if (!isPlainObject(rawCc)) {
    return DEFAULT_BATCH_TIMESTAMP;
  }

  const timestamps = [];
  const ltpList = Array.isArray(rawCc["logical-termination-point"])
    ? rawCc["logical-termination-point"]
    : [];

  for (const ltp of ltpList) {
    const layerProtocolList = Array.isArray(ltp["layer-protocol"])
      ? ltp["layer-protocol"]
      : [];

    for (const layerProtocol of layerProtocolList) {
      if (!isPlainObject(layerProtocol[AIR_INTERFACE_PAC_KEY])) {
        continue;
      }

      sortCurrentPerformanceDataListByTimestamp(layerProtocol);

      const currentPerformanceDataList =
        getAirInterfaceCurrentPerformanceDataList(layerProtocol);

      for (const record of currentPerformanceDataList) {
        if (isValidTimestamp(record.timestamp)) {
          timestamps.push(record.timestamp);
        }
      }
    }
  }

  if (timestamps.length === 0) {
    rawCc.batchTimestamp = DEFAULT_BATCH_TIMESTAMP;
    return DEFAULT_BATCH_TIMESTAMP;
  }

  timestamps.sort((left, right) => {
    return getTimestampEpoch(left) - getTimestampEpoch(right);
  });

  const latestTimestamp = timestamps[timestamps.length - 1];

  rawCc.batchTimestamp = latestTimestamp;
  return latestTimestamp;
}

/**
 * Request:
 * {
 *   parameters,
 *   mwdiReplicaEsClient,
 *   dataStoreEsClient,
 *   mountName,
 *   runtimeConfig
 * }
 *
 * Response:
 * {
 *   rawCc
 * }
 */
async function run(request) {
  const {
    parameters,
    mwdiReplicaEsClient,
    dataStoreEsClient,
    mountName,
    //logger
  } = request;

  try {
    const replicaClient = await onfAdapter.getEsClient(
      false,
      mwdiReplicaEsClient.uuid,
      mwdiReplicaEsClient,
      logger
    );

    const rawResponse = await withRetry(
      async () =>
        replicaClient.get({
          index: mwdiReplicaEsClient["index-alias"],
          id: mountName
      }),
      {
        label: `loadRawCc:${mountName}`,
        retryIntervalMs: 10000,
        logger
      }
    ).catch((error) => {
      /* logger.error(
        {
          label: "load-raw-cc",
          error: error.message || error
        },
        "Failed to load raw CC from replica"
      ); */
    });

    let rawCc = (rawResponse || {}).body?._source["core-model-1-4:control-construct"] || {
      mountName
    };

    const fieldsFilterString = getParamFromFunction(
      parameters,
      "p1FieldsFilter",
      "fieldsFilter",
      ""
    );

    const fieldsFilterResponse = await p1FieldsFilter.run({
        dataStructure: rawCc,
        fieldsFilterString
    });

    if (typeof fieldsFilterResponse === "string") {
        const error = new Error(
            `p1FieldsFilter returned error response: ${fieldsFilterResponse}`
        );

        error.stage = "p1FieldsFilter";
        error.vendorResponse = fieldsFilterResponse;
        error.retryable = false;

        throw error;
    }

    rawCc =
    fieldsFilterResponse["filtered-data-structure"];
    rawCc = normalizeRawCcAfterFieldsFilter(rawCc);

    /* if (!rawCc || typeof rawCc !== "object") {
        const error = new Error("p1FieldsFilter did not return filtered data structure");

        error.stage = "p1FieldsFilter";
        error.vendorResponse = fieldsFilterResponse;
        error.retryable = false;

        throw error;
    } */

    const dataStoreClient = await onfAdapter.getEsClient(
      false,
      dataStoreEsClient.uuid,
      dataStoreEsClient,
      logger
    );

    const interfaceMetadataList = await loadInterfaceMetadataList(
      dataStoreClient,
      dataStoreEsClient["index-alias"],
      mountName,
      logger
    );

    const relevantGranularities = getParamFromFunction(
      parameters,
      "p1DiscardIrrelevantPmRecords",
      "relevantGranularities",
      ".*"
    );

    for (const ltp of rawCc["logical-termination-point"] || []) {
      const meta = interfaceMetadataList.find((item) => item.uuid === ltp.uuid) || {};

      for (const layerProtocol of ltp["layer-protocol"] || []) {
        const layerProtocolName = String(layerProtocol["layer-protocol-name"] || "");

        if (layerProtocolName.includes("air-interface")) {
          const pac = layerProtocol["air-interface-2-0:air-interface-pac"] || {};

          if(pac["air-interface-historical-performances"] && pac["air-interface-historical-performances"]["historical-performance-data-list"]
             && pac["air-interface-historical-performances"]["historical-performance-data-list"].length > 0) {
              pac["air-interface-historical-performances"] = await filterHistoricalList(
                          pac["air-interface-historical-performances"],
                          relevantGranularities,
                          meta.mostRecentPeriodEndTime,
                          meta.mostRecentPeriodEndTime24,
                          logger
                        );

              layerProtocol["air-interface-2-0:air-interface-pac"] = pac;
          }
          
        }

        if (layerProtocolName.includes("ethernet-container")) {
          const pac = layerProtocol["ethernet-container-2-0:ethernet-container-pac"] || {};
          if(pac["ethernet-container-historical-performances"] && pac["ethernet-container-historical-performances"]["historical-performance-data-list"]
             && pac["ethernet-container-historical-performances"]["historical-performance-data-list"].length > 0) {
            pac["ethernet-container-historical-performances"] = await filterHistoricalList(
              pac["ethernet-container-historical-performances"],
              relevantGranularities,
              meta.mostRecentPeriodEndTime,
              meta.mostRecentPeriodEndTime24,
              logger
            );

            layerProtocol["ethernet-container-2-0:ethernet-container-pac"] = pac;
          }
        }
      }
    }

    addBatchTimestamp(rawCc);

    return { rawCc, mountName };
  } catch (error) {
    error.stage = "p1LoadRawCc";
    logger.error(
        {
          label: "process-device-p1LoadRawCc",
          error: error.message || error
        },
        "Failed to process device in p1LoadRawCc"
    );
    throw error;
  }
}

module.exports = { run };