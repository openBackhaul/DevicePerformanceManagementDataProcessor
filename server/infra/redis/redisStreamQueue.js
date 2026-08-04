const { getRedisClient } = require("./redisClient");
const { sleep } = require("../../utils/retry");
const logger = require('../../service/LoggingService.js').getLogger();

const DEVICE_STREAM = "dpmdp:stream:device-processing";
const DEVICE_GROUP = "dpmdp:group:device-processing";
const DEVICE_DEDUP_SET = "dpmdp:set:device-processing";
const RETRY_STREAM = "dpmdp:stream:retry";
const RETRY_GROUP = "dpmdp:group:retry";
const RETRY_DEAD_LETTER_STREAM = "dpmdp:stream:retry-dead-letter";
const RETRY_DEAD_LETTER_SET = "dpmdp:set:retry-dead-letter";
const RETRY_PENDING_SET = "dpmdp:set:retry-pending";
const RETRY_COUNT_HASH = "dpmdp:hash:retry-count";
const RETRY_STATE_HASH = "dpmdp:hash:retry-state";
const KAFKA_OUTBOUND_STREAM = "dpmdp:stream:kafka-outbound";
const KAFKA_OUTBOUND_GROUP = "dpmdp:group:kafka-outbound";
const KAFKA_OUTBOUND_DEAD_LETTER_STREAM = "dpmdp:stream:kafka-outbound-dead-letter";

const ENQUEUE_MOUNT_NAMES_SCRIPT = `
local enqueued = 0
local skipped = 0
local allowRetryPending = ARGV[1] == '1'
local allowDeadLetter = ARGV[2] == '1'
local createdAt = ARGV[3]
local extraFieldCount = tonumber(ARGV[4])
local mountNameStart = 5 + (extraFieldCount * 2)

for i = mountNameStart, #ARGV do
  local mountName = ARGV[i]
  local blocked = false

  if not allowDeadLetter and redis.call('SISMEMBER', KEYS[3], mountName) == 1 then
    blocked = true
  end
  if not blocked and not allowRetryPending and redis.call('SISMEMBER', KEYS[4], mountName) == 1 then
    blocked = true
  end

  if blocked or redis.call('SADD', KEYS[2], mountName) == 0 then
    skipped = skipped + 1
  else
    local fields = { 'mountName', mountName, 'createdAt', createdAt }
    for fieldIndex = 0, extraFieldCount - 1 do
      table.insert(fields, ARGV[5 + (fieldIndex * 2)])
      table.insert(fields, ARGV[6 + (fieldIndex * 2)])
    end
    redis.call('XADD', KEYS[1], '*', unpack(fields))
    enqueued = enqueued + 1
  end
end

return { enqueued, skipped }
`;

async function ensureGroup(loggers) {
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

async function readNext(consumerName, blockMs, count, loggers) {
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

async function ackMessage(messageId, loggers) {
    const redis = await getRedisClient(logger);
    await redis.xAck(DEVICE_STREAM, DEVICE_GROUP, messageId);
}

async function reclaimStale(consumerName, minIdleMs, loggers) {
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

function toRedisValue(value) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function nextStreamId(id) {
  const parts = String(id || "0-0").split("-");
  const ms = Number(parts[0] || 0);
  const seq = Number(parts[1] || 0);

  return `${ms}-${seq + 1}`;
}

async function deleteStreamEntriesByMountName(streamKey, groupName, mountName, loggers) {
  const redis = await getRedisClient(logger);
  const safeMountName = String(mountName || "").trim();

  if (!safeMountName) {
    return 0;
  }

  let deletedCount = 0;
  let startId = "-";
  const count = 500;

  while (true) {
    const entries = await redis.xRange(
      streamKey,
      startId,
      "+",
      { COUNT: count }
    );

    if (!entries || entries.length === 0) {
      break;
    }

    const idsToDelete = [];

    for (const entry of entries) {
      const fields = entry.message || {};

      if (String(fields.mountName || "").trim() === safeMountName) {
        idsToDelete.push(entry.id);
      }
    }

    if (idsToDelete.length > 0) {
      if (groupName) {
        await redis.xAck(streamKey, groupName, idsToDelete).catch(() => {});
      }

      await redis.xDel(streamKey, idsToDelete);
      deletedCount += idsToDelete.length;
    }

    const lastId = entries[entries.length - 1].id;
    startId = nextStreamId(lastId);

    if (entries.length < count) {
      break;
    }
  }

  return deletedCount;
}

async function deleteStreamEntriesByMountNames(streamKey, groupName, mountNames, loggers) {
  const redis = await getRedisClient(logger);
  const mountNameSet = new Set(
    (mountNames || []).map((value) => String(value || "").trim()).filter(Boolean)
  );

  if (mountNameSet.size === 0) return 0;

  let deletedCount = 0;
  let startId = "-";
  const count = 500;

  while (true) {
    const entries = await redis.xRange(streamKey, startId, "+", { COUNT: count });
    if (!entries || entries.length === 0) break;

    const idsToDelete = entries
      .filter((entry) => mountNameSet.has(String(entry.message?.mountName || "").trim()))
      .map((entry) => entry.id);

    if (idsToDelete.length > 0) {
      if (groupName) {
        await redis.xAck(streamKey, groupName, idsToDelete).catch(() => {});
      }
      await redis.xDel(streamKey, idsToDelete);
      deletedCount += idsToDelete.length;
    }

    startId = nextStreamId(entries[entries.length - 1].id);
    if (entries.length < count) break;
  }

  return deletedCount;
}

async function clearRetryAndDeadLetterForReplicaUpdates(mountNames, loggers) {
  const redis = await getRedisClient(logger);
  const uniqueMountNames = Array.from(new Set(
    (mountNames || []).map((value) => String(value || "").trim()).filter(Boolean)
  ));

  if (uniqueMountNames.length === 0) {
    return { mountNameCount: 0, retryStreamDeleted: 0, deadLetterStreamDeleted: 0 };
  }

  const retryStreamDeleted = await deleteStreamEntriesByMountNames(
    RETRY_STREAM,
    RETRY_GROUP,
    uniqueMountNames,
    logger
  );
  const deadLetterStreamDeleted = await deleteStreamEntriesByMountNames(
    RETRY_DEAD_LETTER_STREAM,
    null,
    uniqueMountNames,
    logger
  );

  const batchSize = 500;
  for (let i = 0; i < uniqueMountNames.length; i += batchSize) {
    const batch = uniqueMountNames.slice(i, i + batchSize);
    await redis.sRem(RETRY_PENDING_SET, batch);
    await redis.sRem(RETRY_DEAD_LETTER_SET, batch);
    await redis.hDel(RETRY_COUNT_HASH, batch);
    await redis.hDel(RETRY_STATE_HASH, batch);
  }

  logger?.info?.(
    { mountNameCount: uniqueMountNames.length, retryStreamDeleted, deadLetterStreamDeleted },
    "Cleared retry/dead-letter state for replica update in bulk"
  );

  return { mountNameCount: uniqueMountNames.length, retryStreamDeleted, deadLetterStreamDeleted };
}

async function clearRetryAndDeadLetterForReplicaUpdate(mountName, loggers) {
  const redis = await getRedisClient(logger);
  const safeMountName = String(mountName || "").trim();

  if (!safeMountName) {
    return {
      mountName,
      status: "SKIPPED",
      reason: "EMPTY_MOUNTNAME"
    };
  }

  const retryStreamDeleted = await deleteStreamEntriesByMountName(
    RETRY_STREAM,
    RETRY_GROUP,
    safeMountName,
    logger
  );

  const deadLetterStreamDeleted = await deleteStreamEntriesByMountName(
    RETRY_DEAD_LETTER_STREAM,
    null,
    safeMountName,
    logger
  );

  await redis.sRem(RETRY_PENDING_SET, safeMountName);
  await redis.sRem(RETRY_DEAD_LETTER_SET, safeMountName);
  await redis.hDel(RETRY_COUNT_HASH, safeMountName);
  await redis.hDel(RETRY_STATE_HASH, safeMountName);

  logger &&
    logger.warn &&
    logger.warn(
      {
        mountName: safeMountName,
        retryStreamDeleted,
        deadLetterStreamDeleted
      },
      "Cleared retry/dead-letter state because updated ControlConstruct was found"
    );

  return {
    mountName: safeMountName,
    status: "CLEARED",
    retryStreamDeleted,
    deadLetterStreamDeleted
  };
}

async function isRetryPending(mountName, loggers) {
  const redis = await getRedisClient(logger);
  const safeMountName = String(mountName || "").trim();

  if (!safeMountName) {
    return false;
  }

  return await redis.sIsMember(RETRY_PENDING_SET, safeMountName);
}

async function enqueueRetry(
  mountName,
  stage,
  lastError,
  maxRetryCount,
  loggers
) {
  const redis = await getRedisClient(logger);
  const safeMountName = String(mountName || "").trim();

  if (!safeMountName) {
    return {
      status: "SKIPPED",
      reason: "EMPTY_MOUNTNAME"
    };
  }

  const maxRetry = Number(maxRetryCount || 1);

  const alreadyDeadLettered = await redis.sIsMember(
    RETRY_DEAD_LETTER_SET,
    safeMountName
  );

  if (alreadyDeadLettered) {
    return {
      status: "ALREADY_DEAD_LETTER",
      mountName: safeMountName
    };
  }

  /*
   * This prevents duplicate retry-stream entries for the same mountName.
   * If mountName is already waiting in retry stream, do not XADD again.
   */
  const pendingAdded = await redis.sAdd(RETRY_PENDING_SET, safeMountName);
  const currentRetryCount = Number(
    (await redis.hGet(RETRY_COUNT_HASH, safeMountName)) || 0
  );

  if (pendingAdded === 0) {
    await redis.hSet(
      RETRY_STATE_HASH,
      safeMountName,
      JSON.stringify({
        mountName: safeMountName,
        stage: stage || "unknown",
        lastError: lastError || "",
        retryCount: currentRetryCount,
        status: "PENDING_RETRY",
        updatedAt: new Date().toISOString()
      })
    );

    return {
      status: "ALREADY_PENDING",
      mountName: safeMountName,
      retryCount: currentRetryCount
    };
  }

  const nextRetryCount = currentRetryCount + 1;

  if (nextRetryCount > maxRetry) {
    await redis.sRem(RETRY_PENDING_SET, safeMountName);
    await redis.sAdd(RETRY_DEAD_LETTER_SET, safeMountName);

    await redis.xAdd(RETRY_DEAD_LETTER_STREAM, "*", {
      mountName: safeMountName,
      stage: toRedisValue(stage || "unknown"),
      lastError: toRedisValue(lastError || ""),
      retryCount: toRedisValue(currentRetryCount),
      maxRetryCount: toRedisValue(maxRetry),
      reason: "MAX_RETRY_EXCEEDED",
      createdAt: new Date().toISOString()
    });

    await redis.hSet(
      RETRY_STATE_HASH,
      safeMountName,
      JSON.stringify({
        mountName: safeMountName,
        stage: stage || "unknown",
        lastError: lastError || "",
        retryCount: currentRetryCount,
        maxRetryCount: maxRetry,
        status: "DEAD_LETTER",
        updatedAt: new Date().toISOString()
      })
    );

    return {
      status: "DEAD_LETTER",
      mountName: safeMountName,
      retryCount: currentRetryCount,
      maxRetryCount: maxRetry
    };
  }

  await redis.hSet(RETRY_COUNT_HASH, safeMountName, String(nextRetryCount));

  await redis.hSet(
    RETRY_STATE_HASH,
    safeMountName,
    JSON.stringify({
      mountName: safeMountName,
      stage: stage || "unknown",
      lastError: lastError || "",
      retryCount: nextRetryCount,
      maxRetryCount: maxRetry,
      status: "PENDING_RETRY",
      updatedAt: new Date().toISOString()
    })
  );

  await redis.xAdd(RETRY_STREAM, "*", {
    mountName: safeMountName,
    stage: toRedisValue(stage || "unknown"),
    lastError: toRedisValue(lastError || ""),
    retryCount: toRedisValue(nextRetryCount),
    maxRetryCount: toRedisValue(maxRetry),
    createdAt: new Date().toISOString()
  });

  return {
    status: "ENQUEUED",
    mountName: safeMountName,
    retryCount: nextRetryCount,
    maxRetryCount: maxRetry
  };
}

async function completeRetryRequeue(mountName, logger) {
  const redis = await getRedisClient(logger);

  if (!mountName) {
    return;
  }

  const safeMountName = String(mountName);

  await redis.sRem(RETRY_PENDING_SET, safeMountName);

  const existingStateRaw = await redis.hGet(RETRY_STATE_HASH, safeMountName);
  let existingState = {};

  try {
    existingState = existingStateRaw ? JSON.parse(existingStateRaw) : {};
  } catch (error) {
    existingState = {};
  }

  await redis.hSet(
    RETRY_STATE_HASH,
    safeMountName,
    JSON.stringify({
      ...existingState,
      mountName: safeMountName,
      status: "REQUEUED",
      requeuedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  );
}

async function clearRetryState(mountName, loggers) {
  const redis = await getRedisClient(logger);

  if (!mountName) {
    return;
  }

  const safeMountName = String(mountName);

  await redis.sRem(RETRY_PENDING_SET, safeMountName);
  await redis.sRem(RETRY_DEAD_LETTER_SET, safeMountName);
  await redis.hDel(RETRY_COUNT_HASH, safeMountName);
  await redis.hDel(RETRY_STATE_HASH, safeMountName);
}

async function ensureRetryGroup(loggers) {
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

async function readNextRetry(consumerName, blockMs, count, loggers) {
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

async function ackRetryMessage(messageId, loggers) {
  const redis = await getRedisClient(logger);
  await redis.xAck(RETRY_STREAM, RETRY_GROUP, messageId);
}

async function deleteRetryMessage(messageId, loggers) {
  const redis = await getRedisClient(logger);
  await redis.xDel(RETRY_STREAM, messageId);
}

async function enqueueRetryDeadLetter(
  mountName,
  stage,
  lastError,
  retryCount,
  reason,
  loggers
) {
  const redis = await getRedisClient(logger);

  await redis.xAdd(RETRY_DEAD_LETTER_STREAM, "*", {
    mountName: toRedisValue(mountName),
    stage: toRedisValue(stage || "unknown"),
    lastError: toRedisValue(lastError || ""),
    retryCount: toRedisValue(retryCount || 0),
    reason: toRedisValue(reason || "MAX_RETRY_EXCEEDED"),
    createdAt: new Date().toISOString()
  });
}

async function getRetryQueueLength(loggers) {
  const redis = await getRedisClient(logger);
  return Number(await redis.xLen(RETRY_STREAM).catch(() => 0));
}

async function reclaimStaleRetry(consumerName, minIdleMs, loggers) {
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

async function getQueueLength(loggers) {
    const redis = await getRedisClient(logger);
    return Number(await redis.xLen(DEVICE_STREAM).catch(() => 0));
}

async function enqueueMountNames(mountNames, options, loggers) {
  const redis = await getRedisClient(logger);
  const batchSize = (options || {}).batchSize || 500;
  const pauseMs = (options || {}).pauseMs || 50;
  const extraFields = (options || {}).extraFields || {};

  /*
   * Normal replica enqueue must not enqueue mountNames that are waiting in retry
   * or already dead-lettered.
   *
   * Retry worker is allowed to requeue from retry-pending by passing:
   * allowRetryPending: true
   */
  const allowRetryPending = (options || {}).allowRetryPending === true;
  const allowDeadLetter = (options || {}).allowDeadLetter === true;

  const clearRetryAndDeadLetterBeforeEnqueue =
  (options || {}).clearRetryAndDeadLetterBeforeEnqueue === true;

  let enqueued = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < (mountNames || []).length; i += batchSize) {
    const batch = mountNames.slice(i, i + batchSize);

    const safeBatch = batch.map((value) => String(value || "").trim()).filter(Boolean);
    skipped += batch.length - safeBatch.length;

    try {
      if (clearRetryAndDeadLetterBeforeEnqueue) {
        for (const safeMountName of safeBatch) {
          await clearRetryAndDeadLetterForReplicaUpdate(safeMountName, logger);
        }
      }

      const extraArguments = Object.entries(extraFields).flatMap(([key, value]) => [
        String(key),
        toRedisValue(value)
      ]);
      const result = await redis.eval(ENQUEUE_MOUNT_NAMES_SCRIPT, {
        keys: [
          DEVICE_STREAM,
          DEVICE_DEDUP_SET,
          RETRY_DEAD_LETTER_SET,
          RETRY_PENDING_SET
        ],
        arguments: [
          allowRetryPending ? "1" : "0",
          allowDeadLetter ? "1" : "0",
          new Date().toISOString(),
          String(Object.keys(extraFields).length),
          ...extraArguments,
          ...safeBatch
        ]
      });

      enqueued += Number(result?.[0] || 0);
      skipped += Number(result?.[1] || 0);
    } catch (error) {
      failed += safeBatch.length;
      logger?.error?.(
        { batchStart: i, batchSize: safeBatch.length, error: error.message || error },
        "Failed to enqueue mountName batch"
      );
    }

    if (pauseMs > 0 && i + batchSize < mountNames.length) {
      await sleep(pauseMs);
    }
  }

  return {
    enqueued,
    skipped,
    failed
  };
}

/*Redis queue functions for Kafka outbound messages*/

async function ensureKafkaOutboundGroup(loggers) {
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

async function enqueueKafkaOutbound(outputMessage, loggers) {
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

async function readNextKafkaOutbound(consumerName, blockMs, count, loggers) {
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

async function ackKafkaOutbound(messageId, loggers) {
  const redis = await getRedisClient(logger);
  await redis.xAck(KAFKA_OUTBOUND_STREAM, KAFKA_OUTBOUND_GROUP, messageId);
}

async function reclaimStaleKafkaOutbound(consumerName, minIdleMs, loggers) {
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

async function removeFromDedupSet(mountName, loggers) {
  const redis = await getRedisClient(logger);
  await redis.sRem(DEVICE_DEDUP_SET, mountName);
}

async function deleteMessage(messageId, loggers) {
  const redis = await getRedisClient(logger);
  await redis.xDel(DEVICE_STREAM, messageId);
}

async function deleteKafkaOutboundMessage(messageId, loggers) {
  const redis = await getRedisClient(logger);
  await redis.xDel(KAFKA_OUTBOUND_STREAM, messageId);
}

async function moveKafkaOutboundToDeadLetter(redisMessage, error, loggers) {
  const redis = await getRedisClient(logger);
  const fields = redisMessage.message || {};

  // Persist first; only acknowledge/delete the active entry after the dead
  // letter copy succeeds. This prevents loss of an undeliverable large result.
  await redis.xAdd(KAFKA_OUTBOUND_DEAD_LETTER_STREAM, "*", {
    originalMessageId: toRedisValue(redisMessage.id),
    targetConsumer: toRedisValue(fields.targetConsumer),
    messageType: toRedisValue(fields.messageType),
    mountName: toRedisValue(fields.mountName),
    correlationId: toRedisValue(fields.correlationId),
    payloadVersion: toRedisValue(fields.payloadVersion),
    eventTime: toRedisValue(fields.eventTime),
    payloadStorage: toRedisValue(fields.payloadStorage),
    payload: toRedisValue(fields.payload),
    payloadRefId: toRedisValue(fields.payloadRefId),
    payloadBytes: toRedisValue(fields.payloadBytes),
    failureReason: toRedisValue(error?.reason || error?.type || "NON_RETRYABLE"),
    failureMessage: toRedisValue(error?.message || error),
    failedAt: new Date().toISOString()
  });

  await redis.xAck(KAFKA_OUTBOUND_STREAM, KAFKA_OUTBOUND_GROUP, redisMessage.id);
  await redis.xDel(KAFKA_OUTBOUND_STREAM, redisMessage.id);
}

module.exports = {
    DEVICE_STREAM,
    DEVICE_GROUP,
    RETRY_STREAM,
    RETRY_GROUP,
    KAFKA_OUTBOUND_STREAM,
    KAFKA_OUTBOUND_GROUP,
    KAFKA_OUTBOUND_DEAD_LETTER_STREAM,
    RETRY_PENDING_SET,
    RETRY_COUNT_HASH,
    RETRY_STATE_HASH,
    RETRY_DEAD_LETTER_STREAM,
    RETRY_DEAD_LETTER_SET,
    completeRetryRequeue,
    clearRetryState,
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
    moveKafkaOutboundToDeadLetter,
    ensureRetryGroup,
    readNextRetry,
    ackRetryMessage,
    deleteRetryMessage,
    reclaimStaleRetry,
    enqueueRetryDeadLetter,
    getRetryQueueLength,
    clearRetryAndDeadLetterForReplicaUpdate,
    clearRetryAndDeadLetterForReplicaUpdates,
    isRetryPending
};
