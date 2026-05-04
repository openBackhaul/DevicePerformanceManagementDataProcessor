const redisQueue = require("../../infra/redis/redisStreamQueue");
const kafkaPayloadStore = require("../../infra/elasticSearch/kafkaPayloadStore");
const p1TransmittingKafka = require("../../specificFunctions/p1StreamPmData/p1ProcessDevice/p1TransmittingKafka/P1TransmittingKafka");
const { sleep } = require("../../utils/retry");

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
            logger: context.logger
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
        await redisQueue.ackKafkaOutbound(msg.id, context.logger);
        await redisQueue.deleteKafkaOutboundMessage(msg.id, context.logger);
    }
}

async function deleteEsPayloadReferences(messages, context) {
    for (const msg of messages) {
        const fields = msg.message || {};

        if (fields.payloadStorage === "ES" && fields.payloadRefId) {
            await kafkaPayloadStore.deleteKafkaPayload({
                dataStoreEsClient: context.dataStoreEsClient,
                payloadRefId: fields.payloadRefId,
                logger: context.logger
            });
        }
    }
}

async function processKafkaOutboundChunk(messages, context) {
    if (!messages || messages.length === 0) {
        return;
    }

    const outputMessages = [];

    for (const msg of messages) {
        outputMessages.push(await buildOutputMessage(msg, context));
    }

    await p1TransmittingKafka.run({
        outputMessages,
        logger: context.logger
    });

    await ackAndDeleteRedisMessages(messages, context);
    await deleteEsPayloadReferences(messages, context);

    context.logger.info(
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

async function kafkaOutboundWorkerLoop(context, consumerName) {
    await redisQueue.ensureKafkaOutboundGroup(context.logger);

    while (!context.appState.isShuttingDown) {
        const reclaimed = await redisQueue.reclaimStaleKafkaOutbound(
            consumerName,
            context.staleMessageIdleMs || 60000,
            context.logger
        );

        if (reclaimed.length > 0) {
            await processKafkaOutboundMessages(reclaimed, context);
            continue;
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
            await processKafkaOutboundMessages(batch, context);
        } else {
            await sleep(1000);
        }
    }
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