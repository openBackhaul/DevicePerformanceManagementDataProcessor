const { getRedisClient } = require("./redisClient");

const DEVICE_STREAM = "dpmdp:stream:device-processing";
const DEVICE_GROUP = "dpmdp:group:device-processing";
const DEVICE_DEDUP_SET = "dpmdp:set:device-processing";
const RETRY_STREAM = "dpmdp:stream:retry";
const RETRY_GROUP = "dpmdp:group:retry";
const KAFKA_OUTBOUND_STREAM = "dpmdp:stream:kafka-outbound";
const KAFKA_OUTBOUND_GROUP = "dpmdp:group:kafka-outbound";

async function ensureGroup(logger) {
    const redis = await getRedisClient(logger);

    try {
        await redis.xGroupCreate(DEVICE_STREAM, DEVICE_GROUP, "0", { MKSTREAM: true });
    } catch (error) {
        if (!String(error.message || error).includes("BUSYGROUP")) {
            throw error;
        }
    }
}

/*async function enqueueMountNames(mountNames, logger) {
    const redis = await getRedisClient(logger);

    for (const mountName of mountNames || []) {
        await redis.xAdd(DEVICE_STREAM, "*", {
            mountName,
            createdAt: new Date().toISOString()
        });
    }
}*/

async function readNext(consumerName, blockMs, count, logger) {
    const redis = await getRedisClient(logger);

    return (
        await redis.xReadGroup(
            DEVICE_GROUP,
            consumerName,
            { key: DEVICE_STREAM, id: ">" },
            { COUNT: count || 10, BLOCK: blockMs || 5000 }
        )
    ) || [];
}

async function ackMessage(messageId, logger) {
    const redis = await getRedisClient(logger);
    await redis.xAck(DEVICE_STREAM, DEVICE_GROUP, messageId);
}

async function reclaimStale(consumerName, minIdleMs, logger) {
    const redis = await getRedisClient(logger);
    const response = await redis.xAutoClaim(
        DEVICE_STREAM,
        DEVICE_GROUP,
        consumerName,
        minIdleMs,
        "0-0",
        { COUNT: 10 }
    );
    return response ? response.messages || [] : [];
}

async function enqueueRetry(mountName, stage, lastError, logger) {
    const redis = await getRedisClient(logger);

    await redis.xAdd(RETRY_STREAM, "*", {
        mountName,
        stage: stage || "unknown",
        lastError: lastError || "",
        createdAt: new Date().toJSON()
    });
}

async function ensureRetryGroup(logger) {
  const redis = await getRedisClient(logger);

  try {
    await redis.xGroupCreate(RETRY_STREAM, RETRY_GROUP, "0", {
      MKSTREAM: true
    });
  } catch (error) {
    if (!String(error.message || error).includes("BUSYGROUP")) {
      throw error;
    }
  }
}

async function readNextRetry(consumerName, blockMs, count, logger) {
  const redis = await getRedisClient(logger);

  const response = await redis.xReadGroup(
    RETRY_GROUP,
    consumerName,
    { key: RETRY_STREAM, id: ">" },
    {
      COUNT: count || 10,
      BLOCK: blockMs || 5000
    }
  );

  return response || [];
}

async function ackRetryMessage(messageId, logger) {
  const redis = await getRedisClient(logger);
  await redis.xAck(RETRY_STREAM, RETRY_GROUP, messageId);
}

async function deleteRetryMessage(messageId, logger) {
  const redis = await getRedisClient(logger);
  await redis.xDel(RETRY_STREAM, messageId);
}

async function reclaimStaleRetry(consumerName, minIdleMs, logger) {
  const redis = await getRedisClient(logger);

  const response = await redis.xAutoClaim(
    RETRY_STREAM,
    RETRY_GROUP,
    consumerName,
    minIdleMs,
    "0-0",
    {
      COUNT: 10
    }
  );

  return response ? response.messages || [] : [];
}

async function getQueueLength(logger) {
    const redis = await getRedisClient(logger);
    return Number(await redis.xLen(DEVICE_STREAM).catch(() => 0));
}

async function enqueueMountNames(mountNames, options, logger) {
  const redis = await getRedisClient(logger);
  const batchSize = (options || {}).batchSize || 500;
  const pauseMs = (options || {}).pauseMs || 50;

  for (let i = 0; i < (mountNames || []).length; i += batchSize) {
    const batch = mountNames.slice(i, i + batchSize);

    for (const mountName of batch) {
      try {
        // SETNX-like behavior using SADD
        const isNew = await redis.sAdd(DEVICE_DEDUP_SET, mountName);

        // sAdd returns 1 if added, 0 if already exists
        if (isNew === 1) {
          await redis.xAdd(DEVICE_STREAM, "*", {
            mountName,
            createdAt: new Date().toISOString()
          });
        } else {
          // Already in queue → skip
          logger && logger.debug && logger.debug(
            { mountName },
            "Skipped duplicate mountName enqueue"
          );
        }
      } catch (error) {
        logger && logger.error(
          { mountName, error },
          "Failed to enqueue mountName"
        );
      }
    }

    if (pauseMs > 0 && i + batchSize < mountNames.length) {
      await sleep(pauseMs);
    }
  }
}

/*Redis queue functions for Kafka outbound messages*/

async function ensureKafkaOutboundGroup(logger) {
  const redis = await getRedisClient(logger);

  try {
    await redis.xGroupCreate(KAFKA_OUTBOUND_STREAM, KAFKA_OUTBOUND_GROUP, "0", {
      MKSTREAM: true
    });
  } catch (error) {
    /* logger && logger.error(
      { error },
      "Error ensuring Kafka outbound consumer group"
    ); */
    if (!String(error.message || error).includes("BUSYGROUP")) {
      throw error;
    }
  }
}

async function enqueueKafkaOutbound(outputMessage, logger) {
  const redis = await getRedisClient(logger);

  await redis.xAdd(KAFKA_OUTBOUND_STREAM, "*", {
    targetConsumer: String(outputMessage.targetConsumer || "").toUpperCase(),
    messageType: outputMessage.messageType || "PERFORMANCE_OUTPUT",
    mountName: outputMessage.mountName || "",
    correlationId: outputMessage.correlationId || "",
    payloadVersion: outputMessage.payloadVersion || "1.0",
    eventTime: outputMessage.eventTime || new Date().toISOString(),

    payloadStorage: outputMessage.payloadStorage || "REDIS",
    payload: outputMessage.payload || "",
    payloadRefId: outputMessage.payloadRefId || "",
    payloadBytes: String(outputMessage.payloadBytes || 0)
  });
}

async function readNextKafkaOutbound(consumerName, blockMs, count, logger) {
  const redis = await getRedisClient(logger);

  const response = await redis.xReadGroup(
    KAFKA_OUTBOUND_GROUP,
    consumerName,
    { key: KAFKA_OUTBOUND_STREAM, id: ">" },
    {
      COUNT: count || 100,
      BLOCK: blockMs || 5000
    }
  );

  return response || [];
}

async function ackKafkaOutbound(messageId, logger) {
  const redis = await getRedisClient(logger);
  await redis.xAck(KAFKA_OUTBOUND_STREAM, KAFKA_OUTBOUND_GROUP, messageId);
}

async function reclaimStaleKafkaOutbound(consumerName, minIdleMs, logger) {
  const redis = await getRedisClient(logger);

  const response = await redis.xAutoClaim(
    KAFKA_OUTBOUND_STREAM,
    KAFKA_OUTBOUND_GROUP,
    consumerName,
    minIdleMs,
    "0-0",
    {
      COUNT: 100
    }
  );

  return response ? response.messages || [] : [];
}

async function removeFromDedupSet(mountName, logger) {
  const redis = await getRedisClient(logger);
  await redis.sRem(DEVICE_DEDUP_SET, mountName);
}

async function deleteMessage(messageId, logger) {
  const redis = await getRedisClient(logger);
  await redis.xDel(DEVICE_STREAM, messageId);
}

async function deleteKafkaOutboundMessage(messageId, logger) {
  const redis = await getRedisClient(logger);
  await redis.xDel(KAFKA_OUTBOUND_STREAM, messageId);
}

module.exports = {
    DEVICE_STREAM,
    DEVICE_GROUP,
    RETRY_STREAM,
    RETRY_GROUP,
    KAFKA_OUTBOUND_STREAM,
    KAFKA_OUTBOUND_GROUP,
    ensureGroup,
    enqueueMountNames,
    readNext,
    ackMessage,
    reclaimStale,
    enqueueRetry,
    getQueueLength,
    ensureKafkaOutboundGroup,
    enqueueKafkaOutbound,
    readNextKafkaOutbound,
    ackKafkaOutbound,
    reclaimStaleKafkaOutbound,
    removeFromDedupSet,
    deleteMessage,
    deleteKafkaOutboundMessage,
    ensureRetryGroup,
    readNextRetry,
    ackRetryMessage,
    deleteRetryMessage,
    reclaimStaleRetry
};
