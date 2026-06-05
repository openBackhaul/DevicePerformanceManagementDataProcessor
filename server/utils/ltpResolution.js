const onfAdapter = require("../infra/onf/onfAdapter");

function getLayerProtocol(ltp) {
  return (((ltp || {})["layer-protocol"]) || [])[0] || {};
}

async function readEsAddress(configFile, esClientUuid) {
  const attrs = onfAdapter.getOnfAttributes();

  if (!esClientUuid) {
    throw new Error("es-client-uuid could not be resolved");
  }

  const esLtp = await onfAdapter.getLogicalTerminationPointAsync(
    esClientUuid,
    configFile
  );
  if (!esLtp) {
    throw new Error("es-client LTP could not be found in config-file");
  }

  const httpUuid = (esLtp[attrs.LOGICAL_TERMINATION_POINT.SERVER_LTP] || [])[0];
  if (!httpUuid) {
    throw new Error("http-client-uuid could not be resolved");
  }

  const httpLtp = await onfAdapter.getLogicalTerminationPointAsync(httpUuid, configFile);
  if (!httpLtp) {
    throw new Error("http-client LTP could not be found in config-file");
  }

  const tcpUuid = (httpLtp[attrs.LOGICAL_TERMINATION_POINT.SERVER_LTP] || [])[0];
  if (!tcpUuid) {
    throw new Error("tcp-client-uuid could not be resolved");
  }

  const tcpLtp = await onfAdapter.getLogicalTerminationPointAsync(tcpUuid, configFile);
  if (!tcpLtp) {
    throw new Error("tcp-client LTP could not be found in config-file");
  }

  const remoteAddress = await onfAdapter.getRemoteAddressAsync(tcpUuid, configFile);
  const remotePort = await onfAdapter.getRemotePortAsync(tcpUuid, configFile);
  const remoteProtocol = await onfAdapter.getRemoteProtocolAsync(tcpUuid, configFile);

  if (!remoteProtocol || !remoteAddress || remotePort === undefined || remotePort === null) {
    throw new Error("url could not be resolved");
  }

  const esPac =
    getLayerProtocol(esLtp)[attrs.LAYER_PROTOCOL.ES_CLIENT_INTERFACE_PAC] || {};
  const esCfg = esPac[attrs.ES_CLIENT.CONFIGURATION] || {};
  const esStatus = esPac["elasticsearch-client-interface-status"] || {};

  const indexAlias = esCfg[attrs.ES_CLIENT.INDEX_ALIAS];
  if (!indexAlias) {
    throw new Error("index-alias could not be resolved");
  }

  const apiKey = ((esCfg[attrs.ES_CLIENT.AUTH] || {})[attrs.ES_CLIENT.API_KEY]);
  if (apiKey === undefined || apiKey === null) {
    throw new Error("api-key could not be resolved");
  }

  const serviceRecordsPolicy = esCfg["service-records-policy"];
  if (!serviceRecordsPolicy) {
    throw new Error("service-records-policy could not be resolved");
  }

  const operationalState = esStatus["operational-state"];
  if (!operationalState) {
    throw new Error("operational-state could not be resolved");
  }

  const lifeCycleState = esStatus["life-cycle-state"];
  if (!lifeCycleState) {
    throw new Error("life-cycle-state could not be resolved");
  }

  return {
    uuid: esClientUuid,
    url:
      String(remoteProtocol).toLowerCase() +
      "://" +
      onfAdapter.remoteAddressToHost(remoteAddress) +
      ":" +
      remotePort,
    "index-alias": indexAlias,
    "api-key": apiKey,
    "service-records-policy": serviceRecordsPolicy,
    "operational-state": operationalState,
    "life-cycle-state": lifeCycleState
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
    auth: kafkaCfg[attrs.KAFKA_CLIENT.AUTH] || {},
    brokerList: [onfAdapter.remoteAddressToHost(remoteAddress) + ":" + remotePort]
  };
}

module.exports = {
  readEsAddress,
  readKafkaAddress
};