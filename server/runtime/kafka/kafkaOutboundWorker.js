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
    const {p1TransmittingKafkaParameters} = context;
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
        logger: logger
    });

    await ackAndDeleteRedisMessages(messages, context);
    await deleteEsPayloadReferences(messages, context);

    logger.info(
        {
            messageCount: messages.length,
            estimatedPayloadBytes: messages.reduce((sum, msg) => sum + getPayloadBytes(msg), 0)
        },
        "Kafka outbound chunk sent successfully"
    );
}

async function processKafkaOutboundMessages(messages, context) {
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

async function tryProcessKafkaOutboundMessages(messages, context, source) {
  if (!messages || messages.length === 0) {
    return true;
  }

  try {
    await processKafkaOutboundMessages(messages, context);
    return true;
  } catch (error) {
    /*
     * Important:
     * processKafkaOutboundChunk only ACKs/deletes Redis messages after Kafka send succeeds.
     * If Kafka send fails, the exception happens before ACK/delete.
     * Therefore the Redis messages remain pending and can be reclaimed/retried.
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

    for (let i = 0; i < workerCount; i += 1) {
        const consumerName = `${context.instanceId}-kafka-outbound-${i + 1}`;
        workers.push(kafkaOutboundWorkerLoop(context, consumerName));
    }

    await Promise.all(workers);
}

module.exports = {
    startKafkaOutboundWorkerPool
};