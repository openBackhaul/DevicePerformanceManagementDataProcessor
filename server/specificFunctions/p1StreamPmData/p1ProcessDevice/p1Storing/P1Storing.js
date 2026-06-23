const onfAdapter = require("../../../../infra/onf/onfAdapter");
const { withRetry } = require("../../../../utils/retry");

async function searchExisting(client, index, mountName, logger) {
  const response = await withRetry(
    async () =>
      /* client.search({
        index,
        size: 1,
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
      }), */
      client.get({
        index,
        //size: 1,
        id: mountName
      }),
    {
      label: `p1Storing.searchExisting:${mountName}`,
      retryIntervalMs: 10000,
      logger
    }
  ).catch((error) => {
      /* logger.error(
        {
          label: "search-existing-device",
          error: error.message || error
        },
        "Failed to search existing device"
      ); */
    });

  return (response || {}).body?._source || {};
}

/**
 * Request:
 * {
 *   dataStoreEsClient,
 *   resultCc,
 *   interfaceMetadataList
 * }
 *
 * Response:
 * {
 *   mountName,
 *   batch
 * }
 */
async function run(request) {
  const { dataStoreEsClient, resultCc, interfaceMetadataList, mountName, logger } = request;

  if (!dataStoreEsClient || !resultCc || !Array.isArray(interfaceMetadataList)) {
    throw new Error(
      "dataStoreEsClient, resultCc and interfaceMetadataList are mandatory"
    );
  }

  const client = await onfAdapter.getEsClient(
    false,
    dataStoreEsClient.uuid,
    dataStoreEsClient,
    logger
  );

  const index = dataStoreEsClient["index-alias"];
  const saveResultCc = true; // Set to true if you want to save the entire resultCc in the batch; can cause large documents in ES
  /* const mountName =
    resultCc.mountName || resultCc["mount-name"] || resultCc.uuid || "unknown"; */

  const existing = await searchExisting(client, index, mountName, logger);

  const lockTimestamp = new Date().toJSON();
  existing.mountName = mountName;
  existing.timestamp = lockTimestamp;
  existing.locked = true;

  await withRetry(
    async () =>
      client.index({
        index,
        id: mountName,
        body: existing,
        refresh: false
      }),
    {
      label: `p1Storing.lock:${mountName}`,
      retryIntervalMs: 10000,
      logger
    }
  ).catch((error) => {
      logger.error(
        {
          label: "lock-device-for-storing",
          error: error.message || error
        },
        "Failed to lock device for storing"
      );
    });

  existing["interface-metadata-list"] = interfaceMetadataList;
  existing.batch = Array.isArray(existing.batch) ? existing.batch : [];
  const batchTimestamp = new Date().toJSON();
  existing.batch.push({
    batchTimestamp,
    ...(saveResultCc ? { resultCc } : {})
  });

  existing.timestamp = batchTimestamp;
  existing.locked = false;

  await withRetry(
    async () =>
      client.index({
        index,
        id: mountName,
        body: existing,
        refresh: false
      }),
    {
      label: `p1Storing.save:${mountName}`,
      retryIntervalMs: 10000,
      logger
    }
  ).catch((error) => {
      logger.error(
        {
          label: "save-device-for-storing",
          error: error.message || error
        },
        "Failed to save device for storing"
      );
    });

  return {
    mountName,
    batch: existing.batch
  };
}

module.exports = { run };
