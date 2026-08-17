const p1RemoveOutOfRangeTemperature = require("../../../../genericFunctions/p1RemoveOutOfRangeTemperature/P1RemoveOutOfRangeTemperature");
const { getParamFromFunction, findFunctionNode } = require("../../../../utils/functionTree");
const ERRORS_P1RemoveOutOfRangeTemperature = require("../../../../genericFunctions/p1RemoveOutOfRangeTemperature/ErrorsEnum");
const ERRORS_P1PrepareTxModes = {};
const ERRORS_P1IterateAiPmSlices = {};
const ERRORS_P1IterateEcPmSlices = {};
let logger = console;
try { logger = require("../../../../service/LoggingService.js").getLogger(); } catch (_) {}

// Enable these imports after the corresponding source files are delivered.
// const p2PrepareTxModes = require("./p2PrepareTxModes/P2PrepareTxModes");
// const p2IterateAiPmSlices = require("./p2IterateAiPmSlices/P2IterateAiPmSlices");
// const p2IterateEcPmSlices = require("./p2IterateEcPmSlices/P2IterateEcPmSlices");

/*
 * Processing sub-functions delivered as separate source modules.
 */

const AIR_INTERFACE_PAC_KEY = "air-interface-2-0:air-interface-pac";
const AIR_INTERFACE_HIST_PERF_KEY = "air-interface-historical-performances";
const AIR_INTERFACE_CAPABILITY_KEY = "air-interface-capability";
const AIR_INTERFACE_CURRENT_PERF_KEY = "air-interface-current-performance";

const ETHERNET_CONTAINER_PAC_KEY = "ethernet-container-2-0:ethernet-container-pac";
const ETHERNET_CONTAINER_HIST_PERF_KEY = "ethernet-container-historical-performances";

const LTP_AUGMENT_PAC_KEY = "ltp-augment-1-0:ltp-augment-pac";
const HIST_PERF_DATA_LIST_KEY = "historical-performance-data-list";

function isFunctionActive(parameters, functionName) {
  const node = findFunctionNode(parameters, functionName);
  return Boolean(node && node["is-active"] === true);
}
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
    throw buildProcessingError("p2CreateResultCc", "parameters not provided", false);
  }

  if (!isPlainObject(parameters) && !Array.isArray(parameters)) {
    throw buildProcessingError("p2CreateResultCc", "parameters invalid", false);
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
      { functionResponse: "parameters not provided" }
    );
  }

  return temperatureFunctionNode;
}

function getSubFunctionParameters(parameters, functionName) {
  const functionNode = findFunctionNode(
    parameters,
    functionName
  );

  return functionNode || {};
}

function isValidPrepareTxModesResponse(response) {
  return (
    response &&
    typeof response === "object" &&
    (
      Array.isArray(response[HIST_PERF_DATA_LIST_KEY]) ||
      //Array.isArray(response.historicalPerformanceDataList) ||
      Array.isArray(response[TRANSMISSION_MODE_LIST_KEY])
      //Array.isArray(response.transmissionModeList)
    )
  );
}

function buildPrepareTxModesError(response, mountName) {
  const error = new Error(
    `p2PrepareTxModes returned error response: ${JSON.stringify(response)}`
  );

  error.stage = "p2PrepareTxModes";
  error.functionResponse = response;
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
  error.functionResponse = response;
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
  const references = list instanceof Set || Array.isArray(list)
    ? list
    : toArray(list);

  for (const item of references) {
    if (sameLtpReference(item, reference)) {
      return true;
    }
  }

  return false;
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

function isEthernetContainerLtp(ltp) {
  return (ltp["layer-protocol"] || []).some((layerProtocol) => {
    return (
      String(layerProtocol["layer-protocol-name"] || "").includes("ethernet-container") ||
      isPlainObject(layerProtocol[ETHERNET_CONTAINER_PAC_KEY])
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
      const errLinkIdInvalid = buildProcessingError("substringLinkId", "linkEndpointId not provided", false);
      logger.error(errLinkIdInvalid.message);
    }

    //linkEndpointId = `${linkEndpointId}A`; // Append dummy character to pass validation for 9 digits followed by A or B
    const normalized = String(linkEndpointId).trim();

    if (!/^[0-9]{9}[AB]$/.test(normalized) || normalized.length < 9 || normalized.length > 10) {
      const errLinkIdRegex = buildProcessingError(
        "substringLinkId",
        "linkEndpointId invalid",
        false,
        { linkEndpointId: normalized }
      );
      logger.error(errLinkIdRegex.message);
    }

    return {
      "link-id": normalized.substring(0, 9)
    };
  } catch (error) {
    if (error.stage) {
      //throw error;
      logger.error(error.message || error.stage);
    }

   /* throw buildProcessingError(
      "substringLinkId",
      "linkId could not be provided",
      false,
      error.message || error
    );*/

    const errLinkIdCatchBlock =  buildProcessingError(
      "substringLinkId",
      "linkId could not be provided",
      false,
      error.message || error
    );

    logger.error(errLinkIdCatchBlock.details);

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
    return undefined;
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

  return undefined;
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
    return undefined;
  }

  const capability = pac[AIR_INTERFACE_CAPABILITY_KEY];

  if (!isPlainObject(capability)) {
    return undefined;
  }

  return Array.isArray(capability[TRANSMISSION_MODE_LIST_KEY])
    ? capability[TRANSMISSION_MODE_LIST_KEY]
    : undefined;
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

async function callFunction(functionImplementation, request) {
  if (!functionImplementation) {
    return undefined;
  }

  if (typeof functionImplementation === "function") {
    return await functionImplementation(request);
  }

  if (typeof functionImplementation.run === "function") {
    return await functionImplementation.run(request);
  }

  return undefined;
}

function requireImplementation(implementation, functionName) {
  if (implementation) return implementation;
  const error = new Error(`${functionName} implementation not available`);
  error.stage = functionName;
  error.retryable = false;
  throw error;
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

function isValidIterateAiPmSlicesResponse(response) {
  return (
    response &&
    typeof response === "object" &&
    Array.isArray(response[HIST_PERF_DATA_LIST_KEY])
  );
}

function isValidIterateEcPmSlicesResponse(response) {
  return (
    response &&
    typeof response === "object" &&
    Array.isArray(response[HIST_PERF_DATA_LIST_KEY])
  );
}

function buildIterateAiPmSlicesError(response, mountName) {
  const error = new Error(
    `p2IterateAiPmSlices returned error response: ${JSON.stringify(response)}`
  );

  error.stage = "p2IterateAiPmSlices";
  error.functionResponse = response;
  error.mountName = mountName;

  if (
    response === ERRORS_P1IterateAiPmSlices.PARAMETERS_NOT_PROVIDED ||
    response === ERRORS_P1IterateAiPmSlices.PARAMETERS_INVALID ||
    response === ERRORS_P1IterateAiPmSlices.HISTORICAL_DATA_LIST_NOT_PROVIDED ||
    response === ERRORS_P1IterateAiPmSlices.HISTORICAL_DATA_LIST_INVALID ||
    response === ERRORS_P1IterateAiPmSlices.TRANSMISSION_MODE_LIST_NOT_PROVIDED ||
    response === ERRORS_P1IterateAiPmSlices.TRANSMISSION_MODE_LIST_INVALID ||
    response === ERRORS_P1IterateAiPmSlices.HISTORICAL_DATA_LIST_PROVIDE_ERROR ||
    response === ERRORS_P1IterateAiPmSlices.MOST_RECENT_END_TIME_PROVIDE_ERROR ||
    response === ERRORS_P1IterateAiPmSlices.MOST_RECENT_END_TIME_24_PROVIDE_ERROR ||
    response === ERRORS_P1IterateAiPmSlices.GRANULARITY_PERIOD_NOT_PROVIDED ||
    response === ERRORS_P1IterateAiPmSlices.GRANULARITY_PERIOD_INVALID ||
    response === ERRORS_P1IterateAiPmSlices.PERIOD_END_TIME_NOT_PROVIDED ||
    response === ERRORS_P1IterateAiPmSlices.PERIOD_END_TIME_INVALID
  ) {
    error.retryable = false;
  } else {
    error.retryable = true;
  }

  return error;
}

function buildIterateEcPmSlicesError(response, mountName) {
  const error = new Error(
    `p2IterateEcPmSlices returned error response: ${JSON.stringify(response)}`
  );

  error.stage = "p2IterateEcPmSlices";
  error.functionResponse = response;
  error.mountName = mountName;

  if (
    response === ERRORS_P1IterateEcPmSlices.PARAMETERS_NOT_PROVIDED ||
    response === ERRORS_P1IterateEcPmSlices.PARAMETERS_INVALID ||
    response === ERRORS_P1IterateEcPmSlices.HISTORICAL_DATA_LIST_NOT_PROVIDED ||
    response === ERRORS_P1IterateEcPmSlices.HISTORICAL_DATA_LIST_INVALID ||
    response === ERRORS_P1IterateEcPmSlices.KPI_CALCULATION_FAILED ||
    response === ERRORS_P1IterateEcPmSlices.DEFAULT_VALUES_REMOVAL_FAILED ||
    response === ERRORS_P1IterateEcPmSlices.UTILIZATION_CALCULATION_FAILED ||
    response === ERRORS_P1IterateEcPmSlices.HISTORICAL_DATA_LIST_OUTPUT_FAILED ||
    response === ERRORS_P1IterateEcPmSlices.MOST_RECENT_PERIOD_END_TIME_FAILED ||
    response === ERRORS_P1IterateEcPmSlices.MOST_RECENT_PERIOD_END_TIME_24_FAILED ||
    response === ERRORS_P1IterateEcPmSlices.MOST_RECENT_PERIOD_END_TIME_NOT_PROVIDED ||
    response === ERRORS_P1IterateEcPmSlices.MOST_RECENT_PERIOD_END_TIME_INVALID ||
    response === ERRORS_P1IterateEcPmSlices.MOST_RECENT_PERIOD_END_TIME_24_NOT_PROVIDED ||
    response === ERRORS_P1IterateEcPmSlices.MOST_RECENT_PERIOD_END_TIME_24_INVALID ||
    response === ERRORS_P1IterateEcPmSlices.GRAN_PERIOD_NOT_PROV ||
    response === ERRORS_P1IterateEcPmSlices.GRAN_PERIOD_INVALID ||
    response === ERRORS_P1IterateEcPmSlices.PERIOD_ENDTIME_NOT_PROVIDED ||
    response === ERRORS_P1IterateEcPmSlices.PERIOD_ENDTIME_INVALID
  ) {
    error.retryable = false;
  } else {
    error.retryable = true;
  }

  return error;
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

async function integrateP1PrepareTxModes(pac, mountName, dependencies) {
  const historicalPerformanceDataList = getHistoricalPerformanceDataList(
    pac,
    AIR_INTERFACE_HIST_PERF_KEY
  );

  const transmissionModeList = getTransmissionModeList(pac);

  const prepareTxModes = requireImplementation(
    dependencies.p2PrepareTxModes,
    "p2PrepareTxModes"
  );
  const response = await callFunction(prepareTxModes, {
    [HIST_PERF_DATA_LIST_KEY]: historicalPerformanceDataList,
    //historicalPerformanceDataList,
    [TRANSMISSION_MODE_LIST_KEY]: transmissionModeList
    //transmissionModeList
  });

  /* if (response === undefined) {
    return {
      historicalPerformanceDataList,
      transmissionModeList
    };
  } */

  if (!isValidPrepareTxModesResponse(response)) {
    logger.error(buildPrepareTxModesError(response, mountName).message);
    return null;
    //throw buildPrepareTxModesError(response, mountName);
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

async function integrateP1IterateAiPmSlices(parameters, pac, transmissionModeList, mountName, dependencies) {
  const historicalPerformanceDataList = getHistoricalPerformanceDataList(
    pac,
    AIR_INTERFACE_HIST_PERF_KEY
  );

  const iterateAiParameters = getSubFunctionParameters(
    parameters,
    "p2IterateAiPmSlices"
  );

  const iterateAiPmSlices = requireImplementation(
    dependencies.p2IterateAiPmSlices,
    "p2IterateAiPmSlices"
  );
  const response = await callFunction(iterateAiPmSlices, {
    parameters: iterateAiParameters,
    [HIST_PERF_DATA_LIST_KEY]: historicalPerformanceDataList,
    //historicalPerformanceDataList,
    [TRANSMISSION_MODE_LIST_KEY]: transmissionModeList,
    //transmissionModeList
  });

  if (!isValidIterateAiPmSlicesResponse(response)) {
    logger.error(buildIterateAiPmSlicesError(response, mountName).message);
    return null;
  }

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

async function integrateP1IterateEcPmSlices(parameters, pac, aggregationGroup, resultCc, mountName, interfaceStatus, uuid, dependencies) {
  const historicalPerformanceDataList = getHistoricalPerformanceDataList(
    pac,
    ETHERNET_CONTAINER_HIST_PERF_KEY
  );

  const iterateEcParameters = getSubFunctionParameters(
    parameters,
    "p2IterateEcPmSlices"
  );

  //console.log("parameters: ",JSON.stringify(iterateEcParameters));
  //console.log("historical-performance-data-list: ",JSON.stringify(historicalPerformanceDataList));
  //console.log("aggregation-group: ",JSON.stringify(aggregationGroup));
  
  const iterateEcPmSlices = requireImplementation(
    dependencies.p2IterateEcPmSlices,
    "p2IterateEcPmSlices"
  );
  const response = await callFunction(iterateEcPmSlices, {
    parameters: iterateEcParameters,
    [HIST_PERF_DATA_LIST_KEY]: historicalPerformanceDataList,
    historicalPerformanceDataList,
    "aggregation-group": aggregationGroup || {},
    aggregationGroup: aggregationGroup || {},
    "result-cc": resultCc,
    resultCc,
    "interface-status": interfaceStatus,
    "uuid-of-ethernet-container": uuid
  });

  if (!isValidIterateEcPmSlicesResponse(response)) {
    logger.error(buildIterateEcPmSlicesError(response, mountName).message);
    return null;
  }

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
    mostRecentPeriodEndTime24: mostRecentTimes.mostRecentPeriodEndTime24,
    interfaceStatus: response["interface-status"] || response.interfaceStatus || interfaceStatus
  };
}

function getLayerProtocolName(layerProtocol, fallback) {
  return String((layerProtocol && layerProtocol["layer-protocol-name"]) || fallback || "");
}

function hasOutputValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function setInterfaceMetadataPeriodEndTimes(metadata, mostRecentPeriodEndTime, mostRecentPeriodEndTime24) {
  if (hasOutputValue(mostRecentPeriodEndTime)) {
    metadata["most-recent-period-end-time"] = mostRecentPeriodEndTime;
  } else {
    delete metadata["most-recent-period-end-time"];
  }

  if (hasOutputValue(mostRecentPeriodEndTime24)) {
    metadata["most-recent-period-end-time-24"] = mostRecentPeriodEndTime24;
  } else {
    delete metadata["most-recent-period-end-time-24"];
  }
}

function buildAirInterfaceDerivedFields(ltp, aggregationGroupList) {
  const linkEndpointId = getLinkEndpointId(ltp);
  const linkId = linkEndpointId
    ? substringLinkId({ "link-endpoint-id": linkEndpointId })["link-id"]
    : "";
  const parallelPhysicalLtpList = findParallelPhysic({
    "ltp-uuid": ltp.uuid,
    "aggregation-group-list": aggregationGroupList
  })["physical-server-ltp-list"];

  return {
    linkId,
    parallelPhysicalLtpList
  };
}

function setAirInterfaceDerivedFields(ltp, derivedFields) {
  if (derivedFields.linkId) {
    if (!isPlainObject(ltp[LTP_AUGMENT_PAC_KEY])) {
      ltp[LTP_AUGMENT_PAC_KEY] = {};
    }

    ltp[LTP_AUGMENT_PAC_KEY]["link-id"] = derivedFields.linkId;
  }

  if (Array.isArray(derivedFields.parallelPhysicalLtpList)) {
    ltp["parallel-ltp"] = derivedFields.parallelPhysicalLtpList;
  }
}

function createInterfaceProcessingStatus() {
  return {
    attempted: 0,
    succeeded: 0,
    failed: 0
  };
}

function recordInterfaceFailure(status, ltpUuid) {
  status.failed += 1;

  if (!status.failedLtpUuidSet) {
    status.failedLtpUuidSet = new Set();
  }

  status.failedLtpUuidSet.add(String(ltpUuid || "").trim());
}

function recordInterfaceSuccess(status, ltpUuid) {
  status.succeeded += 1;

  if (!status.successfulLtpUuidSet) {
    status.successfulLtpUuidSet = new Set();
  }

  status.successfulLtpUuidSet.add(String(ltpUuid || "").trim());
}

function getInterfaceProcessingStatusSummary(status) {
  return {
    attempted: status.attempted,
    succeeded: status.succeeded,
    failed: status.failed
  };
}

function buildNoSuccessfulInterfaceProcessingError(airInterfaceStatus, ethernetContainerStatus) {
  return buildProcessingError(
    "p2CreateResultCc",
    "No AirInterface or EthernetContainer processing succeeded",
    false,
    {
      airInterface: getInterfaceProcessingStatusSummary(airInterfaceStatus),
      ethernetContainer: getInterfaceProcessingStatusSummary(ethernetContainerStatus)
    }
  );
}

function assertAnyInterfaceProcessingSucceeded(airInterfaceStatus, ethernetContainerStatus) {
  const attempted =
    airInterfaceStatus.attempted + ethernetContainerStatus.attempted;
  const succeeded =
    airInterfaceStatus.succeeded + ethernetContainerStatus.succeeded;

  if (attempted > 0 && succeeded === 0) {
    /*throw buildNoSuccessfulInterfaceProcessingError(
      airInterfaceStatus,
      ethernetContainerStatus
    );*/
    logger.error(buildNoSuccessfulInterfaceProcessingError(
          airInterfaceStatus,
          ethernetContainerStatus
      ).details);
  }
}

function mergeLtpUuidSets(firstSet, secondSet) {
  const mergedSet = new Set();

  if (firstSet) {
    for (const ltpUuid of firstSet) {
      mergedSet.add(ltpUuid);
    }
  }

  if (secondSet) {
    for (const ltpUuid of secondSet) {
      mergedSet.add(ltpUuid);
    }
  }

  return mergedSet;
}

function pruneFailedProcessedInterfaceLtps(resultCc, airInterfaceStatus, ethernetContainerStatus, mountName) {
  const failed =
    airInterfaceStatus.failed + ethernetContainerStatus.failed;

  if (failed === 0) {
    return 0;
  }

  const root = getControlConstructRoot(resultCc);
  const logicalTerminationPointList = getLogicalTerminationPointList(resultCc);

  if (!isPlainObject(root) || !Array.isArray(logicalTerminationPointList)) {
    return 0;
  }

  const successfulLtpUuidSet = mergeLtpUuidSets(
    airInterfaceStatus.successfulLtpUuidSet,
    ethernetContainerStatus.successfulLtpUuidSet
  );
  const failedLtpUuidSet = mergeLtpUuidSets(
    airInterfaceStatus.failedLtpUuidSet,
    ethernetContainerStatus.failedLtpUuidSet
  );
  let prunedLtpCount = 0;

  root["logical-termination-point"] = logicalTerminationPointList.filter((ltp) => {
    if (!isPlainObject(ltp) || !hasReference(failedLtpUuidSet, ltp.uuid)) {
      return true;
    }

    if (hasReference(successfulLtpUuidSet, ltp.uuid)) {
      return true;
    }

    if (!isAirInterfaceLtp(ltp) && !isEthernetContainerLtp(ltp)) {
      return true;
    }

    prunedLtpCount += 1;
    return false;
  });

  if (prunedLtpCount > 0) {
    /* Enable locally when debugging pruned interface UUIDs.
    logger.warn(
      {
        label: "p1-create-result-cc-pruned-failed-interfaces",
        mountName,
        prunedLtpCount
      },
      "Pruned failed AirInterface/EthernetContainer LTPs from resultCc"
    ); */
  }

  return prunedLtpCount;
}

function buildAirInterfaceMetadata(ltp, layerProtocol, historicalPerformanceDataList) {
  const mostRecentTimes = getMostRecentPeriodEndTimes(historicalPerformanceDataList);
  const metadata = {
    uuid: ltp.uuid,
    "layer-protocol-name": getLayerProtocolName(
      layerProtocol,
      "air-interface-2-0:LAYER_PROTOCOL_NAME_TYPE_AIR_LAYER"
    )
  };

  setInterfaceMetadataPeriodEndTimes(
    metadata,
    mostRecentTimes.mostRecentPeriodEndTime,
    mostRecentTimes.mostRecentPeriodEndTime24
  );

  return metadata;
}

function buildEthernetContainerMetadata(ltp, layerProtocol, historicalPerformanceDataList) {
  const mostRecentTimes = getMostRecentPeriodEndTimes(historicalPerformanceDataList);
  const metadata = {
    uuid: ltp.uuid,
    "layer-protocol-name": getLayerProtocolName(
      layerProtocol,
      "ethernet-container-2-0:LAYER_PROTOCOL_NAME_TYPE_ETHERNET_CONTAINER_LAYER"
    )
  };

  setInterfaceMetadataPeriodEndTimes(
    metadata,
    mostRecentTimes.mostRecentPeriodEndTime,
    mostRecentTimes.mostRecentPeriodEndTime24
  );

  return metadata;
}

async function processAirInterfaces(parameters, resultCc, aggregationGroupList, interfaceMetadataList, mountName, dependencies) {
  const status = createInterfaceProcessingStatus();

  for (const ltp of getLogicalTerminationPointList(resultCc)) {
    for (const layerProtocol of ltp["layer-protocol"] || []) {
      const pac = getAirInterfacePac(layerProtocol);

      if (!isPlainObject(pac)) {
        continue;
      }

      status.attempted += 1;
      const prepareTxModesResult = isFunctionActive(parameters, "p2PrepareTxModes")
        ? await integrateP1PrepareTxModes(pac, mountName, dependencies)
        : {
            historicalPerformanceDataList: getHistoricalPerformanceDataList(pac, AIR_INTERFACE_HIST_PERF_KEY),
            transmissionModeList: getTransmissionModeList(pac)
          };

      if(prepareTxModesResult === null) {
        //recordInterfaceFailure(status, ltp.uuid);
        continue;
      }

      setHistoricalPerformanceDataList(
        pac,
        AIR_INTERFACE_HIST_PERF_KEY,
        prepareTxModesResult.historicalPerformanceDataList
      );

      setTransmissionModeList(
        pac,
        prepareTxModesResult.transmissionModeList
      );

      const iterateAiResult = isFunctionActive(parameters, "p2IterateAiPmSlices")
        ? await integrateP1IterateAiPmSlices(
            parameters, pac, prepareTxModesResult.transmissionModeList, mountName, dependencies
          )
        : { historicalPerformanceDataList: getHistoricalPerformanceDataList(pac, AIR_INTERFACE_HIST_PERF_KEY) };

      if (iterateAiResult === null) {
        //recordInterfaceFailure(status, ltp.uuid);
        continue;
      }

      setHistoricalPerformanceDataList(
        pac,
        AIR_INTERFACE_HIST_PERF_KEY,
        iterateAiResult.historicalPerformanceDataList
      );
      
      const derivedFields = buildAirInterfaceDerivedFields(
        ltp,
        aggregationGroupList
      );
      setAirInterfaceDerivedFields(ltp, derivedFields);

      const metadata = buildAirInterfaceMetadata(
        ltp,
        layerProtocol,
        iterateAiResult.historicalPerformanceDataList
      );

      setInterfaceMetadataPeriodEndTimes(
        metadata,
        iterateAiResult.mostRecentPeriodEndTime || metadata["most-recent-period-end-time"],
        iterateAiResult.mostRecentPeriodEndTime24 || metadata["most-recent-period-end-time-24"]
      );
      interfaceMetadataList.push(metadata);
      //recordInterfaceSuccess(status, ltp.uuid);
    }
  }

  return status;
}

async function processEthernetContainers(parameters, resultCc, aggregationGroupList, interfaceMetadataList, mountName, statusData, dependencies) {
  const status = createInterfaceProcessingStatus();
  let statusEntry = statusData.find((x) => x && x["function-name"] === "p2IterateEcPmSlices");
  if (!statusEntry) { statusEntry = { "function-name": "p2IterateEcPmSlices", status: { "interface-status": [] } }; statusData.push(statusEntry); }
  statusEntry.status = isPlainObject(statusEntry.status) ? statusEntry.status : {};
  statusEntry.status["interface-status"] = Array.isArray(statusEntry.status["interface-status"]) ? statusEntry.status["interface-status"] : [];

  for (const ltp of getLogicalTerminationPointList(resultCc)) {
    for (const layerProtocol of ltp["layer-protocol"] || []) {
      const pac = getEthernetContainerPac(layerProtocol);

      if (!isPlainObject(pac)) {
        continue;
      }

      status.attempted += 1;
      const aggregationGroup = getAggregationGroupForEthernetContainer(
        ltp.uuid,
        aggregationGroupList
      );

      const existingInterfaceStatus = statusEntry.status["interface-status"].find((x) => x && x.uuid === ltp.uuid) || { uuid: ltp.uuid };
      const iterateEcResult = isFunctionActive(parameters, "p2IterateEcPmSlices") ? await integrateP1IterateEcPmSlices(
        parameters,
        pac,
        aggregationGroup,
        resultCc,
        mountName,
        existingInterfaceStatus,
        ltp.uuid,
        dependencies
      ) : { historicalPerformanceDataList: getHistoricalPerformanceDataList(pac, ETHERNET_CONTAINER_HIST_PERF_KEY), interfaceStatus: existingInterfaceStatus };

      if (iterateEcResult === null) {
        //recordInterfaceFailure(status, ltp.uuid);
        continue;
      }

      setHistoricalPerformanceDataList(
        pac,
        ETHERNET_CONTAINER_HIST_PERF_KEY,
        iterateEcResult.historicalPerformanceDataList
      );
      const newInterfaceStatus = iterateEcResult.interfaceStatus;
      const statusIndex = statusEntry.status["interface-status"].findIndex((x) => x && x.uuid === ltp.uuid);
      if (statusIndex >= 0) statusEntry.status["interface-status"][statusIndex] = newInterfaceStatus;
      else statusEntry.status["interface-status"].push(newInterfaceStatus);

      const metadata = buildEthernetContainerMetadata(
        ltp,
        layerProtocol,
        iterateEcResult.historicalPerformanceDataList
      );

      setInterfaceMetadataPeriodEndTimes(
        metadata,
        iterateEcResult.mostRecentPeriodEndTime || metadata["most-recent-period-end-time"],
        iterateEcResult.mostRecentPeriodEndTime24 || metadata["most-recent-period-end-time-24"]
      );

      interfaceMetadataList.push(metadata);
      //recordInterfaceSuccess(status, ltp.uuid);
    }
  }

  return status;
}

async function applyP1RemoveOutOfRangeTemperature(parameters, resultCc, mountName) {
  const equipment = getEquipmentList(resultCc);

  const response = await callFunction(p1RemoveOutOfRangeTemperature, {
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
          functionResponse: response
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
      throw buildProcessingError("p2CreateResultCc", "General processing error", false);
    }

    const parameters = request.parameters;
    const rawCc = getRequestRawCc(request);
    const statusData = request["status-data"] || request.statusData;

    validateParameters(parameters);
    validateRawCc(rawCc, "p2CreateResultCc");
    if (statusData === undefined || statusData === null) throw buildProcessingError("p2CreateResultCc", "statusData not provided", false);
    if (!Array.isArray(statusData)) throw buildProcessingError("p2CreateResultCc", "statusData invalid", false);
    const updatedStatusData = structuredClone(statusData);

    const resultCc = createResultCcFromRawCc(rawCc);
    const aggregationGroupList = createAggregationGroupList(rawCc);
    const interfaceMetadataList = [];
    

    const airInterfaceStatus = await processAirInterfaces(
      parameters,
      resultCc,
      aggregationGroupList,
      interfaceMetadataList,
      mountName,
      request.dependencies || {}
    );

    //console.log("aggregation-group-list: ",JSON.stringify(aggregationGroupList));

    /* console.log("#-----------------------------------------------------------------------");
    console.log(`#                          Started - ${mountName}                       `);
    console.log("#-----------------------------------------------------------------------");
    const iterateEcParameters = getSubFunctionParameters(
      parameters,
      "p1IterateEcPmSlices"
    );
    console.log("parameters: ",JSON.stringify(iterateEcParameters)); */

    const ethernetContainerStatus = await processEthernetContainers(
      parameters,
      resultCc,
      aggregationGroupList,
      interfaceMetadataList,
      mountName,
      updatedStatusData,
      request.dependencies || {}
    );

    /* assertAnyInterfaceProcessingSucceeded(
      airInterfaceStatus,
      ethernetContainerStatus
    );

    pruneFailedProcessedInterfaceLtps(
      resultCc,
      airInterfaceStatus,
      ethernetContainerStatus,
      mountName
    ); */

    /* console.log("result-cc: ",JSON.stringify(resultCc));

    console.log("#-----------------------------------------------------------------------");
    console.log(`#                          Ended - ${mountName}                         `);
    console.log("#-----------------------------------------------------------------------"); */

    if (isFunctionActive(parameters, "p1RemoveOutOfRangeTemperature")) {
      await applyP1RemoveOutOfRangeTemperature(parameters, resultCc, mountName);
    }

    const response = {
      "result-cc": resultCc,
      "status-data": updatedStatusData,
      "interface-metadata-list": interfaceMetadataList,
      "aggregation-group-list": aggregationGroupList,
      mountName
    };

    Object.defineProperties(response, {
      resultCc: {
        value: resultCc,
        enumerable: false,
        configurable: true,
        writable: true
      },
      interfaceMetadataList: {
        value: interfaceMetadataList,
        enumerable: false,
        configurable: true,
        writable: true
      },
      aggregationGroupList: {
        value: aggregationGroupList,
        enumerable: false,
        configurable: true,
        writable: true
      }
    });

    return response;
  } catch (error) {
    if (!error.stage) {
      error.stage = "p2CreateResultCc";
    }

    logger.error(
      {
        label: "process-device-p2CreateResultCc",
        mountName,
        stage: error.stage,
        retryable: error.retryable,
        // details: error.details, // Enable locally when debugging verbose error details.
        error: error.message || error
      },
      "Failed to process device in p2CreateResultCc"
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
