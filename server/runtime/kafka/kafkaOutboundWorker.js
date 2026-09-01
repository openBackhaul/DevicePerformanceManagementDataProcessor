const redisQueue = require("../../infra/redis/redisStreamQueue");
const kafkaPayloadStore = require("../../infra/elasticSearch/kafkaPayloadStore");
const p1TransmittingKafka = require("../../specificFunctions/p1StreamPmData/p1ProcessDevice/p1TransmittingKafka/P1TransmittingKafka");
const { sleep } = require("../../utils/retry");
const logger = require('../../service/LoggingService.js').getLogger();

function getMaxBatchMessages(context) {
    return Number(context.batchSize || global.KAFKA_OUTBOUND_BATCH_SIZE || 100);
}

function getMaxBatchBytes(context) {
    return Number(context.maxBatchBytes || global.KAFKA_OUTBOUND_MAX_BATCH_BYTES || 900 * 1024);
}

function getPayloadBytes(redisMessage) {
    const fields = redisMessage.message || {};

    const fromField = Number(fields.payloadBytes);
    if (Number.isFinite(fromField) && fromField > 0) {
        return fromField;
    }

    return Buffer.byteLength(fields.payload || "", "utf8");
}

function splitIntoSizedChunks(messages, context) {
    const maxMessages = getMaxBatchMessages(context);
    const maxBytes = getMaxBatchBytes(context);

    const chunks = [];
    let current = [];
    let currentBytes = 0;

    for (const msg of messages) {
        const msgBytes = getPayloadBytes(msg);

        if (
            current.length > 0 &&
            (current.length >= maxMessages || currentBytes + msgBytes > maxBytes)
        ) {
            chunks.push(current);
            current = [];
            currentBytes = 0;
        }

        current.push(msg);
        currentBytes += msgBytes;
    }

    if (current.length > 0) {
        chunks.push(current);
    }

    return chunks;
}

function parseRedisPayload(rawPayload) {
    if (!rawPayload) {
        return {};
    }

    try {
        return JSON.parse(rawPayload);
    } catch (error) {
        return {};
    }
}

async function buildOutputMessage(redisMessage, context) {
    const fields = redisMessage.message || {};

    let payload;

    if (fields.payloadStorage === "ES") {
        payload = await kafkaPayloadStore.loadKafkaPayload({
            dataStoreEsClient: context.dataStoreEsClient,
            payloadRefId: fields.payloadRefId,
            logger: logger
        });
    } else {
        payload = parseRedisPayload(fields.payload);
    }

    return {
        targetConsumer: fields.targetConsumer,
        messageType: fields.messageType,
        mountName: fields.mountName || null,
        correlationId: fields.correlationId || null,
        payloadVersion: fields.payloadVersion || "1.0",
        eventTime: fields.eventTime,
        payload
    };
}

async function ackAndDeleteRedisMessages(messages, context) {
    for (const msg of messages) {
        await redisQueue.ackKafkaOutbound(msg.id, logger);
        await redisQueue.deleteKafkaOutboundMessage(msg.id, logger);
    }
}

async function incrementMetricsForMessages(metric, messages, context) {
    const counts = new Map();
    for (const msg of messages || []) {
        const consumer = String((msg.message || {}).targetConsumer || "UNKNOWN").toUpperCase();
        counts.set(consumer, (counts.get(consumer) || 0) + 1);
    }
    for (const [consumer, count] of counts.entries()) {
        await redisQueue.updateKafkaDailyMetrics(metric, consumer, count, context.logger)
            .catch((error) => {
                context.logger?.error?.(
                    { metric, consumer, count, error: error.message || error },
                    "Failed to update Kafka daily Redis metric"
                );
            });
    }
}

async function deleteEsPayloadReferences(messages, context) {
    for (const msg of messages) {
        const fields = msg.message || {};

        if (fields.payloadStorage === "ES" && fields.payloadRefId) {
            await kafkaPayloadStore.deleteKafkaPayload({
                dataStoreEsClient: context.dataStoreEsClient,
                payloadRefId: fields.payloadRefId,
                logger: logger
            });
        }
    }
}

async function processKafkaOutboundChunk(messages, context) {
    const {p1TransmittingKafkaParameters, kafkaConnectionList} = context;
    if (!messages || messages.length === 0) {
        return;
    }

    const outputMessages = [];

    for (const msg of messages) {
        outputMessages.push(await buildOutputMessage(msg, context));
    }

    await p1TransmittingKafka.run({
        outputMessages,
        p1TransmittingKafkaParameters,
        kafkaConnectionList: kafkaConnectionList || [],
        logger: logger
    });

    await ackAndDeleteRedisMessages(messages, context);
    await deleteEsPayloadReferences(messages, context);
    await incrementMetricsForMessages("successful", messages, context);

    logger.info(
        {
            messageCount: messages.length,
            estimatedPayloadBytes: messages.reduce((sum, msg) => sum + getPayloadBytes(msg), 0)
        },
        "Kafka outbound chunk sent successfully"
    );
}

async function processKafkaOutboundMessages(messages, context) {
    const esBackedMessages = messages.filter(
        (message) => (message.message || {}).payloadStorage === "ES"
    );
    if (esBackedMessages.length > 0) {
        // Legacy queue references are no longer deliverable by design. Keep
        // any existing ES evidence document for maintenance and remove only
        // the Redis references. Missing ES documents are handled identically.
        await ackAndDeleteRedisMessages(esBackedMessages, context);
        await incrementMetricsForMessages("failed", esBackedMessages, context);
        logger.warn(
            { messageCount: esBackedMessages.length },
            "Removed legacy Elasticsearch-backed Kafka references from Redis without delivery"
        );
    }

    messages = messages.filter(
        (message) => (message.message || {}).payloadStorage !== "ES"
    );
    if (messages.length === 0) {
        return;
    }

    const chunks = splitIntoSizedChunks(messages, context);

    for (const chunk of chunks) {
        if (context.appState.isShuttingDown) {
            break;
        }

        await processKafkaOutboundChunk(chunk, context);
    }
}

function getKafkaFailureSleepMs(context) {
  return Number(context.kafkaFailureSleepMs || 10000);
}

function getWorkerIdleSleepMs(context) {
  return Number(context.workerIdleSleepMs || 1000);
}

function countStreamMessages(streams) {
  return (streams || []).reduce(
    (sum, stream) => sum + ((stream.messages || []).length),
    0
  );
}

async function sleepAfterKafkaFailure(context, error) {
  const sleepMs = getKafkaFailureSleepMs(context);

  logger.error(
    {
      label: "kafka-outbound-temporary-failure",
      retryAfterMs: sleepMs,
      error: error.message || error,
      code: error.code,
      type: error.type,
      name: error.name
    },
    "Kafka outbound send failed; Redis message kept for retry"
  );

  await sleep(sleepMs);
}

function isNonRetryableKafkaOutboundError(error) {
  return (
    error &&
    (
      error.retryable === false ||
      error.reason === "KAFKA_MESSAGE_SIZE_TOO_LARGE"
    )
  );
}

async function handleNonRetryableKafkaOutboundFailure(messages, context, source, error) {
  /*
   * Non-retryable Kafka errors should not stay forever in Redis pending state.
   * Example: KAFKA_MESSAGE_SIZE_TOO_LARGE.
   *
   * For now:
   * - log clearly
   * - preserve the complete message in the Kafka outbound dead-letter stream
   * - ACK and delete it from the active stream only after the copy succeeds
   * - do not delete any ES payload reference, so the payload remains inspectable
   */

  if (error.reason === "KAFKA_MESSAGE_SIZE_TOO_LARGE") {
    for (const msg of messages) {
      const fields = msg.message || {};
      const payload = parseRedisPayload(fields.payload);
      await kafkaPayloadStore.storeKafkaPayload({
        dataStoreEsClient: context.dataStoreEsClient,
        targetConsumer: fields.targetConsumer,
        mountName: fields.mountName,
        payload,
        payloadBytes: getPayloadBytes(msg),
        deliveryState: "oversized-evidence",
        logger
      });
    }
    await incrementMetricsForMessages("oversized", messages, context);
    await ackAndDeleteRedisMessages(messages, context);
    logger.warn(
      { source, messageCount: messages.length },
      "Legacy oversized Kafka messages stored as Elasticsearch evidence and removed from Redis"
    );
    return;
  }

  for (const msg of messages) {
    const fields = msg.message || {};

    logger.error(
      {
        label: "kafka-outbound-non-retryable-failure",
        source,
        redisMessageId: msg.id,
        mountName: fields.mountName,
        targetConsumer: fields.targetConsumer,
        payloadStorage: fields.payloadStorage,
        payloadRefId: fields.payloadRefId,
        payloadBytes: fields.payloadBytes,
        reason: error.reason,
        stage: error.stage,
        messageBytes: error.messageBytes,
        maxBytes: error.maxBytes,
        error: error.message || error
      },
      "Kafka outbound message moved out of retry flow because error is non-retryable"
    );

    await redisQueue.moveKafkaOutboundToDeadLetter(msg, error, logger);
    if (fields.payloadStorage === "ES" && fields.payloadRefId) {
      await kafkaPayloadStore.markKafkaPayloadForCleanup({
        dataStoreEsClient: context.dataStoreEsClient,
        payloadRefId: fields.payloadRefId,
        failureReason: error.reason || error.message,
        logger
      });
    }
  }
  await incrementMetricsForMessages("failed", messages, context);
}

async function tryProcessKafkaOutboundMessages(messages, context, source) {
  if (!messages || messages.length === 0) {
    return true;
  }

  try {
    await processKafkaOutboundMessages(messages, context);
    return true;
   } catch (error) {
    /*
     * Non-retryable errors must not stay forever in Redis.
     * Example:
     * - KAFKA_MESSAGE_SIZE_TOO_LARGE
     */
    if (isNonRetryableKafkaOutboundError(error)) {
      await handleNonRetryableKafkaOutboundFailure(
        messages,
        context,
        source,
        error
      );

      return false;
    }

    /*
     * Retryable Kafka/infra failure:
     * Do not ACK.
     * Do not DELETE.
     * Message remains pending and will be reclaimed/retried.
     */
    context.lastKafkaFailureAt = Date.now();

    logger.error(
      {
        source,
        messageCount: messages.length,
        error: error.message || error,
        code: error.code,
        type: error.type,
        name: error.name
      },
      "Kafka outbound batch failed; messages remain in Redis"
    );

    await sleepAfterKafkaFailure(context, error);
    return false;
  }
}

async function kafkaOutboundWorkerLoop(context, consumerName) {
  await redisQueue.ensureKafkaOutboundGroup(context.logger);

  logger.info(
    {
      consumerName,
      readCount: context.readCount || 100,
      batchSize: context.batchSize || 100,
      maxBatchBytes: context.maxBatchBytes,
      staleMessageIdleMs: context.staleMessageIdleMs || 60000,
      kafkaFailureSleepMs: getKafkaFailureSleepMs(context)
    },
    "Kafka outbound worker started"
  );

  while (!context.appState.isShuttingDown) {
    try {
      const reclaimed = await redisQueue.reclaimStaleKafkaOutbound(
        consumerName,
        context.staleMessageIdleMs || 60000,
        context.logger
      );

      if (reclaimed.length > 0) {
        const success = await tryProcessKafkaOutboundMessages(
          reclaimed,
          context,
          "reclaimed"
        );

        if (!success) {
          continue;
        }
      }

      const streams = await redisQueue.readNextKafkaOutbound(
        consumerName,
        5000,
        context.readCount || 100,
        context.logger
      );

      let batch = [];

      for (const stream of streams) {
        batch = batch.concat(stream.messages || []);
      }

      if (batch.length > 0) {
        await tryProcessKafkaOutboundMessages(batch, context, "new");
      } else {
        await sleep(getWorkerIdleSleepMs(context));
      }

      logger.debug &&
        logger.debug(
          {
            consumerName,
            streamCount: streams.length,
            messageCount: countStreamMessages(streams)
          },
          "Kafka outbound worker poll completed"
        );
    } catch (error) {
      /*
       * This catch protects the worker loop itself.
       * Redis/Kafka/ES temporary errors must not kill the worker pool.
       */
      logger.error(
        {
          consumerName,
          error: error.message || error,
          code: error.code,
          type: error.type,
          name: error.name
        },
        "Kafka outbound worker loop error; worker will continue"
      );

      await sleep(getKafkaFailureSleepMs(context));
    }
  }

  logger.warn(
    {
      consumerName
    },
    "Kafka outbound worker stopped"
  );
}

async function startKafkaOutboundWorkerPool(context) {
    const workers = [];
    const workerCount = context.workerCount || 1;
    await redisQueue.resetKafkaDailyMetricsIfNeeded(context.logger);
    const dailyMetricsResetTimer = setInterval(() => {
        redisQueue.resetKafkaDailyMetricsIfNeeded(context.logger).catch((error) => {
            context.logger?.error?.(
                { error: error.message || error },
                "Failed to refresh Kafka daily Redis metrics date"
            );
        });
    }, 30000);

    for (let i = 0; i < workerCount; i += 1) {
        const consumerName = `${context.instanceId}-kafka-outbound-${i + 1}`;
        workers.push(kafkaOutboundWorkerLoop(context, consumerName));
    }

    try {
        await Promise.all(workers);
    } finally {
        clearInterval(dailyMetricsResetTimer);
    }
}

module.exports = {
    startKafkaOutboundWorkerPool,
    /* _internal: {
        processKafkaOutboundMessages
    } */
};
