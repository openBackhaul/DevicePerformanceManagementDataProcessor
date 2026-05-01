const redisQueue = require("../redis/redisStreamQueue");

function normalizeOutputs(request) {
  const output = request.outputs || request.output;

  if (!output) {
    throw new Error("output or outputs is mandatory");
  }

  return Array.isArray(output) ? output : [output];
}

function normalizeOutputMessage(output) {
  const mountName =
    output.mountName ||
    output.deviceId ||
    output.devicId ||
    output["mount-name"] ||
    null;

  return {
    targetConsumer: String(output.targetConsumer || "").toUpperCase(),
    messageType: output.messageType || "PERFORMANCE_OUTPUT",
    mountName,
    correlationId: output.correlationId || null,
    payloadVersion: output.payloadVersion || output.version || "1.0",
    eventTime: output.eventTime || output.batchTimestamp || new Date().toISOString(),
    payload: output.payload || {}
  };
}

/**
 * Request:
 * {
 *   output: {
 *     targetConsumer,
 *     messageType,
 *     mountName,
 *     correlationId,
 *     payloadVersion,
 *     payload
 *   }
 * }
 *
 * Response:
 * {
 *   queuedResultList
 * }
 */
async function run(request) {
  const { logger } = request;
  const outputs = normalizeOutputs(request);
  const queuedResultList = [];

  await redisQueue.ensureKafkaOutboundGroup(logger);

  for (const output of outputs) {
    const normalized = normalizeOutputMessage(output);

    if (!normalized.targetConsumer) {
      queuedResultList.push({
        status: "SKIPPED",
        reason: "targetConsumer is mandatory",
        mountName: normalized.mountName
      });
      continue;
    }

    await redisQueue.enqueueKafkaOutbound(normalized, logger);

    queuedResultList.push({
      targetConsumer: normalized.targetConsumer,
      messageType: normalized.messageType,
      mountName: normalized.mountName,
      status: "QUEUED"
    });
  }

  return { queuedResultList };
}

module.exports = { run };