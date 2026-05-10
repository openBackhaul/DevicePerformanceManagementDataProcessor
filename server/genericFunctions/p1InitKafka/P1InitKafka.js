const { getParamsByPurpose } = require("../../utils/functionTree");
const { readKafkaAddress } = require("../../utils/ltpResolution");
const onfAdapter = require("../../infra/onf/onfAdapter");

/**
 * Request:
 * {
 *   parameters: <function-tree>,
 *   configFile: <control-construct>
 * }
 *
 * Response:
 * {
 *   kafkaConnectionList: [
 *     {
 *       parameterName,
 *       kafkaClientUuid,
 *       clientId,
 *       brokerList,
 *       topicName,
 *       type
 *     }
 *   ]
 * }
 */
async function run(request) {
  const { parameters, configFile, logger } = request;

  if (!parameters || !configFile) {
    throw new Error("parameters and configFile are mandatory");
  }

  const kafkaParams = getParamsByPurpose(
    parameters,
    "p1InitKafka",
    "kafkaClient"
  );

  const kafkaConnectionList = [];

  for (const param of kafkaParams) {
    const kafkaClient = await readKafkaAddress(configFile, param.value);

    await onfAdapter.connectKafkaProducer(
      kafkaClient.clientId,
      kafkaClient.brokerList,
      logger
    );

    kafkaConnectionList.push({
      parameterName: param["parameter-name"],
      kafkaClientUuid: param.value,
      clientId: kafkaClient.clientId,
      groupId: kafkaClient.groupId,
      auth: kafkaClient.auth,
      brokerList: kafkaClient.brokerList,
      topicName: kafkaClient.topicName,
      type: kafkaClient.type
    });
  }

  return { kafkaConnectionList };
}

module.exports = { run };