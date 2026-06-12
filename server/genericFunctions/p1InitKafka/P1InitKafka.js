const { getParamsByPurpose } = require("../../utils/functionTree");
const { readKafkaAddress } = require("../../utils/ltpResolution");
const onfAdapter = require("../../infra/onf/onfAdapter");
const ERRORS = require("./ErrorsEnum");

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
  if (!request || typeof request !== "object") {
    throw new Error(ERRORS.GENERAL_PROCESSING_ERROR);
  }

  const { parameters, configFile, logger } = request;

  if (parameters === undefined || parameters === null) {
    throw new Error(ERRORS.PARAMETERS_MISSING);
  }
  if (typeof parameters !== "object" || Array.isArray(parameters)) {
    throw new Error(ERRORS.PARAMETERS_INVALID);
  }
  if (configFile === undefined || configFile === null) {
    throw new Error(ERRORS.CONFIG_FILE_MISSING);
  }
  if (typeof configFile !== "object" || Array.isArray(configFile)) {
    throw new Error(ERRORS.CONFIG_FILE_INVALID);
  }

  try {
    const kafkaParams = getParamsByPurpose(
      parameters,
      "p1InitKafka",
      "kafkaClient"
    );

    const kafkaConnectionList = [];

    for (const param of kafkaParams) {
      let kafkaClient;
      try {
        kafkaClient = await readKafkaAddress(configFile, param.value);
      } catch (e) {
        throw new Error(ERRORS.KAFKA_ADDRESS_COULD_NOT_BE_RESOLVED);
      }

      let producerConnected;
      try {
        producerConnected = await onfAdapter.connectKafkaProducer(
          kafkaClient.clientId,
          kafkaClient.brokerList,
          logger
        );
      } catch (e) {
        throw new Error(ERRORS.PRODUCER_CONNECTION_TO_KAFKA_FAILED);
      }

      if (producerConnected === false) {
        throw new Error(ERRORS.PRODUCER_CONNECTION_TO_KAFKA_FAILED);
      }

      kafkaConnectionList.push({
        parameterName: param["parameter-name"],
        kafkaClientUuid: param.value,
        clientId: kafkaClient.clientId,
        groupId: kafkaClient.groupId,
        //auth: kafkaClient.auth,
        brokerList: kafkaClient.brokerList,
        topicName: kafkaClient.topicName,
        type: kafkaClient.type
      });
    }

    return { kafkaConnectionList };
  } catch (e) {
    if (ERRORS.knownErrors.has(e.message)) {
      throw e;
    }
    throw new Error(ERRORS.GENERAL_PROCESSING_ERROR);
  }
}

module.exports = { run };