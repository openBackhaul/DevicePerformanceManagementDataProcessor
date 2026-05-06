const onfAdapter = require("../../../../infra/onf/onfAdapter");
const { getParamFromFunction } = require("../../../../utils/functionTree");
const { withRetry } = require("../../../../utils/retry");
const p1FieldsFilter = require("./../../../../genericFunctions/p1FieldsFilter/P1FieldsFilter");
const p1DiscardIrrelevantPmRecords = require("./../../../../genericFunctions/p1DiscardIrrelevantPmRecords/P1DiscardIrrelevantPmRecords");

async function loadInterfaceMetadataList(
  dataStoreClient,
  dataStoreIndex,
  mountName,
  logger
) {
  const response = await withRetry(
    async () =>
      /* dataStoreClient.search({
        index: dataStoreIndex,
        size: 1,
        body: {
          query: {
            bool: {
              should: [
                { term: { "mountName.keyword": mountName } },
                { term: { "mount-name.keyword": mountName } }
              ],
              minimum_should_match: 1
            }
          }
        }
      }), */
      dataStoreClient.get({
        //size: 1,
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

async function filterHistoricalList(
  list,
  relevantGranularities,
  mostRecentPeriodEndTime,
  mostRecentPeriodEndTime24
) {
  const response = await p1DiscardIrrelevantPmRecords.run({
    historicalPerformanceDataList: list,
    relevantGranularities,
    mostRecentPeriodEndTime,
    mostRecentPeriodEndTime24
  });

  return response.filteredHistoricalPerformanceDataList;
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
    logger
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
        /* replicaClient.search({
          index: mwdiReplicaEsClient["index-alias"],
          size: 1,
          body: {
            query: {
              bool: {
                should: [
                  { term: { "mountName.keyword": mountName } },
                  { term: { "mount-name.keyword": mountName } },
                  { term: { "uuid.keyword": mountName } }
                ],
                minimum_should_match: 1
              }
            }
          }
        }), */
        replicaClient.get({
          //size: 1,
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
            meta.mostRecentPeriodEndTime24
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
            meta.mostRecentPeriodEndTime24
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