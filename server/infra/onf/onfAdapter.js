const { loadConfigFile } = require("../../utils/config");
const { Client } = require("@elastic/elasticsearch");
const confluentKafkaProducer = require("../kafka/confluentKafkaProducer");
const { withRetry } = require("../../utils/retry");

function tryRequire(name) {
  try {
    return require(name);
  } catch (error) {
    return undefined;
  }
}

const JSONDriver = require(
  "onf-core-model-ap/applicationPattern/databaseDriver/JSONDriver"
);
const ProfileCollection = require(
  "onf-core-model-ap/applicationPattern/onfModel/models/ProfileCollection"
);
const ControlConstruct = require(
  "onf-core-model-ap/applicationPattern/onfModel/models/ControlConstruct"
);
const LayerProtocol = require(
  "onf-core-model-ap/applicationPattern/onfModel/models/LayerProtocol"
);
const OnfAttributes = require(
  "onf-core-model-ap/applicationPattern/onfModel/constants/OnfAttributes"
);
const KafkaProducerService = require(
  "onf-core-model-ap/applicationPattern/services/kafkaProducerService"
);
const TcpClientInterface = require(
  "onf-core-model-ap/applicationPattern/onfModel/models/layerProtocols/TcpClientInterface"
);
const ElasticsearchServiceModule = require(
  "onf-core-model-ap/applicationPattern/services/ElasticsearchService"
);

const esClients = new Map();

function getConfig(configFile) {
  return configFile || loadConfigFile();
}

function getControlConstruct(configFile) {
  const cfg = getConfig(configFile);
  return cfg["core-model-1-4:control-construct"] || cfg;
}

function getFallbackOnfAttributes() {
  return {
    GLOBAL_CLASS: { UUID: "uuid" },
    LOGICAL_TERMINATION_POINT: {
      SERVER_LTP: "server-ltp",
      LAYER_PROTOCOL: "layer-protocol"
    },
    LAYER_PROTOCOL: {
      KAFKA_CLIENT_INTERFACE_PAC:
        "kafka-client-interface-1-0:kafka-client-interface-pac",
      ES_CLIENT_INTERFACE_PAC:
        "elasticsearch-client-interface-1-0:elasticsearch-client-interface-pac"
    },
    KAFKA_CLIENT: {
      CONFIGURATION: "kafka-client-interface-configuration",
      CLIENT_ID: "client-id",
      GROUP_ID: "group-id",
      TOPIC_NAME: "topic-name"
    },
    ES_CLIENT: {
      CONFIGURATION: "elasticsearch-client-interface-configuration",
      INDEX_ALIAS: "index-alias",
      AUTH: "auth",
      API_KEY: "api-key"
    },
    TCP_CLIENT: {
      CONFIGURATION: "tcp-client-interface-configuration",
      REMOTE_ADDRESS: "remote-address",
      REMOTE_PORT: "remote-port",
      REMOTE_PROTOCOL: "remote-protocol",
      IP_ADDRESS: "ip-address",
      IPV_4_ADDRESS: "ipv-4-address",
      DOMAIN_NAME: "domain-name"
    }
  };
}

function getOnfAttributes() {
  return OnfAttributes || getFallbackOnfAttributes();
}

function getLayerProtocolEnum() {
  if (LayerProtocol && LayerProtocol.layerProtocolNameEnum) {
    return LayerProtocol.layerProtocolNameEnum;
  }

  return {
    ES_CLIENT:
      "elasticsearch-client-interface-1-0:LAYER_PROTOCOL_NAME_TYPE_ELASTICSEARCH_LAYER",
    KAFKA_CLIENT:
      "kafka-client-interface-1-0:LAYER_PROTOCOL_NAME_TYPE_KAFKA_LAYER"
  };
}

async function readControlConstruct() {
  if (JSONDriver && JSONDriver.readFromDatabaseAsync) {
    try {
      return await JSONDriver.readFromDatabaseAsync("core-model-1-4:control-construct");
    } catch (error) {

      if (error.code === 'ENOENT') {
        return "configFile not found or not accessible";
      }

      if (error instanceof SyntaxError) {
        return "configFile is not valid JSON";
      }

      return "unknown error occurred";
    }
  }

  return getConfig(configFile);
}

async function getLogicalTerminationPointListAsync(layerProtocolName, configFile) {
  if (ControlConstruct && ControlConstruct.getLogicalTerminationPointListAsync) {
    try {
      return await ControlConstruct.getLogicalTerminationPointListAsync(layerProtocolName);
    } catch (error) {}
  }

  const ltpList = getControlConstruct(configFile)["logical-termination-point"] || [];

  if (!layerProtocolName) {
    return ltpList;
  }

  return ltpList.filter((ltp) => {
    const layerProtocol = (((ltp || {})["layer-protocol"]) || [])[0] || {};
    return layerProtocol["layer-protocol-name"] === layerProtocolName;
  });
}

async function getLogicalTerminationPointAsync(uuid, configFile) {
  if (ControlConstruct && ControlConstruct.getLogicalTerminationPointAsync) {
    try {
      return await ControlConstruct.getLogicalTerminationPointAsync(uuid);
    } catch (error) {}
  }

  const ltpList = getControlConstruct(configFile)["logical-termination-point"] || [];
  return ltpList.find((ltp) => ltp.uuid === uuid) || null;
}

async function getRemoteAddressAsync(tcpClientUuid, configFile) {
  if (TcpClientInterface && TcpClientInterface.getRemoteAddressAsync) {
    try {
      return await TcpClientInterface.getRemoteAddressAsync(tcpClientUuid);
    } catch (error) {}
  }

  const attrs = getOnfAttributes();
  const ltp = await getLogicalTerminationPointAsync(tcpClientUuid, configFile);
  const layerProtocol = ltp[attrs.LOGICAL_TERMINATION_POINT.LAYER_PROTOCOL][0];
  const tcpPac = layerProtocol["tcp-client-interface-1-0:tcp-client-interface-pac"];

  return tcpPac[attrs.TCP_CLIENT.CONFIGURATION][attrs.TCP_CLIENT.REMOTE_ADDRESS];
}

async function getRemotePortAsync(tcpClientUuid, configFile) {
  if (TcpClientInterface && TcpClientInterface.getRemotePortAsync) {
    try {
      return await TcpClientInterface.getRemotePortAsync(tcpClientUuid);
    } catch (error) {}
  }

  const attrs = getOnfAttributes();
  const ltp = await getLogicalTerminationPointAsync(tcpClientUuid, configFile);
  const layerProtocol = ltp[attrs.LOGICAL_TERMINATION_POINT.LAYER_PROTOCOL][0];
  const tcpPac = layerProtocol["tcp-client-interface-1-0:tcp-client-interface-pac"];

  return tcpPac[attrs.TCP_CLIENT.CONFIGURATION][attrs.TCP_CLIENT.REMOTE_PORT];
}

async function getRemoteProtocolAsync(tcpClientUuid, configFile) {
  if (TcpClientInterface && TcpClientInterface.getRemoteProtocolAsync) {
    try {
      return await TcpClientInterface.getRemoteProtocolAsync(tcpClientUuid);
    } catch (error) {}
  }

  const attrs = getOnfAttributes();
  const ltp = await getLogicalTerminationPointAsync(tcpClientUuid, configFile);
  const layerProtocol = ltp[attrs.LOGICAL_TERMINATION_POINT.LAYER_PROTOCOL][0];
  const tcpPac = layerProtocol["tcp-client-interface-1-0:tcp-client-interface-pac"];
  const value =
    tcpPac[attrs.TCP_CLIENT.CONFIGURATION][attrs.TCP_CLIENT.REMOTE_PROTOCOL] || "";

  return String(value).includes("HTTPS") ? "HTTPS" : "HTTP";
}

function remoteAddressToHost(remoteAddress) {
  const attrs = getOnfAttributes();

  if (remoteAddress && remoteAddress[attrs.TCP_CLIENT.IP_ADDRESS]) {
    return remoteAddress[attrs.TCP_CLIENT.IP_ADDRESS][attrs.TCP_CLIENT.IPV_4_ADDRESS];
  }

  if (remoteAddress && remoteAddress[attrs.TCP_CLIENT.DOMAIN_NAME]) {
    return remoteAddress[attrs.TCP_CLIENT.DOMAIN_NAME];
  }

  return "127.0.0.1";
}

async function getEsClient(forceCreate, uuid, esAddress, logger) {
  const key = (esAddress && esAddress.node) || uuid || "default";

  if (!forceCreate && esClients.has(key)) {
    return esClients.get(key);
  }

  return withRetry(
    async () => {
      if (
        ElasticsearchServiceModule &&
        ElasticsearchServiceModule.elasticsearchService &&
        !esAddress
      ) {
        const client =
          await ElasticsearchServiceModule.elasticsearchService.getClient(
            Boolean(forceCreate),
            uuid
          );
        esClients.set(key, client);
        return client;
      }

      const options = {
        node: esAddress.url,
        requestTimeout: 60000
      };

      if (esAddress["api-key"] && esAddress["api-key"] !== "API key not yet defined.") {
        options.auth = { apiKey: esAddress["api-key"] };
      }

      const client = new Client(options);
      await client.info();
      esClients.set(key, client);

      return client;
    },
    {
      label: `getEsClient:${key}`,
      retryIntervalMs: 10000,
      logger
    }
  );
}

async function connectKafkaProducer(clientId, brokers, logger) {
  return await confluentKafkaProducer.initProducer({
    clientId,
    brokers,
    logger
  });
}

async function sendKafkaMessage(topic, message, clientId, brokers, logger) {
  await confluentKafkaProducer.initProducer({
    clientId,
    brokers,
    logger
  });

  return await confluentKafkaProducer.sendBatch(
    topic,
    [
      {
        key: message && message.mountName ? String(message.mountName) : null,
        value: typeof message === "string" ? message : JSON.stringify(message)
      }
    ],
    logger
  );
}

module.exports = {
  readControlConstruct,
  getLogicalTerminationPointListAsync,
  getLogicalTerminationPointAsync,
  getOnfAttributes,
  getLayerProtocolEnum,
  getRemoteAddressAsync,
  getRemotePortAsync,
  getRemoteProtocolAsync,
  remoteAddressToHost,
  getEsClient,
  connectKafkaProducer,
  sendKafkaMessage
};