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
    deliveryState = "pending",
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
          deliveryState,
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

async function markKafkaPayloadForCleanup(request) {
  const { dataStoreEsClient, payloadRefId, failureReason, logger } = request;

  if (!dataStoreEsClient || !payloadRefId) {
    return;
  }

  const client = await getDataStoreClient(dataStoreEsClient, logger);
  await withRetry(
    async () => client.update({
      index: dataStoreEsClient["index-alias"],
      id: payloadRefId,
      body: {
        doc: {
          deliveryState: "permanent-failure",
          failureReason: String(failureReason || "NON_RETRYABLE_KAFKA_FAILURE"),
          failedAt: new Date().toJSON()
        }
      },
      refresh: false
    }),
    {
      label: `kafkaPayloadStore.markForCleanup:${payloadRefId}`,
      retryIntervalMs: 10000,
      logger
    }
  );
}

async function markKafkaPayloadAsOversizedEvidence(request) {
  const { dataStoreEsClient, payloadRefId, failureReason, logger } = request;

  if (!dataStoreEsClient || !payloadRefId) {
    return;
  }

  const client = await getDataStoreClient(dataStoreEsClient, logger);
  await withRetry(
    async () => client.update({
      index: dataStoreEsClient["index-alias"],
      id: payloadRefId,
      body: {
        doc: {
          deliveryState: "oversized-evidence",
          failureReason: String(failureReason || "KAFKA_MESSAGE_SIZE_TOO_LARGE"),
          failedAt: new Date().toJSON()
        }
      },
      refresh: false
    }),
    {
      label: `kafkaPayloadStore.markOversized:${payloadRefId}`,
      retryIntervalMs: 10000,
      logger
    }
  );
}

async function loadKafkaPayload(request) {
  const { dataStoreEsClient, payloadRefId, logger } = request;

  if (!dataStoreEsClient || !payloadRefId) {
    throw new Error("dataStoreEsClient and payloadRefId are mandatory");
  }

  const client = await getDataStoreClient(dataStoreEsClient, logger);

  let response;
  try {
    response = await withRetry(
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
  } catch (error) {
    const statusCode = Number(
      error?.statusCode || error?.meta?.statusCode || error?.meta?.body?.status
    );
    const notFound = statusCode === 404 ||
      error?.meta?.body?.found === false ||
      error?.body?.found === false;

    if (notFound) {
      const missingPayloadError = new Error(
        `Elasticsearch Kafka payload reference not found: ${payloadRefId}`
      );
      missingPayloadError.reason = "KAFKA_PAYLOAD_REFERENCE_NOT_FOUND";
      missingPayloadError.stage = "kafkaPayloadStore.load";
      missingPayloadError.payloadRefId = payloadRefId;
      missingPayloadError.retryable = false;
      throw missingPayloadError;
    }
    throw error;
  }

  const source = (response || {}).body?._source || {};
  if (!Object.prototype.hasOwnProperty.call(source, "payload")) {
    const missingPayloadError = new Error(
      `Elasticsearch Kafka payload content not found: ${payloadRefId}`
    );
    missingPayloadError.reason = "KAFKA_PAYLOAD_REFERENCE_NOT_FOUND";
    missingPayloadError.stage = "kafkaPayloadStore.load";
    missingPayloadError.payloadRefId = payloadRefId;
    missingPayloadError.retryable = false;
    throw missingPayloadError;
  }
  return source["payload"];
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
  markKafkaPayloadForCleanup,
  markKafkaPayloadAsOversizedEvidence,
  deleteKafkaPayload
};
