const p1RemoveOutOfRangeTemperature = require("../../../../genericFunctions/p1RemoveOutOfRangeTemperature/P1RemoveOutOfRangeTemperature");
const { getParamFromFunction } = require("../../../../utils/functionTree");
const ERRORS_P1RemoveOutOfRangeTemperature = require("../../../../genericFunctions/p1RemoveOutOfRangeTemperature/ErrorsEnum");
const ERRORS_P1PrepareTxModes = require("./p1PrepareTxModes/ErrorsEnum");
const p1PrepareTxModes = require("./p1PrepareTxModes/P1PrepareTxModes.js");
const logger = require("../../../../service/LoggingService.js").getLogger();

/*
 * Vendor owned sub-functions.
 * These are optional here because Lot 3/4 vendor modules may be added later.
 * This file only integrates with them when they are available.
 */
const p1IterateAiPmSlices = optionalRequire("./p1IterateAiPmSlices/P1IterateAiPmSlices.js");
const p1IterateEcPmSlices = optionalRequire("./p1IterateEcPmSlices/P1IterateEcPmSlices.js");

const AIR_INTERFACE_PAC_KEY = "air-interface-2-0:air-interface-pac";
const AIR_INTERFACE_HIST_PERF_KEY = "air-interface-historical-performances";
const AIR_INTERFACE_CAPABILITY_KEY = "air-interface-capability";
const AIR_INTERFACE_CURRENT_PERF_KEY = "air-interface-current-performance";

const ETHERNET_CONTAINER_PAC_KEY = "ethernet-container-2-0:ethernet-container-pac";
const ETHERNET_CONTAINER_HIST_PERF_KEY = "ethernet-container-historical-performances";

const LTP_AUGMENT_PAC_KEY = "ltp-augment-1-0:ltp-augment-pac";
const HIST_PERF_DATA_LIST_KEY = "historical-performance-data-list";
const TRANSMISSION_MODE_LIST_KEY = "transmission-mode-list";

function optionalRequire(modulePath) {
  try {
    return require(modulePath);
  } catch (error) {
    return undefined;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null || value === "") {
    return [];
  }

  return [value];
}

function unique(values) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function getControlConstructRoot(rawCc) {
  if (!isPlainObject(rawCc)) {
    return rawCc;
  }

  return rawCc["core-model-1-4:control-construct"] || rawCc;
}

function getProfileCollection(rawCc) {
  const cc = getControlConstructRoot(rawCc);

  if (!isPlainObject(cc)) {
    return {};
  }

  return (
    cc["profile-collection"] ||
    cc["core-model-1-4:profile-collection"] ||
    {}
  );
}

function getProfileList(rawCc) {
  const profileCollection = getProfileCollection(rawCc);
  return Array.isArray(profileCollection.profile)
    ? profileCollection.profile
    : [];
}

function getLogicalTerminationPointList(rawCc) {
  const cc = getControlConstructRoot(rawCc);

  if (!isPlainObject(cc)) {
    return [];
  }

  return Array.isArray(cc["logical-termination-point"])
    ? cc["logical-termination-point"]
    : [];
}

function getEquipmentList(rawCc) {
  const cc = getControlConstructRoot(rawCc);

  if (!isPlainObject(cc)) {
    return [];
  }

  return Array.isArray(cc.equipment) ? cc.equipment : [];
}

function buildProcessingError(stage, message, retryable, details) {
  const error = new Error(message);

  error.stage = stage;
  error.retryable = retryable === true;

  if (details !== undefined) {
    error.details = details;
  }

  return error;
}

function validateRawCc(rawCc, stage) {
  if (rawCc === undefined || rawCc === null) {
    throw buildProcessingError(stage, "rawCc not provided", false);
  }

  if (!isPlainObject(rawCc)) {
    throw buildProcessingError(stage, "rawCc invalid", false);
  }
}

function validateParameters(parameters) {
  if (parameters === undefined || parameters === null) {
    throw buildProcessingError("p1CreateResultCc", "parameters not provided", false);
  }

  if (!isPlainObject(parameters) && !Array.isArray(parameters)) {
    throw buildProcessingError("p1CreateResultCc", "parameters invalid", false);
  }
}

function getRequestRawCc(request) {
  return request.rawCc || request["raw-cc"];
}

function getRemoveOutOfRangeTemperatureParameters(parameters) {
  const temperatureFunctionNode = getParamFromFunction(
    parameters,
    "p1RemoveOutOfRangeTemperature",
    "",
    [],
    true
  );

  if (!temperatureFunctionNode) {
    throw buildProcessingError(
      "p1RemoveOutOfRangeTemperature",
      "p1RemoveOutOfRangeTemperature parameters not found",
      false,
      { vendorResponse: "parameters not provided" }
    );
  }

  return temperatureFunctionNode;
}

function getSubFunctionParameters(parameters, functionName) {
  const functionNode = getParamFromFunction(
    parameters,
    functionName,
    "",
    undefined,
    true
  );

  return functionNode || {};
}

function isValidPrepareTxModesResponse(response) {
  return (
    response &&
    typeof response === "object" &&
    (
      Array.isArray(response[HIST_PERF_DATA_LIST_KEY]) ||
      Array.isArray(response.historicalPerformanceDataList) ||
      Array.isArray(response[TRANSMISSION_MODE_LIST_KEY]) ||
      Array.isArray(response.transmissionModeList)
    )
  );
}

function buildPrepareTxModesError(response, mountName) {
  const error = new Error(
    `p1PrepareTxModes returned error response: ${JSON.stringify(response)}`
  );

  error.stage = "p1PrepareTxModes";
  error.vendorResponse = response;
  error.mountName = mountName;

  if (
    response === ERRORS_P1PrepareTxModes.HIST_PERF_DATA_NOT_PROVIDED ||
    response === ERRORS_P1PrepareTxModes.HIST_PERF_DATA_INCOMPLETE ||
    response === ERRORS_P1PrepareTxModes.HIST_PERF_DATA_INVALID ||
    response === ERRORS_P1PrepareTxModes.TX_MODE_LIST_NOT_PROVIDED ||
    response === ERRORS_P1PrepareTxModes.TX_MODE_LIST_INCOMPLETE ||
    response === ERRORS_P1PrepareTxModes.TX_MODE_LIST_INVALID ||
    response === ERRORS_P1PrepareTxModes.HIST_PERF_DATA_COULD_NOT_BE_PROVIDED ||
    response === ERRORS_P1PrepareTxModes.TX_MODE_LIST_COULD_NOT_BE_PROVIDED
  ) {
    error.retryable = false;
  } else {
    error.retryable = true;
  }

  return error;
}

function isValidRemoveTemperatureResponse(response) {
  return (
    response &&
    typeof response === "object" &&
    Array.isArray(response.equipment)
  );
}

function buildRemoveTemperatureError(response, mountName) {
  const error = new Error(
    `p1RemoveOutOfRangeTemperature returned error response: ${JSON.stringify(response)}`
  );

  error.stage = "p1RemoveOutOfRangeTemperature";
  error.vendorResponse = response;
  error.mountName = mountName;

  if (
    response === ERRORS_P1RemoveOutOfRangeTemperature.PARAM_NOT_PROVIDED ||
    response === ERRORS_P1RemoveOutOfRangeTemperature.PARAM_INVALID ||
    response === ERRORS_P1RemoveOutOfRangeTemperature.EQUIP_NOT_PROVIDED ||
    response === ERRORS_P1RemoveOutOfRangeTemperature.EQUIP_INVALID
  ) {
    error.retryable = false;
  } else {
    error.retryable = true;
  }

  return error;
}

/*
 * Spec function:
 * createResultCcFromRawCc
 *
 * ResultCc is a bare copy of rawCc.
 */
function createResultCcFromRawCc(rawCc) {
  validateRawCc(rawCc, "createResultCcFromRawCc");

  try {
    return clone(rawCc);
  } catch (error) {
    throw buildProcessingError(
      "createResultCcFromRawCc",
      "resultCc could not be provided",
      false,
      error.message || error
    );
  }
}

function findLayer1AggregationPac(profile) {
  if (!isPlainObject(profile)) {
    return undefined;
  }

  const pacKey = Object.keys(profile).find((key) => {
    return String(key).includes("layer-1-aggregation-profile-pac");
  });

  return pacKey ? profile[pacKey] : undefined;
}

function findLayer1AggregationConfiguration(profile) {
  const pac = findLayer1AggregationPac(profile);

  if (!isPlainObject(pac)) {
    return undefined;
  }

  const configKey = Object.keys(pac).find((key) => {
    return String(key).includes("layer-1-aggregation-profile-configuration");
  });

  return configKey ? pac[configKey] : undefined;
}

function isLayer1AggregationProfile(profile) {
  if (!isPlainObject(profile)) {
    return false;
  }

  const profileName = String(profile["profile-name"] || "");

  return (
    profileName.includes("PROFILE_NAME_TYPE_LAYER_1_AGGREGATION_PROFILE") ||
    profileName.includes("layer-1-aggregation-profile") ||
    isPlainObject(findLayer1AggregationPac(profile))
  );
}

function stripMountPrefix(uuid) {
  const value = String(uuid || "").trim();
  const plusIndex = value.lastIndexOf("+");

  return plusIndex >= 0 ? value.substring(plusIndex + 1) : value;
}

function sameLtpReference(left, right) {
  const leftValue = String(left || "").trim();
  const rightValue = String(right || "").trim();

  if (!leftValue || !rightValue) {
    return false;
  }

  return (
    leftValue === rightValue ||
    stripMountPrefix(leftValue) === stripMountPrefix(rightValue)
  );
}

function hasReference(list, reference) {
  return (list || []).some((item) => sameLtpReference(item, reference));
}

function findLtpByReference(rawCc, reference) {
  return getLogicalTerminationPointList(rawCc).find((ltp) => {
    return sameLtpReference(ltp && ltp.uuid, reference);
  });
}

function isAirInterfaceLtp(ltp) {
  return (ltp["layer-protocol"] || []).some((layerProtocol) => {
    return (
      String(layerProtocol["layer-protocol-name"] || "").includes("air-interface") ||
      isPlainObject(layerProtocol[AIR_INTERFACE_PAC_KEY])
    );
  });
}

function isWireInterfaceLtp(ltp) {
  return (ltp["layer-protocol"] || []).some((layerProtocol) => {
    return String(layerProtocol["layer-protocol-name"] || "").includes("wire-interface");
  });
}

function getPhysicalServerLtpList(rawCc, serverLtpList) {
  const physicalServerLtpList = [];

  for (const structureLtpUuid of serverLtpList || []) {
    const structureLtp = findLtpByReference(rawCc, structureLtpUuid);

    if (!structureLtp) {
      continue;
    }

    for (const physicalServerLtpUuid of toArray(structureLtp["server-ltp"])) {
      /*
       * The specification says this list contains AirInterface and WireInterface
       * LTPs. If the physical LTP is present in rawCc, keep it only when it is
       * AirInterface or WireInterface. If it is not present because field
       * filtering removed it, keep the reference because it still came from the
       * structure LTP server-ltp relation.
       */
      const physicalLtp = findLtpByReference(rawCc, physicalServerLtpUuid);

      if (!physicalLtp || isAirInterfaceLtp(physicalLtp) || isWireInterfaceLtp(physicalLtp)) {
        physicalServerLtpList.push(physicalServerLtpUuid);
      }
    }
  }

  return unique(physicalServerLtpList);
}

/*
 * Spec function:
 * createAggregationGroupList
 */
function createAggregationGroupList(rawCc) {
  validateRawCc(rawCc, "createAggregationGroupList");

  try {
    const aggregationGroupList = [];

    for (const profile of getProfileList(rawCc)) {
      if (!isLayer1AggregationProfile(profile)) {
        continue;
      }

      const configuration = findLayer1AggregationConfiguration(profile);

      if (!isPlainObject(configuration)) {
        continue;
      }

      const clientLtp = String(configuration["client-ltp"] || "").trim();
      const serverLtpList = unique(toArray(configuration["server-ltp-list"]));

      aggregationGroupList.push({
        uuid: profile.uuid,
        "client-ltp": clientLtp,
        "server-ltp-list": serverLtpList,
        "physical-server-ltp-list": getPhysicalServerLtpList(rawCc, serverLtpList)
      });
    }

    return aggregationGroupList;
  } catch (error) {
    throw buildProcessingError(
      "createAggregationGroupList",
      "aggregationGroupList could not be provided",
      false,
      error.message || error
    );
  }
}

/*
 * Spec function:
 * substringLinkId
 */
function substringLinkId(input) {
  try {
    const linkEndpointId = isPlainObject(input)
      ? input["link-endpoint-id"]
      : input;

    if (linkEndpointId === undefined || linkEndpointId === null || linkEndpointId === "") {
      throw buildProcessingError("substringLinkId", "linkEndpointId not provided", false);
    }

    const normalized = String(linkEndpointId).trim();

    if (!/^[0-9]{9}[AB]$/.test(normalized)) {
      throw buildProcessingError(
        "substringLinkId",
        "linkEndpointId invalid",
        false,
        { linkEndpointId: normalized }
      );
    }

    return {
      "link-id": normalized.substring(0, 9)
    };
  } catch (error) {
    if (error.stage) {
      throw error;
    }

    throw buildProcessingError(
      "substringLinkId",
      "linkId could not be provided",
      false,
      error.message || error
    );
  }
}

/*
 * Spec function:
 * findParallelPhysic
 */
function findParallelPhysic(inputOrLtpUuid, maybeAggregationGroupList) {
  const ltpUuid = isPlainObject(inputOrLtpUuid)
    ? inputOrLtpUuid["ltp-uuid"]
    : inputOrLtpUuid;

  const aggregationGroupList = isPlainObject(inputOrLtpUuid)
    ? inputOrLtpUuid["aggregation-group-list"]
    : maybeAggregationGroupList;

  if (ltpUuid === undefined || ltpUuid === null || ltpUuid === "") {
    throw buildProcessingError("findParallelPhysic", "ltpUuid not provided", false);
  }

  if (typeof ltpUuid !== "string") {
    throw buildProcessingError("findParallelPhysic", "ltpUuid invalid", false);
  }

  if (!Array.isArray(aggregationGroupList)) {
    throw buildProcessingError("findParallelPhysic", "aggregationGroupList not provided", false);
  }

  try {
    const parallelPhysicalLtps = [];

    for (const aggregationGroup of aggregationGroupList) {
      if (!isPlainObject(aggregationGroup)) {
        throw buildProcessingError("findParallelPhysic", "aggregationGroupList invalid", false);
      }

      const physicalServerLtpList = aggregationGroup["physical-server-ltp-list"];

      if (!Array.isArray(physicalServerLtpList)) {
        throw buildProcessingError("findParallelPhysic", "aggregationGroupList invalid", false);
      }

      if (!hasReference(physicalServerLtpList, ltpUuid)) {
        continue;
      }

      for (const physicalLtpUuid of physicalServerLtpList) {
        if (!sameLtpReference(physicalLtpUuid, ltpUuid)) {
          parallelPhysicalLtps.push(physicalLtpUuid);
        }
      }
    }

    return {
      "physical-server-ltp-list": unique(parallelPhysicalLtps)
    };
  } catch (error) {
    if (error.stage) {
      throw error;
    }

    throw buildProcessingError(
      "findParallelPhysic",
      "General processing error",
      false,
      error.message || error
    );
  }
}

function getAirInterfacePac(layerProtocol) {
  if (!isPlainObject(layerProtocol)) {
    return undefined;
  }

  return layerProtocol[AIR_INTERFACE_PAC_KEY];
}

function getEthernetContainerPac(layerProtocol) {
  if (!isPlainObject(layerProtocol)) {
    return undefined;
  }

  return layerProtocol[ETHERNET_CONTAINER_PAC_KEY];
}

function getHistoricalPerformanceDataList(pac, historicalPerformanceKey) {
  if (!isPlainObject(pac)) {
    return [];
  }

  const historicalPerformances = pac[historicalPerformanceKey];

  if (Array.isArray(historicalPerformances)) {
    return historicalPerformances;
  }

  if (
    isPlainObject(historicalPerformances) &&
    Array.isArray(historicalPerformances[HIST_PERF_DATA_LIST_KEY])
  ) {
    return historicalPerformances[HIST_PERF_DATA_LIST_KEY];
  }

  return [];
}

function setHistoricalPerformanceDataList(pac, historicalPerformanceKey, historicalPerformanceDataList) {
  const existing = pac[historicalPerformanceKey];

  if (isPlainObject(existing) && !Array.isArray(existing)) {
    existing[HIST_PERF_DATA_LIST_KEY] = historicalPerformanceDataList;
    pac[historicalPerformanceKey] = existing;
    return;
  }

  pac[historicalPerformanceKey] = historicalPerformanceDataList;
}

function getTransmissionModeList(pac) {
  if (!isPlainObject(pac)) {
    return [];
  }

  const capability = pac[AIR_INTERFACE_CAPABILITY_KEY];

  if (!isPlainObject(capability)) {
    return [];
  }

  return Array.isArray(capability[TRANSMISSION_MODE_LIST_KEY])
    ? capability[TRANSMISSION_MODE_LIST_KEY]
    : [];
}

function setTransmissionModeList(pac, transmissionModeList) {
  if (!isPlainObject(pac[AIR_INTERFACE_CAPABILITY_KEY])) {
    pac[AIR_INTERFACE_CAPABILITY_KEY] = {};
  }

  pac[AIR_INTERFACE_CAPABILITY_KEY][TRANSMISSION_MODE_LIST_KEY] = transmissionModeList;
}

function getLinkEndpointId(ltp) {
  const augmentPac = ltp[LTP_AUGMENT_PAC_KEY];

  if (!isPlainObject(augmentPac)) {
    return "";
  }

  return augmentPac["external-label"] || "";
}

function getAggregationGroupForEthernetContainer(ltpUuid, aggregationGroupList) {
  return (aggregationGroupList || []).find((aggregationGroup) => {
    return sameLtpReference(aggregationGroup["client-ltp"], ltpUuid);
  });
}

function getMostRecentPeriodEndTimes(historicalPerformanceDataList) {
  let mostRecentPeriodEndTime = "";
  let mostRecentPeriodEndTime24 = "";

  for (const record of historicalPerformanceDataList || []) {
    if (!isPlainObject(record)) {
      continue;
    }

    const periodEndTime = record["period-end-time"];

    if (!periodEndTime) {
      continue;
    }

    const granularityPeriod = String(record["granularity-period"] || "");

    if (
      granularityPeriod.includes("PERIOD-15-MIN") &&
      (
        !mostRecentPeriodEndTime ||
        new Date(periodEndTime).getTime() > new Date(mostRecentPeriodEndTime).getTime()
      )
    ) {
      mostRecentPeriodEndTime = periodEndTime;
    }

    if (
      granularityPeriod.includes("PERIOD-24-HOURS") &&
      (
        !mostRecentPeriodEndTime24 ||
        new Date(periodEndTime).getTime() > new Date(mostRecentPeriodEndTime24).getTime()
      )
    ) {
      mostRecentPeriodEndTime24 = periodEndTime;
    }
  }

  return {
    mostRecentPeriodEndTime,
    mostRecentPeriodEndTime24
  };
}

async function callVendorFunction(vendorFunction, request) {
  if (!vendorFunction) {
    return undefined;
  }

  if (typeof vendorFunction === "function") {
    return await vendorFunction(request);
  }

  if (vendorFunction && typeof vendorFunction.run === "function") {
    return await vendorFunction.run(request);
  }

  return undefined;
}

function getResponseHistoricalPerformanceDataList(response, fallbackList) {
  if (!isPlainObject(response)) {
    return fallbackList;
  }

  return (
    response[HIST_PERF_DATA_LIST_KEY] ||
    response.historicalPerformanceDataList ||
    fallbackList
  );
}

function getResponseTransmissionModeList(response, fallbackList) {
  if (!isPlainObject(response)) {
    return fallbackList;
  }

  return (
    response[TRANSMISSION_MODE_LIST_KEY] ||
    response.transmissionModeList ||
    fallbackList
  );
}

function getResponseMostRecentTimes(response, fallbackList) {
  const derived = getMostRecentPeriodEndTimes(fallbackList);

  if (!isPlainObject(response)) {
    return derived;
  }

  return {
    mostRecentPeriodEndTime:
      response["most-recent-period-end-time"] ||
      response.mostRecentPeriodEndTime ||
      derived.mostRecentPeriodEndTime,
    mostRecentPeriodEndTime24:
      response["most-recent-period-end-time-24"] ||
      response.mostRecentPeriodEndTime24 ||
      derived.mostRecentPeriodEndTime24
  };
}

async function integrateP1PrepareTxModes(pac, mountName) {
  const historicalPerformanceDataList = getHistoricalPerformanceDataList(
    pac,
    AIR_INTERFACE_HIST_PERF_KEY
  );

  const transmissionModeList = getTransmissionModeList(pac);

  const response = await callVendorFunction(p1PrepareTxModes, {
    [HIST_PERF_DATA_LIST_KEY]: historicalPerformanceDataList,
    historicalPerformanceDataList,
    [TRANSMISSION_MODE_LIST_KEY]: transmissionModeList,
    transmissionModeList
  });

  if (response === undefined) {
    return {
      historicalPerformanceDataList,
      transmissionModeList
    };
  }

  if (!isValidPrepareTxModesResponse(response)) {
    throw buildPrepareTxModesError(response, mountName);
  }

  return {
    historicalPerformanceDataList: getResponseHistoricalPerformanceDataList(
      response,
      historicalPerformanceDataList
    ),
    transmissionModeList: getResponseTransmissionModeList(
      response,
      transmissionModeList
    )
  };
}

async function integrateP1IterateAiPmSlices(parameters, pac, transmissionModeList) {
  const historicalPerformanceDataList = getHistoricalPerformanceDataList(
    pac,
    AIR_INTERFACE_HIST_PERF_KEY
  );

  const iterateAiParameters = getSubFunctionParameters(
    parameters,
    "p1IterateAiPmSlices"
  );

  const response = await callVendorFunction(p1IterateAiPmSlices, {
    parameters: iterateAiParameters,
    [HIST_PERF_DATA_LIST_KEY]: historicalPerformanceDataList,
    historicalPerformanceDataList,
    [TRANSMISSION_MODE_LIST_KEY]: transmissionModeList,
    transmissionModeList
  });

  const finalHistoricalPerformanceDataList = getResponseHistoricalPerformanceDataList(
    response,
    historicalPerformanceDataList
  );

  const mostRecentTimes = getResponseMostRecentTimes(
    response,
    finalHistoricalPerformanceDataList
  );

  return {
    historicalPerformanceDataList: finalHistoricalPerformanceDataList,
    mostRecentPeriodEndTime: mostRecentTimes.mostRecentPeriodEndTime,
    mostRecentPeriodEndTime24: mostRecentTimes.mostRecentPeriodEndTime24
  };
}

async function integrateP1IterateEcPmSlices(parameters, pac, aggregationGroup, resultCc) {
  const historicalPerformanceDataList = getHistoricalPerformanceDataList(
    pac,
    ETHERNET_CONTAINER_HIST_PERF_KEY
  );

  const iterateEcParameters = getSubFunctionParameters(
    parameters,
    "p1IterateEcPmSlices"
  );

  const response = await callVendorFunction(p1IterateEcPmSlices, {
    parameters: iterateEcParameters,
    [HIST_PERF_DATA_LIST_KEY]: historicalPerformanceDataList,
    historicalPerformanceDataList,
    "aggregation-group": aggregationGroup || {},
    aggregationGroup: aggregationGroup || {},
    "result-cc": resultCc,
    resultCc
  });

  const finalHistoricalPerformanceDataList = getResponseHistoricalPerformanceDataList(
    response,
    historicalPerformanceDataList
  );

  const mostRecentTimes = getResponseMostRecentTimes(
    response,
    finalHistoricalPerformanceDataList
  );

  return {
    historicalPerformanceDataList: finalHistoricalPerformanceDataList,
    mostRecentPeriodEndTime: mostRecentTimes.mostRecentPeriodEndTime,
    mostRecentPeriodEndTime24: mostRecentTimes.mostRecentPeriodEndTime24
  };
}

function buildAirInterfaceMetadata(ltp, historicalPerformanceDataList, aggregationGroupList) {
  const linkEndpointId = getLinkEndpointId(ltp);
  let linkId = "";

  if (linkEndpointId) {
    linkId = substringLinkId({ "link-endpoint-id": linkEndpointId })["link-id"];
  }

  const parallelPhysicalLtpList = findParallelPhysic({
    "ltp-uuid": ltp.uuid,
    "aggregation-group-list": aggregationGroupList
  })["physical-server-ltp-list"];

  const mostRecentTimes = getMostRecentPeriodEndTimes(historicalPerformanceDataList);

  return {
    uuid: ltp.uuid,
    "ltp-uuid": ltp.uuid,
    linkId,
    "link-id": linkId,
    linkEndpointId,
    "link-endpoint-id": linkEndpointId,
    parallelPhysicalLtpList,
    "parallel-physical-ltp-list": parallelPhysicalLtpList,
    mostRecentPeriodEndTime: mostRecentTimes.mostRecentPeriodEndTime,
    "most-recent-period-end-time": mostRecentTimes.mostRecentPeriodEndTime,
    mostRecentPeriodEndTime24: mostRecentTimes.mostRecentPeriodEndTime24,
    "most-recent-period-end-time-24": mostRecentTimes.mostRecentPeriodEndTime24
  };
}

function buildEthernetContainerMetadata(ltp, historicalPerformanceDataList) {
  const mostRecentTimes = getMostRecentPeriodEndTimes(historicalPerformanceDataList);

  return {
    uuid: ltp.uuid,
    "ltp-uuid": ltp.uuid,
    mostRecentPeriodEndTime: mostRecentTimes.mostRecentPeriodEndTime,
    "most-recent-period-end-time": mostRecentTimes.mostRecentPeriodEndTime,
    mostRecentPeriodEndTime24: mostRecentTimes.mostRecentPeriodEndTime24,
    "most-recent-period-end-time-24": mostRecentTimes.mostRecentPeriodEndTime24
  };
}

async function processAirInterfaces(parameters, resultCc, aggregationGroupList, interfaceMetadataList, mountName) {
  for (const ltp of getLogicalTerminationPointList(resultCc)) {
    for (const layerProtocol of ltp["layer-protocol"] || []) {
      const pac = getAirInterfacePac(layerProtocol);

      if (!isPlainObject(pac)) {
        continue;
      }

      const prepareTxModesResult = await integrateP1PrepareTxModes(pac, mountName);

      setHistoricalPerformanceDataList(
        pac,
        AIR_INTERFACE_HIST_PERF_KEY,
        prepareTxModesResult.historicalPerformanceDataList
      );

      setTransmissionModeList(
        pac,
        prepareTxModesResult.transmissionModeList
      );

      const iterateAiResult = await integrateP1IterateAiPmSlices(
        parameters,
        pac,
        prepareTxModesResult.transmissionModeList
      );

      setHistoricalPerformanceDataList(
        pac,
        AIR_INTERFACE_HIST_PERF_KEY,
        iterateAiResult.historicalPerformanceDataList
      );

      const metadata = buildAirInterfaceMetadata(
        ltp,
        iterateAiResult.historicalPerformanceDataList,
        aggregationGroupList
      );

      metadata.mostRecentPeriodEndTime =
        iterateAiResult.mostRecentPeriodEndTime || metadata.mostRecentPeriodEndTime;
      metadata["most-recent-period-end-time"] = metadata.mostRecentPeriodEndTime;

      metadata.mostRecentPeriodEndTime24 =
        iterateAiResult.mostRecentPeriodEndTime24 || metadata.mostRecentPeriodEndTime24;
      metadata["most-recent-period-end-time-24"] = metadata.mostRecentPeriodEndTime24;

      interfaceMetadataList.push(metadata);
    }
  }
}

async function processEthernetContainers(parameters, resultCc, aggregationGroupList, interfaceMetadataList) {
  for (const ltp of getLogicalTerminationPointList(resultCc)) {
    for (const layerProtocol of ltp["layer-protocol"] || []) {
      const pac = getEthernetContainerPac(layerProtocol);

      if (!isPlainObject(pac)) {
        continue;
      }

      const aggregationGroup = getAggregationGroupForEthernetContainer(
        ltp.uuid,
        aggregationGroupList
      );

      const iterateEcResult = await integrateP1IterateEcPmSlices(
        parameters,
        pac,
        aggregationGroup,
        resultCc
      );

      setHistoricalPerformanceDataList(
        pac,
        ETHERNET_CONTAINER_HIST_PERF_KEY,
        iterateEcResult.historicalPerformanceDataList
      );

      const metadata = buildEthernetContainerMetadata(
        ltp,
        iterateEcResult.historicalPerformanceDataList
      );

      metadata.aggregationGroup = aggregationGroup || null;
      metadata["aggregation-group"] = aggregationGroup || null;

      metadata.mostRecentPeriodEndTime =
        iterateEcResult.mostRecentPeriodEndTime || metadata.mostRecentPeriodEndTime;
      metadata["most-recent-period-end-time"] = metadata.mostRecentPeriodEndTime;

      metadata.mostRecentPeriodEndTime24 =
        iterateEcResult.mostRecentPeriodEndTime24 || metadata.mostRecentPeriodEndTime24;
      metadata["most-recent-period-end-time-24"] = metadata.mostRecentPeriodEndTime24;

      interfaceMetadataList.push(metadata);
    }
  }
}

async function applyP1RemoveOutOfRangeTemperature(parameters, resultCc, mountName) {
  const equipment = getEquipmentList(resultCc);

  const response = await callVendorFunction(p1RemoveOutOfRangeTemperature, {
    equipment,
    parameters: {
      parameter: getRemoveOutOfRangeTemperatureParameters(parameters)
    }
  });

  if (!isValidRemoveTemperatureResponse(response)) {
    if (logger && logger.error) {
      logger.error(
        {
          label: "p1-remove-out-of-range-temperature-error",
          mountName,
          vendorResponse: response
        },
        "p1RemoveOutOfRangeTemperature returned an error response"
      );
    }

    throw buildRemoveTemperatureError(response, mountName);
  }

  getControlConstructRoot(resultCc).equipment = response.equipment;
}

/**
 * Request:
 * {
 *   parameters,
 *   rawCc
 * }
 *
 * Response:
 * {
 *   resultCc,
 *   interfaceMetadataList
 * }
 */
async function run(request) {
  const mountName = request && request.mountName;

  try {
    if (!request || !isPlainObject(request)) {
      throw buildProcessingError("p1CreateResultCc", "General processing error", false);
    }

    const parameters = request.parameters;
    const rawCc = getRequestRawCc(request);

    validateParameters(parameters);
    validateRawCc(rawCc, "p1CreateResultCc");

    const resultCc = createResultCcFromRawCc(rawCc);
    const aggregationGroupList = createAggregationGroupList(rawCc);
    const interfaceMetadataList = [];

    await processAirInterfaces(
      parameters,
      resultCc,
      aggregationGroupList,
      interfaceMetadataList,
      mountName
    );

    await processEthernetContainers(
      parameters,
      resultCc,
      aggregationGroupList,
      interfaceMetadataList
    );

    await applyP1RemoveOutOfRangeTemperature(
      parameters,
      resultCc,
      mountName
    );

    return {
      resultCc,
      interfaceMetadataList,
      aggregationGroupList,
      mountName,

      /*
       * Specification style aliases.
       */
      "result-cc": resultCc,
      "interface-metadata-list": interfaceMetadataList,
      "aggregation-group-list": aggregationGroupList
    };
  } catch (error) {
    if (!error.stage) {
      error.stage = "p1CreateResultCc";
    }

    logger.error(
      {
        label: "process-device-p1CreateResultCc",
        mountName,
        stage: error.stage,
        retryable: error.retryable,
        details: error.details,
        error: error.message || error
      },
      "Failed to process device in p1CreateResultCc"
    );

    throw error;
  }
}

module.exports = {
  run,

  /*
   * Exported for function-level unit testing as per specification.
   */
  createResultCcFromRawCc,
  createAggregationGroupList,
  substringLinkId,
  findParallelPhysic
};
