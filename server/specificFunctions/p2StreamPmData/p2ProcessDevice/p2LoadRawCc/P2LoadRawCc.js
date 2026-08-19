"use strict";

const { getParamFromFunction } = require("../../../../utils/functionTree");
const p1FieldsFilter = require("../../../../genericFunctions/p1FieldsFilter/P1FieldsFilter");
const p2DiscardIrrelevantPmRecords = require(
  "../../../../genericFunctions/p2DiscardIrrelevantPmRecords/P2DiscardIrrelevantPmRecords"
);
const p1CalculateInterfacePmDataQuality = require(
    "../../../../genericFunctions/p1CalculateInterfacePmDataQuality/P1CalculateInterfacePmDataQuality"
  );


const INITIAL_PERIOD_END_TIME = "2010-11-20T14:00:00+01:00";
const LOAD_RAW_CC_FUNCTION_NAME = "p2LoadRawCc";

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

function createProcessingError(message, stage = LOAD_RAW_CC_FUNCTION_NAME, retryable = false, cause) {
  const error = new Error(message);
  error.stage = stage;
  error.retryable = retryable;
  if (cause) error.cause = cause;
  return error;
}

async function invoke(module, request) {
  if (typeof module === "function") return module(request);
  if (module && typeof module.run === "function") return module.run(request);
  throw createProcessingError("function implementation invalid");
}

function validateRequest(request) {
  const parameters = readProperty(request, "parameters");
  const mwdiReplicaEsClient = readProperty(
    request,
    "mwdiReplicaEsClient",
    "mwdi-replica-es-client"
  );
  const mountName = readProperty(request, "mountName", "mount-name");
  const offsets = readProperty(request, "offsets");

  if (parameters == null) throw createProcessingError("parameters not provided");
  if (!isObject(parameters)) throw createProcessingError("parameters invalid");
  if (mwdiReplicaEsClient == null) {
    throw createProcessingError("mwdiReplicaEsClient not provided");
  }
  if (
    !isObject(mwdiReplicaEsClient) ||
    !mwdiReplicaEsClient.uuid ||
    !mwdiReplicaEsClient["index-alias"]
  ) {
    throw createProcessingError("mwdiReplicaEsClient invalid");
  }
  if (mountName == null) throw createProcessingError("mountName not provided");
  if (typeof mountName !== "string" || mountName.trim() === "") {
    throw createProcessingError("mountName invalid");
  }
  if (offsets == null) throw createProcessingError("offsets not provided");
  if (!Array.isArray(offsets)) throw createProcessingError("offsets invalid");

  return {
    parameters,
    mwdiReplicaEsClient,
    mountName: mountName.trim(),
    offsets
  };
}

function unwrapElasticsearchSource(response) {
  if (response && response.body && response.body._source) return response.body._source;
  if (response && response._source) return response._source;
  return response || {};
}

function extractControlConstruct(response, mountName) {
  const source = unwrapElasticsearchSource(response);
  const controlConstruct = source["core-model-1-4:control-construct"];

  if (!Array.isArray(controlConstruct)) return controlConstruct || undefined;

  return controlConstruct.find((item) => (
    item && (item.uuid === mountName || item["mount-name"] === mountName)
  )) || controlConstruct[0];
}

function getOrCreateLoadRawCcOffset(offsets) {
  let functionOffset = offsets.find((item) => (
    item && item["function-name"] === LOAD_RAW_CC_FUNCTION_NAME
  ));

  if (!functionOffset) {
    functionOffset = {
      "function-name": LOAD_RAW_CC_FUNCTION_NAME,
      offset: { "interface-offsets": [] }
    };
    offsets.push(functionOffset);
  }

  if (!isObject(functionOffset.offset)) functionOffset.offset = {};
  if (!Array.isArray(functionOffset.offset["interface-offsets"])) {
    functionOffset.offset["interface-offsets"] = [];
  }
  return functionOffset;
}

function getOrCreateInterfaceOffset(functionOffset, uuid) {
  const interfaceOffsets = functionOffset.offset["interface-offsets"];
  let interfaceOffset = interfaceOffsets.find((item) => item.uuid === uuid);

  if (!interfaceOffset) {
    interfaceOffset = {
      uuid,
      "most-recent-period-end-time": INITIAL_PERIOD_END_TIME,
      "most-recent-period-end-time-24": INITIAL_PERIOD_END_TIME
    };
    interfaceOffsets.push(interfaceOffset);
  }
  return interfaceOffset;
}

function findHistoricalPerformanceContainer(layerProtocol) {
  const airInterfacePac = layerProtocol["air-interface-2-0:air-interface-pac"];
  if (airInterfacePac && airInterfacePac["air-interface-historical-performances"]) {
    return airInterfacePac["air-interface-historical-performances"];
  }

  const ethernetContainerPac = layerProtocol[
    "ethernet-container-2-0:ethernet-container-pac"
  ];
  if (
    ethernetContainerPac &&
    ethernetContainerPac["ethernet-container-historical-performances"]
  ) {
    return ethernetContainerPac["ethernet-container-historical-performances"];
  }
  return undefined;
}

function updateBatchTimestamp(rawCc) {
  let latestTimestamp;
  if (rawCc["batch-timestamp"]) latestTimestamp = Date.parse(rawCc["batch-timestamp"]);

  for (const ltp of rawCc["logical-termination-point"] || []) {
    for (const layerProtocol of ltp["layer-protocol"] || []) {
      const currentPerformanceList = layerProtocol[
        "air-interface-2-0:air-interface-pac"
      ]?.["air-interface-current-performance"]?.["current-performance-data-list"] || [];

      for (const currentPerformance of currentPerformanceList) {
        const timestamp = Date.parse(currentPerformance.timestamp);
        if (Number.isFinite(timestamp)) {
          latestTimestamp = latestTimestamp === undefined ? timestamp : Math.max(latestTimestamp, timestamp);
        }
      }
    }
  }
  if (Number.isFinite(latestTimestamp)) {
    rawCc["batch-timestamp"] = new Date(latestTimestamp).toISOString();
  }
}

async function readControlConstruct(input, request) {
  try {
    const replicaClient = request.replicaClient || await require(
      "../../../../infra/onf/onfAdapter"
    ).getEsClient(
      false,
      input.mwdiReplicaEsClient.uuid,
      input.mwdiReplicaEsClient,
      request.logger
    );
    const response = await replicaClient.get({
      index: input.mwdiReplicaEsClient["index-alias"],
      id: input.mountName
    });
    return extractControlConstruct(response, input.mountName);
  } catch (cause) {
    throw createProcessingError(
      "rawCc could not be provided",
      LOAD_RAW_CC_FUNCTION_NAME,
      true,
      cause
    );
  }
}

async function applyRawCcFieldsFilter(rawCc, parameters, dependencies) {
  const filterString = getParamFromFunction(
    parameters,
    "p1FieldsFilter",
    "raw-cc",
    getParamFromFunction(parameters, "p1FieldsFilter", "fieldsFilter", "")
  );
  if (!filterString) return rawCc;

  const response = await invoke(dependencies.p1FieldsFilter || p1FieldsFilter, {
    dataStructure: rawCc,
    fieldsFilterString: filterString,
    "data-structure": rawCc,
    "fields-filter-string": filterString
  });
  const filteredRawCc = response && (
    response["filtered-data-structure"] || response.filteredDataStructure
  );
  if (!isObject(filteredRawCc)) {
    throw createProcessingError("rawCc could not be provided", "p1FieldsFilter");
  }
  return filteredRawCc;
}

async function processInterface(
  ltp,
  layerProtocol,
  functionOffset,
  devicePmDataQuality,
  dependencies
) {
  const historyContainer = findHistoricalPerformanceContainer(layerProtocol);
  const historyList = historyContainer && historyContainer[
    "historical-performance-data-list"
  ];
  if (!Array.isArray(historyList)) return;

  const interfaceOffset = getOrCreateInterfaceOffset(functionOffset, ltp.uuid);
  const formerPeriodEndTime = interfaceOffset[
    "most-recent-period-end-time"
  ] || INITIAL_PERIOD_END_TIME;
  const formerPeriodEndTime24 = interfaceOffset[
    "most-recent-period-end-time-24"
  ] || INITIAL_PERIOD_END_TIME;

  const discardFunction = dependencies.p2DiscardIrrelevantPmRecords ||
    p2DiscardIrrelevantPmRecords;
  const discardResponse = await invoke(discardFunction, {
      "historical-performance-data-list": historyList,
      "former-most-recent-period-end-time": formerPeriodEndTime,
      "former-most-recent-period-end-time-24": formerPeriodEndTime24
  });

  historyContainer["historical-performance-data-list"] = discardResponse[
    "filtered-historical-performance-data-list"
  ];
  interfaceOffset["most-recent-period-end-time"] = discardResponse[
    "new-most-recent-period-end-time"
  ];
  interfaceOffset["most-recent-period-end-time-24"] = discardResponse[
    "new-most-recent-period-end-time-24"
  ];

  const calculatePmDataQuality = dependencies.p1CalculateInterfacePmDataQuality ||
    p1CalculateInterfacePmDataQuality;
  const qualityResponse = await invoke(calculatePmDataQuality, {
      uuid: ltp.uuid,
      "former-most-recent-period-end-time": formerPeriodEndTime,
      "new-most-recent-period-end-time": interfaceOffset[
        "most-recent-period-end-time"
      ],
      "amount-received": discardResponse["amount-received"]
  });
  const interfacePmDataQuality = qualityResponse && qualityResponse[
    "interface-pm-data-quality"
  ];
  if (!isObject(interfacePmDataQuality)) {
    throw createProcessingError(
      "pmDataQuality could not be provided",
      "p1CalculateInterfacePmDataQuality"
    );
  }
  devicePmDataQuality.interface.push(interfacePmDataQuality);
}

async function run(request = {}) {
  const input = validateRequest(request);
  const dependencies = request.dependencies || {};
  const updatedOffsets = structuredClone(input.offsets);
  const functionOffset = getOrCreateLoadRawCcOffset(updatedOffsets);

  let rawCc = await readControlConstruct(input, request);
  if (!isObject(rawCc)) {
    throw createProcessingError("rawCc could not be provided");
  }
  rawCc = await applyRawCcFieldsFilter(rawCc, input.parameters, dependencies);

  const devicePmDataQuality = {
    "mount-name": input.mountName,
    interface: []
  };
  for (const ltp of rawCc["logical-termination-point"] || []) {
    for (const layerProtocol of ltp["layer-protocol"] || []) {
      await processInterface(
        ltp,
        layerProtocol,
        functionOffset,
        devicePmDataQuality,
        dependencies
      );
    }
  }

  updateBatchTimestamp(rawCc);
  return {
    "raw-cc": rawCc,
    offsets: updatedOffsets,
    "device-pm-data-quality": devicePmDataQuality
  };
}

module.exports = { run };
