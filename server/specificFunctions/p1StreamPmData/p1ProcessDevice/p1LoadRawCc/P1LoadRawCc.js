const onfAdapter = require("../../../../infra/onf/onfAdapter");
const { getParamFromFunction } = require("../../../../utils/functionTree");
const { withRetry } = require("../../../../utils/retry");
const p1FieldsFilter = require("./../../../../genericFunctions/p1FieldsFilter/P1FieldsFilter");
const p1DiscardIrrelevantPmRecords = require("./../../../../genericFunctions/p1DiscardIrrelevantPmRecords/P1DiscardIrrelevantPmRecords");
const logger = require('../../../../service/LoggingService.js').getLogger();

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
    "most-recent-period-end-time": (mostRecentPeriodEndTime != undefined) ? new Date(mostRecentPeriodEndTime) : mostRecentPeriodEndTime,
    "most-recent-period-end-time-24": (mostRecentPeriodEndTime24 != undefined) ? new Date(mostRecentPeriodEndTime24) : mostRecentPeriodEndTime24
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

    rawCc = (
      await p1FieldsFilter.run({
        dataStructure: rawCc,
        fieldsFilterString
      })
    ).filteredDataStructure;

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

    const batchTimestamp = new Date().toISOString();

    for (const ltp of rawCc["logical-termination-point"] || []) {
      const meta = interfaceMetadataList.find((item) => item.uuid === ltp.uuid) || {};

      for (const layerProtocol of ltp["layer-protocol"] || []) {
        const layerProtocolName = String(layerProtocol["layer-protocol-name"] || "");

        if (layerProtocolName.includes("air-interface")) {
          const pac = layerProtocol["air-interface-2-0:air-interface-pac"] || {};

          pac["air-interface-historical-performances"] = await filterHistoricalList(
            pac["air-interface-historical-performances"] || [],
            relevantGranularities,
            meta.mostRecentPeriodEndTime,
            meta.mostRecentPeriodEndTime24,
            logger
          );

          for (const record of pac["air-interface-historical-performances"]) {
            record.batchTimestamp = batchTimestamp;
          }

          layerProtocol["air-interface-2-0:air-interface-pac"] = pac;
        }

        if (layerProtocolName.includes("ethernet-container")) {
          const pac = layerProtocol["ethernet-container-2-0:ethernet-container-pac"] || {};

          pac["ethernet-container-historical-performances"] = await filterHistoricalList(
            pac["ethernet-container-historical-performances"] || [],
            relevantGranularities,
            meta.mostRecentPeriodEndTime,
            meta.mostRecentPeriodEndTime24,
            logger
          );

          layerProtocol["ethernet-container-2-0:ethernet-container-pac"] = pac;
        }
      }
    }

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