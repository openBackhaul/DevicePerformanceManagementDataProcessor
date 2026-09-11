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
    const acknowledgementResults = await Promise.all(messages.map(async (msg) => {
        const ackCount = await redisQueue.ackKafkaOutbound(
            msg.id,
            context.consumerName,
            logger
        );
        if (ackCount === 1) {
            await redisQueue.deleteKafkaOutboundMessage(msg.id, logger);
            return msg;
        } else {
            logger.warn(
                { redisMessageId: msg.id },
                "Kafka delivery completed after Redis ownership was lost; ES payload retained"
            );
        }
        return null;
    }));
    return acknowledgementResults.filter(Boolean);
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
    await Promise.all(messages.map(async (msg) => {
        const fields = msg.message || {};

        if (fields.payloadStorage === "ES" && fields.payloadRefId) {
            await kafkaPayloadStore.deleteKafkaPayload({
                dataStoreEsClient: context.dataStoreEsClient,
                payloadRefId: fields.payloadRefId,
                logger: logger
            });
        }
    }));
}

async function processKafkaOutboundChunk(messages, context) {
    const {p1TransmittingKafkaParameters, kafkaConnectionList} = context;
    if (!messages || messages.length === 0) {
        return;
    }

    // The Redis read count bounds this fan-out (10 by default). Loading the
    // independent ES payload documents concurrently avoids one network round
    // trip per message becoming the Kafka throughput bottleneck.
    const outputMessages = await Promise.all(
        messages.map((msg) => buildOutputMessage(msg, context))
    );

    await p1TransmittingKafka.run({
        outputMessages,
        p1TransmittingKafkaParameters,
        kafkaConnectionList: kafkaConnectionList || [],
        logger: logger
    });

    // Delivery has already succeeded. Only entries still owned by this worker
    // may be deleted from Redis and Elasticsearch. Success evidence remains
    // best-effort: a metrics outage must not resend an acknowledged message.
    const acknowledgedMessages = await ackAndDeleteRedisMessages(messages, context);

    // Reset the daily counters/evidence streams before recording today's
    // successful entries. This keeps both views on the same Berlin date.
    await redisQueue.resetKafkaDailyMetricsIfNeeded(context.logger);
    await redisQueue.recordKafkaOutboundSuccess(acknowledgedMessages, logger)
        .catch((error) => {
            logger.error(
                { error: error.message || error, messageCount: messages.length },
                "Kafka delivery succeeded but success metadata could not be recorded"
            );
        });

    await deleteEsPayloadReferences(acknowledgedMessages, context);
    await incrementMetricsForMessages("successful", acknowledgedMessages, context);

    logger.info(
        {
            messageCount: messages.length,
            estimatedPayloadBytes: messages.reduce((sum, msg) => sum + getPayloadBytes(msg), 0)
        },
        "Kafka outbound chunk sent successfully"
    );
}

async function processKafkaOutboundChunkWithSizeIsolation(messages, context) {
    try {
        await processKafkaOutboundChunk(messages, context);
        return;
    } catch (error) {
        const isolatableNonRetryableError =
            error?.reason === "KAFKA_MESSAGE_SIZE_TOO_LARGE" ||
            error?.reason === "KAFKA_PAYLOAD_REFERENCE_NOT_FOUND";
        if (!isolatableNonRetryableError) {
            throw error;
        }

        if (messages.length === 1) {
            await handleNonRetryableKafkaOutboundFailure(
                messages,
                context,
                "kafka-size-isolation",
                error
            );
            return;
        }

        const midpoint = Math.ceil(messages.length / 2);
        const firstHalf = messages.slice(0, midpoint);
        const secondHalf = messages.slice(midpoint);

        logger.warn(
            {
                rejectedBatchSize: messages.length,
                firstRetrySize: firstHalf.length,
                secondRetrySize: secondHalf.length
            },
            "Kafka batch was rejected for size; splitting it to isolate the exact message"
        );

        await processKafkaOutboundChunkWithSizeIsolation(firstHalf, context);
        await processKafkaOutboundChunkWithSizeIsolation(secondHalf, context);
    }
}

async function processKafkaOutboundMessages(messages, context) {
    if (messages.length === 0) {
        return;
    }

    // A transmitting call must contain only one target consumer/topic. If a
    // later topic failed after an earlier topic succeeded, retrying the whole
    // call could otherwise duplicate the already-delivered topic.
    const messagesByConsumer = new Map();
    for (const message of messages) {
        const consumer = String(
            (message.message || {}).targetConsumer || "UNKNOWN"
        ).toUpperCase();
        if (!messagesByConsumer.has(consumer)) {
            messagesByConsumer.set(consumer, []);
        }
        messagesByConsumer.get(consumer).push(message);
    }

    for (const consumerMessages of messagesByConsumer.values()) {
        const chunks = splitIntoSizedChunks(consumerMessages, context);

        for (const chunk of chunks) {
            if (context.appState.isShuttingDown) {
                return;
            }

            await processKafkaOutboundChunkWithSizeIsolation(chunk, context);
        }
    }
}

function getKafkaFailureSleepMs(context) {
  return Number(context.kafkaFailureSleepMs || 10000);
}

function getWorkerIdleSleepMs(context) {
  return Number(context.workerIdleSleepMs || 1000);
}

function getHeartbeatIntervalMs(context) {
  const staleMessageIdleMs = Number(context.staleMessageIdleMs || 300000);
  return Number(
    context.heartbeatIntervalMs ||
    Math.max(5000, Math.floor(staleMessageIdleMs / 3))
  );
}

async function processWithOwnershipHeartbeat(messages, context, source) {
  const messageIds = (messages || []).map((message) => message.id);
  const initiallyOwnedIds = await redisQueue.renewKafkaOutboundOwnership(
    messageIds,
    context.consumerName,
    context.logger
  );
  const initiallyOwned = new Set(initiallyOwnedIds.map(String));
  const ownedMessages = (messages || []).filter(
    (message) => initiallyOwned.has(String(message.id))
  );

  if (ownedMessages.length === 0) {
    return true;
  }

  let heartbeatPromise = null;
  const heartbeat = () => {
    if (heartbeatPromise) {
      return;
    }
    heartbeatPromise = redisQueue.renewKafkaOutboundOwnership(
      ownedMessages.map((message) => message.id),
      context.consumerName,
      context.logger
    ).catch((error) => {
      context.logger?.error?.(
        { consumerName: context.consumerName, error: error.message || error },
        "Failed to renew Kafka outbound Redis ownership"
      );
    }).finally(() => {
      heartbeatPromise = null;
    });
  };

  const timer = setInterval(heartbeat, getHeartbeatIntervalMs(context));
  try {
    return await tryProcessKafkaOutboundMessages(ownedMessages, context, source);
  } finally {
    clearInterval(timer);
    if (heartbeatPromise) {
      await heartbeatPromise;
    }
  }
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
   * Preserve the complete oversized payload in Elasticsearch, write compact
   * failure metadata to the Redis dead-letter stream, then ACK/delete the
   * active Redis entry.
   */

  if (error.reason === "KAFKA_MESSAGE_SIZE_TOO_LARGE") {
    const movedMessages = [];
    for (const msg of messages) {
      const fields = msg.message || {};
      const legacyRedisPayload = fields.payloadStorage !== "ES"
        ? parseRedisPayload(fields.payload)
        : null;
      const moved = await redisQueue.moveKafkaOutboundToDeadLetter(
        msg, error, "oversized", context.consumerName, logger
      );
      if (moved !== 1) {
        continue;
      }
      movedMessages.push(msg);

      if (fields.payloadStorage === "ES" && fields.payloadRefId) {
        await kafkaPayloadStore.markKafkaPayloadAsOversizedEvidence({
          dataStoreEsClient: context.dataStoreEsClient,
          payloadRefId: fields.payloadRefId,
          failureReason: error.reason,
          logger
        });
      } else {
        await kafkaPayloadStore.storeKafkaPayload({
          dataStoreEsClient: context.dataStoreEsClient,
          targetConsumer: fields.targetConsumer,
          mountName: fields.mountName,
          payload: legacyRedisPayload,
          payloadBytes: getPayloadBytes(msg),
          deliveryState: "oversized-evidence",
          logger
        });
      }
    }
    logger.warn(
      { source, messageCount: movedMessages.length },
      "Oversized Kafka messages stored as Elasticsearch evidence and moved to metadata-only dead letter"
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

    const moved = await redisQueue.moveKafkaOutboundToDeadLetter(
      msg, error, "failed", context.consumerName, logger
    );
    if (moved !== 1) {
      continue;
    }
    if (
      error.reason !== "KAFKA_PAYLOAD_REFERENCE_NOT_FOUND" &&
      fields.payloadStorage === "ES" &&
      fields.payloadRefId
    ) {
      await kafkaPayloadStore.markKafkaPayloadForCleanup({
        dataStoreEsClient: context.dataStoreEsClient,
        payloadRefId: fields.payloadRefId,
        failureReason: error.reason || error.message,
        logger
      });
    }
  }
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
      readCount: context.readCount || 10,
      batchSize: context.batchSize || 100,
      maxBatchBytes: context.maxBatchBytes,
      staleMessageIdleMs: context.staleMessageIdleMs || 300000,
      kafkaFailureSleepMs: getKafkaFailureSleepMs(context)
    },
    "Kafka outbound worker started"
  );

  while (!context.appState.isShuttingDown) {
    try {
      const workerContext = { ...context, consumerName };
      const reclaimed = await redisQueue.reclaimStaleKafkaOutbound(
        consumerName,
        context.staleMessageIdleMs || 300000,
        context.readCount || 10,
        context.logger
      );

      if (reclaimed.length > 0) {
        const success = await processWithOwnershipHeartbeat(
          reclaimed,
          workerContext,
          "reclaimed"
        );

        if (!success) {
          continue;
        }
      }

      const streams = await redisQueue.readNextKafkaOutbound(
        consumerName,
        5000,
        context.readCount || 10,
        context.logger
      );

      let batch = [];

      for (const stream of streams) {
        batch = batch.concat(stream.messages || []);
      }

      if (batch.length > 0) {
        await processWithOwnershipHeartbeat(batch, workerContext, "new");
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
    // Exposed only for focused unit testing; production code uses the worker
    // pool entry point above.
    _internal: {
        processKafkaOutboundMessages,
        processKafkaOutboundChunkWithSizeIsolation,
        handleNonRetryableKafkaOutboundFailure
    }
};
