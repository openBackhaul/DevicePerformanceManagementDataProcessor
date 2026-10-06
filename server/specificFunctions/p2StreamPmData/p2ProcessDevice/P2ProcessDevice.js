"use strict";

const { findFunctionNode } = require("../../../utils/functionTree");
const p2LoadRawCc = require("./p2LoadRawCc/P2LoadRawCc");
const p2CreateResultCc = require("./p2CreateResultCc/P2CreateResultCc");
const p2Storing = require("./p2Storing/P2Storing");
const queueKafkaOutbound = require("../../../infra/kafka/queueKafkaOutbound");
const p1LoadOffsetsAndStatusData = require(
  "../../../genericFunctions/p1LoadOffsetsAndStatusData/P1LoadOffsetsAndStatusData"
);
const p2FormattingOutputOnf = require(
  "./p2FormattingOutputOnf/P2FormattingOutputOnf"
);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readProperty(object, ...propertyNames) {
  for (const propertyName of propertyNames) {
    if (object && Object.prototype.hasOwnProperty.call(object, propertyName)) {
      return object[propertyName];
    }
  }
  return undefined;
}

function createProcessingError(message, stage = "p2ProcessDevice", retryable = false, cause) {
  const error = new Error(message);
  error.stage = stage;
  error.retryable = retryable;
  if (cause) error.cause = cause;
  return error;
}

function getFunctionParameters(parameters, functionName) {
  return findFunctionNode(parameters, functionName) || {};
}

async function invoke(module, request) {
  if (typeof module === "function") return module(request);
  if (module && typeof module.run === "function") return module.run(request);
  throw createProcessingError("function implementation invalid");
}

function requireImplementation(implementation, functionName) {
  if (implementation) return implementation;
  throw createProcessingError(
    `${functionName} implementation not available`,
    functionName,
    false
  );
}

function validateRequest(request) {
  const parameters = readProperty(request, "parameters");
  const configFile = readProperty(request, "configFile", "config-file");
  const mountName = readProperty(request, "mountName", "mount-name");
  const mwdiReplicaEsClient = readProperty(
    request,
    "mwdiReplicaEsClient",
    "mwdi-replica-es-client"
  );
  const dataStoreEsClient = readProperty(
    request,
    "dataStoreEsClient",
    "data-store-es-client"
  );

  if (parameters == null) throw createProcessingError("parameters not provided");
  if (!isObject(parameters)) throw createProcessingError("parameters invalid");
  if (configFile == null) throw createProcessingError("configFile not provided");
  if (!isObject(configFile)) throw createProcessingError("configFile invalid");
  if (mountName == null) throw createProcessingError("mountName not provided");
  if (typeof mountName !== "string" || mountName.trim() === "") {
    throw createProcessingError("mountName invalid");
  }
  if (mwdiReplicaEsClient == null) {
    throw createProcessingError("mwdiReplicaEsClient not provided");
  }
  if (!isObject(mwdiReplicaEsClient)) {
    throw createProcessingError("mwdiReplicaEsClient invalid");
  }
  if (dataStoreEsClient == null) {
    throw createProcessingError("dataStoreEsClient not provided");
  }
  if (!isObject(dataStoreEsClient)) {
    throw createProcessingError("dataStoreEsClient invalid");
  }

  return {
    parameters,
    configFile,
    mountName: mountName.trim(),
    mwdiReplicaEsClient,
    dataStoreEsClient
  };
}

function validateLoadedProcessingData(response) {
  const statusData = response && (response["status-data"] || response.statusData);
  if (!response || !Array.isArray(response.offsets) || !Array.isArray(statusData)) {
    throw createProcessingError(
      "raw CC data missing or invalid",
      "p1LoadOffsetsAndStatusData"
    );
  }
  return { offsets: response.offsets, statusData };
}

function validateRawCcResponse(response) {
  const rawCc = response && (response["raw-cc"] || response.rawCc);
  const pmDataQuality = response && (
    response["device-pm-data-quality"] || response.devicePmDataQuality
  );
  if (!isObject(rawCc) || !Array.isArray(response.offsets) || !isObject(pmDataQuality)) {
    throw createProcessingError("raw CC data missing or invalid", "p2LoadRawCc");
  }
  return { rawCc, offsets: response.offsets, pmDataQuality };
}

function validateResultCcResponse(response) {
  const resultCc = response && (response["result-cc"] || response.resultCc);
  const statusData = response && (response["status-data"] || response.statusData);
  if (!isObject(resultCc) || !Array.isArray(statusData)) {
    throw createProcessingError("result CC data missing or invalid", "p2CreateResultCc");
  }
  return { resultCc, statusData };
}

async function createOutputFormats(input, resultCc) {
  const outputFormats = [];
  const aptFormatter = require(
    "../../p1StreamPmData/p1ProcessDevice/p1FormattingOutputApt/P1FormattingOutputApt"
  );
  const aptResponse = await invoke(aptFormatter, {
    parameters: getFunctionParameters(input.parameters, "p1FormattingOutputApt"),
    "result-cc": resultCc
  });
  if (aptResponse && aptResponse["output-format"]) {
    outputFormats.push({
      "format-name": aptResponse["format-name"] || "apt-output-format",
      "output-format": aptResponse["output-format"]
    });
  }

  const onfFormatter = requireImplementation(
    p2FormattingOutputOnf,
    "p2FormattingOutputOnf"
  );
  const onfResponse = await invoke(onfFormatter, {
        parameters: getFunctionParameters(input.parameters, "p2FormattingOutputOnf"),
        "result-cc": resultCc
  });
  const onfFormats = onfResponse && (
    onfResponse["onf-output-format"] || onfResponse.onfOutputFormat
  );
  if (Array.isArray(onfFormats)) outputFormats.push(...onfFormats);

  if (outputFormats.length === 0) {
    throw createProcessingError("output format missing or invalid", "p2FormattingOutputOnf");
  }
  return outputFormats;
}

function getActiveKafkaConsumers(kafkaConsumerTypes) {
  return String(kafkaConsumerTypes || "")
    .split(",")
    .map((consumer) => consumer.trim().toUpperCase())
    .filter(Boolean);
}

function findOutputPayload(outputFormats, formatName) {
  const format = outputFormats.find((candidate) =>
    String(candidate["format-name"] || "").toLowerCase().startsWith(formatName)
  );
  return format && format["output-format"];
}

function createKafkaMessages(outputFormats, mountName, kafkaConsumerTypes) {
  const aptPayload = findOutputPayload(outputFormats, "apt");
  const mycomPayload = findOutputPayload(outputFormats, "mycom");
  const netexplorerPayload = findOutputPayload(outputFormats, "netexplorer");
  const supportedConsumers = {
    APT: aptPayload,
    MYCOM: mycomPayload,
    NETEXPLORER: netexplorerPayload
  };

  return getActiveKafkaConsumers(kafkaConsumerTypes)
    .filter((targetConsumer) => supportedConsumers[targetConsumer] !== undefined)
    .map((targetConsumer) => ({
      targetConsumer,
      messageType: "PERFORMANCE_OUTPUT",
      mountName,
      payloadVersion: "1.1",
      payload: supportedConsumers[targetConsumer]
    }));
}

async function run(request = {}) {
  const input = validateRequest(request);

  try {
    const loadOffsetsAndStatusData = requireImplementation(
       p1LoadOffsetsAndStatusData,
      "p1LoadOffsetsAndStatusData"
    );
    const processingDataResponse = await invoke(loadOffsetsAndStatusData, {
        mountName: input.mountName,
        dataStoreEsClient: input.dataStoreEsClient,
        "mount-name": input.mountName,
        "data-store-es-client": input.dataStoreEsClient
    });
    const processingData = validateLoadedProcessingData(processingDataResponse);

    const rawCcResponse = await invoke(p2LoadRawCc, {
      parameters: getFunctionParameters(input.parameters, "p2LoadRawCc"),
      mountName: input.mountName,
      mwdiReplicaEsClient: input.mwdiReplicaEsClient,
      offsets: processingData.offsets,
      "mount-name": input.mountName,
      "mwdi-replica-es-client": input.mwdiReplicaEsClient
    });
    const rawData = validateRawCcResponse(rawCcResponse);

    const resultCcResponse = await invoke(
      p2CreateResultCc,
      {
        parameters: getFunctionParameters(input.parameters, "p2CreateResultCc"),
        rawCc: rawData.rawCc,
        statusData: processingData.statusData,
        mountName: input.mountName,
        "raw-cc": rawData.rawCc,
        "status-data": processingData.statusData
      }
    );
    const resultData = validateResultCcResponse(resultCcResponse);
    const outputFormats = await createOutputFormats(input, resultData.resultCc);

    const outboundQueue = queueKafkaOutbound;
    await invoke(outboundQueue, {
      dataStoreEsClient: input.dataStoreEsClient,
      logger: request.logger,
      outputs: request.outputMessages || createKafkaMessages(
        outputFormats,
        input.mountName,
        request.kafkaConsumerTypes
      )
    });

    await invoke(p2Storing, {
      parameters: getFunctionParameters(input.parameters, "p2Storing"),
      dataStoreEsClient: input.dataStoreEsClient,
      resultCc: resultData.resultCc,
      offsets: rawData.offsets,
      statusData: resultData.statusData,
      mountName: input.mountName,
      esClient: request.esClient,
      logger: request.logger,
      atomicDataStoreUpsertEnabled: request.storingOptions?.atomicDataStoreUpsertEnabled === true
    });

    return { "device-pm-data-quality": rawData.pmDataQuality };
  } catch (cause) {
    if (cause && cause.stage) throw cause;
    throw createProcessingError(
      "general processing error",
      "p2ProcessDevice",
      true,
      cause
    );
  }
}

module.exports = { run };
