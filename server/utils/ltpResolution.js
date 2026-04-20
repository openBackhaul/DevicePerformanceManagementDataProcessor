const onfAdapter = require("../infra/onf/onfAdapter");

function getLayerProtocol(ltp) {
  return (((ltp || {})["layer-protocol"]) || [])[0] || {};
}

async function readEsAddress(configFile, esClientUuid) {
  const attrs = onfAdapter.getOnfAttributes();

  const esLtp = await onfAdapter.getLogicalTerminationPointAsync(
    esClientUuid,
    configFile
  );

  if (!esLtp) {
    throw new Error("ES client LTP not found: " + esClientUuid);
  }

  const httpUuid = (esLtp[attrs.LOGICAL_TERMINATION_POINT.SERVER_LTP] || [])[0];
  const httpLtp = await onfAdapter.getLogicalTerminationPointAsync(httpUuid, configFile);
  const tcpUuid = ((httpLtp || {})[attrs.LOGICAL_TERMINATION_POINT.SERVER_LTP] || [])[0];

  const remoteAddress = await onfAdapter.getRemoteAddressAsync(tcpUuid, configFile);
  const remotePort = await onfAdapter.getRemotePortAsync(tcpUuid, configFile);
  const remoteProtocol = await onfAdapter.getRemoteProtocolAsync(tcpUuid, configFile);

  const esPac =
    getLayerProtocol(esLtp)[attrs.LAYER_PROTOCOL.ES_CLIENT_INTERFACE_PAC] || {};

  const esCfg = esPac[attrs.ES_CLIENT.CONFIGURATION] || {};

  return {
    uuid: esClientUuid,
    node:
      String(remoteProtocol || "").toLowerCase() +
      "://" +
      onfAdapter.remoteAddressToHost(remoteAddress) +
      ":" +
      remotePort,
    "index-alias": esCfg[attrs.ES_CLIENT.INDEX_ALIAS] || "",
    "api-key": ((esCfg[attrs.ES_CLIENT.AUTH] || {})[attrs.ES_CLIENT.API_KEY]) || ""
  };
}

async function readKafkaAddress(configFile, kafkaClientUuid) {
  const attrs = onfAdapter.getOnfAttributes();

  const kafkaLtp = await onfAdapter.getLogicalTerminationPointAsync(
    kafkaClientUuid,
    configFile
  );

  if (!kafkaLtp) {
    throw new Error("Kafka client LTP not found: " + kafkaClientUuid);
  }

  const httpUuid = (kafkaLtp[attrs.LOGICAL_TERMINATION_POINT.SERVER_LTP] || [])[0];
  const httpLtp = await onfAdapter.getLogicalTerminationPointAsync(httpUuid, configFile);
  const tcpUuid = ((httpLtp || {})[attrs.LOGICAL_TERMINATION_POINT.SERVER_LTP] || [])[0];

  const remoteAddress = await onfAdapter.getRemoteAddressAsync(tcpUuid, configFile);
  const remotePort = await onfAdapter.getRemotePortAsync(tcpUuid, configFile);

  const kafkaPac =
    getLayerProtocol(kafkaLtp)[attrs.LAYER_PROTOCOL.KAFKA_CLIENT_INTERFACE_PAC] || {};

  const kafkaCfg = kafkaPac[attrs.KAFKA_CLIENT.CONFIGURATION] || {};

  return {
    uuid: kafkaClientUuid,
    clientId: kafkaCfg[attrs.KAFKA_CLIENT.CLIENT_ID] || "dpmdp-client",
    groupId: kafkaCfg[attrs.KAFKA_CLIENT.GROUP_ID] || "dpmdp-group",
    topicName: kafkaCfg[attrs.KAFKA_CLIENT.TOPIC_NAME] || "",
    type: kafkaCfg.type || "provider",
    brokerList: [onfAdapter.remoteAddressToHost(remoteAddress) + ":" + remotePort]
  };
}

module.exports = {
  readEsAddress,
  readKafkaAddress
};