const { getParamFromFunction } = require("../../utils/functionTree");
const { readKafkaAddress } = require("../../utils/ltpResolution");
const redisQueue = require("../redis/redisStreamQueue");

async function run(request) {
  const { parameters, configFile, logger } = request;
  const outputFormat = request.output;

  if (!parameters || !configFile || outputFormat === undefined) {
    throw new Error("parameters, configFile and outputFormat are mandatory");
  }

  const formats = Array.isArray(outputFormat) ? outputFormat : [outputFormat];
  const queuedResultList = [];

  await redisQueue.ensureKafkaOutboundGroup(logger);

  for (const format of formats) {
    const kafkaClientUuid = getParamFromFunction(
      parameters,
      "p1TransmittingKafka",
      format.formatName,
      null
    );

    if (!kafkaClientUuid) {
      // Testing purpose: For tracking in the response, we optimistically mark it as QUEUED. If enqueueing fails, it will be retried and marked as failed in the logs, but won't be reflected in the response.
      /* queuedResultList.push({
        formatName: format.formatName,
        status: "SKIPPED",
        reason: "No kafka client configured"
      }); */
      continue;
    }

    const kafkaClient = await readKafkaAddress(configFile, kafkaClientUuid);

    await redisQueue.enqueueKafkaOutbound(
      {
        formatName: format.formatName,
        kafkaClientUuid,
        topicName: kafkaClient.topicName,
        clientId: kafkaClient.clientId,
        brokerList: kafkaClient.brokerList,
        message: format
      },
      logger
    );

    // Testing purpose: For tracking in the response, we optimistically mark it as QUEUED. If enqueueing fails, it will be retried and marked as failed in the logs, but won't be reflected in the response.
    /* queuedResultList.push({
      formatName: format.formatName,
      kafkaClientUuid,
      topicName: kafkaClient.topicName,
      status: "QUEUED"
    }); */
  }

  return { queuedResultList };
}

module.exports = { run };