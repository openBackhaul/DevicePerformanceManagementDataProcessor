const crypto = require("crypto");
const onfAdapter = require("../onf/onfAdapter");
const { withRetry } = require("../../utils/retry");

function buildPayloadDocId(mountName, targetConsumer) {
  const safeMountName = String(mountName || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeConsumer = String(targetConsumer || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");

  return `kafka-payload-${safeConsumer}-${safeMountName}-${Date.now()}-${crypto.randomUUID()}`;
}

async function getDataStoreClient(dataStoreEsClient, logger) {
  return await onfAdapter.getEsClient(
    false,
    dataStoreEsClient.uuid,
    dataStoreEsClient,
    logger
  );
}

async function storeKafkaPayload(request) {
  const {
    dataStoreEsClient,
    targetConsumer,
    mountName,
    payload,
    payloadBytes,
    logger
  } = request;

  if (!dataStoreEsClient) {
    throw new Error("dataStoreEsClient is mandatory for large Kafka payload storage");
  }

  const client = await getDataStoreClient(dataStoreEsClient, logger);
  const id = buildPayloadDocId(mountName, targetConsumer);

  await withRetry(
    async () =>
      client.index({
        index: dataStoreEsClient["index-alias"],
        id,
        body: {
          docType: "kafka-outbound-payload",
          targetConsumer,
          mountName,
          payload,
          payloadBytes,
          createdAt: new Date().toJSON()
        },
        refresh: false
      }),
    {
      label: `kafkaPayloadStore.store:${id}`,
      retryIntervalMs: 10000,
      logger
    }
  );

  return id;
}

async function loadKafkaPayload(request) {
  const { dataStoreEsClient, payloadRefId, logger } = request;

  if (!dataStoreEsClient || !payloadRefId) {
    throw new Error("dataStoreEsClient and payloadRefId are mandatory");
  }

  const client = await getDataStoreClient(dataStoreEsClient, logger);

  const response = await withRetry(
    async () =>
      client.get({
        index: dataStoreEsClient["index-alias"],
        id: payloadRefId
      }),
    {
      label: `kafkaPayloadStore.load:${payloadRefId}`,
      retryIntervalMs: 10000,
      logger
    }
  );

  const source = (response || {}).body?._source || {};
  return source["payload"] || null;
}

async function deleteKafkaPayload(request) {
  const { dataStoreEsClient, payloadRefId, logger } = request;

  if (!dataStoreEsClient || !payloadRefId) {
    return;
  }

  const client = await getDataStoreClient(dataStoreEsClient, logger);

  await client
    .delete({
      index: dataStoreEsClient["index-alias"],
      id: payloadRefId,
      refresh: false
    })
    .catch((error) => {
      logger.warn(
        {
          payloadRefId,
          error: error.message || error
        },
        "Failed to delete Kafka payload reference document"
      );
    });
}

module.exports = {
  storeKafkaPayload,
  loadKafkaPayload,
  deleteKafkaPayload
};