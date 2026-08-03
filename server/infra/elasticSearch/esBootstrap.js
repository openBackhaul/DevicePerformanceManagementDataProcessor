const onfAdapter = require("../onf/onfAdapter");
const { withRetry } = require("../../utils/retry");

async function ensureIndex(client, indexName, mappingBody, logger) {
  const exists = await withRetry(
    async () => client.indices.exists({ index: indexName }),
    { label: `indices.exists:${indexName}`, retryIntervalMs: 10000, logger }
  ).catch((error) => {
      logger.error(
        {
          label: "indices.exists",
          error: error.message || error
        },
        `Failed to check if index ${indexName} exists in Elasticsearch`
      );
    });

  if (exists?.body) {
    return { created: false };
  }

  await withRetry(
    async () =>
      client.indices.create({
        index: indexName,
        body: mappingBody
      }),
    { label: `indices.create:${indexName}`, retryIntervalMs: 10000, logger }
  ).catch((error) => {
      logger.error(
        {
          label: "indices.create",
          error: error.message || error
        },
        `Failed to create index ${indexName} in Elasticsearch`
      );
    });

  return { created: true };
}

async function ensureIndicesAndMappings(esClients, logger, options = {}) {
  const ensureReplicaIndex = options.ensureReplicaIndex !== false;
  const replicaClient = ensureReplicaIndex
    ? await onfAdapter.getEsClient(
      false,
      esClients.mwdiReplicaEsClient.uuid,
      esClients.mwdiReplicaEsClient,
      logger
    )
    : null;

  const loggingClient = await onfAdapter.getEsClient(
    false,
    esClients.loggingEsClient.uuid,
    esClients.loggingEsClient,
    logger
  );

  const dataStoreClient = await onfAdapter.getEsClient(
    false,
    esClients.dataStoreEsClient.uuid,
    esClients.dataStoreEsClient,
    logger
  );

  if (ensureReplicaIndex) {
    await ensureIndex(
      replicaClient,
      esClients.mwdiReplicaEsClient["index-alias"],
      {
      mappings: {
        properties: {
          "core-model-1-4:control-construct": { type: "flattened" },
          "last-complete-control-construct-update-time": { type: "date" },
          "operation-name": { type: "text" },
          originator: { type: "text" },
          "release-number": { type: "text" },
          "response-code": { type: "integer" },
          "stringified-body": { type: "text" },
          "stringified-response": { type: "text" },
          timestamp: { type: "date"},
          "trace-indicator": { type: "text" },
          user : { type: "text"},
          "x-correlator": { type: "keyword"}
        }
      }
    },
      logger
    );
  }

  await ensureIndex(
    loggingClient,
    esClients.loggingEsClient["index-alias"],
    {
      mappings: {
        properties: {
          jobName: { type: "text" },
          periodEndTime: { type: "date" },
          periodStartTime: { type: "date" },
          timestamp: { type: "date" },
          replicated: { type: "long" },
          updatedMountNames: { type: "text" },
          status: { type: "text" },
          total: { type: "long" },
          updated: { type: "long" },
          error: { type: "text" },
        }
      }
    },
    logger
  );

  await ensureIndex(
    dataStoreClient,
    esClients.dataStoreEsClient["index-alias"],
    {
      mappings: {
        properties: {
          mountName: { type: "keyword" },
          "mount-name": { type: "keyword" },
          locked: { type: "boolean" },
          timestamp: { type: "date" },
          batch: {
            type: "nested",
            properties: {
              batchTimestamp: { type: "date" }
            }
          },
          "interface-metadata-list": {
            type: "nested",
            properties: {
              uuid: { type: "keyword" },
              mostRecentPeriodEndTime: { type: "date" },
              mostRecentPeriodEndTime24: { type: "date" }
            }
          }
        }
      }
    },
    logger
  );
}

module.exports = {
  ensureIndicesAndMappings
};
