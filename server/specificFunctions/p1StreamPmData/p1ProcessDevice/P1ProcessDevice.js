const p1LoadRawCc = require("./p1LoadRawCc/P1LoadRawCc");
const p1CreateResultCc = require("./p1CreateResultCc/P1CreateResultCc");
const redisQueueKafkaOutbound = require("../../../infra/kafka/queueKafkaOutbound");
const p1Storing = require("./p1Storing/P1Storing");
const { findFunctionNode } = require("../../../utils/functionTree.js");
const logger = require('../../../service/LoggingService.js').getLogger();
const ERRORS = require('./ErrorsEnum');
const formatAptOutputErrors = require('./p1FormattingOutputApt/ErrorsEnum');
const p1FormattingOutputApt = require("./p1FormattingOutputApt/P1FormattingOutputApt");
const formatOnfOutputErrors = require('./p1FormattingOutputOnf/ErrorsEnum');
const p1FormattingOutputOnf = require("./p1FormattingOutputOnf/P1FormattingOutputOnf");
const fs = require("fs");
const sampleResultCcApt = require("./outputAPTSample.json");
const sampleResultCcOnf = require("./outputOnfSample.json");

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getRequestValue(request, ...keys) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return undefined;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(request, key)) {
      return request[key];
    }
  }

  return undefined;
}

function buildProcessingError(message, stage = "p1ProcessDevice", details, cause) {
  const error = new Error(message);
  error.stage = stage;

  if (details) {
    error.details = details;
  }

  if (cause) {
    error.cause = cause;
  }

  return error;
}

function validateRequest(request) {
  const mountName = getRequestValue(request, "mountName", "mount-name");
  const parameters = getRequestValue(request, "parameters");
  const configFile = getRequestValue(request, "configFile", "config-file");
  const mwdiReplicaEsClient = getRequestValue(
    request,
    "mwdiReplicaEsClient",
    "mwdi-replica-es-client"
  );
  const dataStoreEsClient = getRequestValue(
    request,
    "dataStoreEsClient",
    "data-store-es-client"
  );

  if (
    !request ||
    typeof request !== "object" ||
    Array.isArray(request)
  ) {
    throw buildProcessingError(ERRORS.INPUT_DATA_MISSING_OR_INVALID);
  }

  if (!mountName || typeof mountName !== "string" || mountName.trim() === "") {
    throw buildProcessingError(ERRORS.MOUNT_NAME_NOT_FOUND);
  }

  if (!parameters || !isPlainObject(parameters)) {
    throw buildProcessingError(ERRORS.PARAMETERS_MISSING_OR_INVALID);
  }

  if (!configFile || !isPlainObject(configFile)) {
    throw buildProcessingError(ERRORS.CONFIG_FILE_MISSING_OR_INVALID);
  }

  if (!mwdiReplicaEsClient || !isPlainObject(mwdiReplicaEsClient)) {
    throw buildProcessingError(ERRORS.INPUT_DATA_MISSING_OR_INVALID);
  }

  if (!dataStoreEsClient || !isPlainObject(dataStoreEsClient)) {
    throw buildProcessingError(ERRORS.INPUT_DATA_MISSING_OR_INVALID);
  }

  return {
    mountName,
    parameters,
    configFile,
    mwdiReplicaEsClient,
    dataStoreEsClient
  };
}

function buildTopLevelError(error, mountName) {
  if (error && typeof error === "object" && error.message) {
    const message = String(error.message);

    if (ERRORS.knownErrors.has(message)) {
      const normalizedError = buildProcessingError(message, error.stage || "p1ProcessDevice", {
        vendorResponse: error.vendorResponse,
        originalError: error
      }, error);
      normalizedError.retryable = error.retryable;
      normalizedError.vendorResponse = error.vendorResponse;
      return normalizedError;
    }

    const normalized = message.toLowerCase();

    if (normalized.includes("parameter")) {
      return buildProcessingError(ERRORS.PARAMETERS_MISSING_OR_INVALID, error.stage || "p1ProcessDevice", {
        vendorResponse: error.vendorResponse,
        originalError: error
      });
    }

    if (normalized.includes("config")) {
      return buildProcessingError(ERRORS.CONFIG_FILE_MISSING_OR_INVALID, error.stage || "p1ProcessDevice", {
        vendorResponse: error.vendorResponse,
        originalError: error
      });
    }

    if (normalized.includes("rawcc") || normalized.includes("raw cc")) {
      return buildProcessingError(ERRORS.RAW_CC_DATA_MISSING_OR_INVALID, error.stage || "p1ProcessDevice", {
        vendorResponse: error.vendorResponse,
        originalError: error
      });
    }

    if (
      normalized.includes("resultcc") ||
      normalized.includes("result cc") ||
      normalized.includes("result-cc")
    ) {
      return buildProcessingError(ERRORS.RESULT_CC_DATA_MISSING_OR_INVALID, error.stage || "p1ProcessDevice", {
        vendorResponse: error.vendorResponse,
        originalError: error
      });
    }

    if (normalized.includes("output") || normalized.includes("format")) {
      return buildProcessingError(ERRORS.OUTPUT_FORMAT_MISSING_OR_INVALID, error.stage || "p1ProcessDevice", {
        vendorResponse: error.vendorResponse,
        originalError: error
      });
    }

    if (
      normalized.includes("kafka") ||
      normalized.includes("producer") ||
      normalized.includes("transmission")
    ) {
      return buildProcessingError(ERRORS.KAFKA_TRANSMISSION_FAILED, error.stage || "p1ProcessDevice", {
        vendorResponse: error.vendorResponse,
        originalError: error
      });
    }

    if (normalized.includes("storing") || normalized.includes("store")) {
      return buildProcessingError(ERRORS.STORING_RESULT_CC_FAILED, error.stage || "p1ProcessDevice", {
        vendorResponse: error.vendorResponse,
        originalError: error
      });
    }
  }

  const normalizedError = buildProcessingError(ERRORS.GENERAL_PROCESSING_ERROR, error?.stage || "p1ProcessDevice", {
    mountName,
    originalError: error
  }, error instanceof Error ? error : undefined);
  normalizedError.retryable = error?.retryable;
  normalizedError.vendorResponse = error?.vendorResponse;
  return normalizedError;
}

function getTargetConsumers(kafkaConsumerTypes) {
  return String(
    //global.DPMDP_KAFKA_TARGET_CONSUMERS ||
      kafkaConsumerTypes
  )
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
}

function shouldPublishDataQuality() {
  return String(global.DPMDP_ENABLE_DATAQUALITY_TOPIC || "true") === "true";
}

async function queueKafkaOutputsOneByOne(request) {
  const {
    mountName,
    aptPayload,
    onfPayload,
    correlationId,
    dataStoreEsClient,
    logger,
    kafkaConsumerTypes
  } = request;

  for (const targetConsumer of getTargetConsumers(kafkaConsumerTypes)) {
    await redisQueueKafkaOutbound.run({
      dataStoreEsClient,
      output: {
        targetConsumer,
        messageType: "PERFORMANCE_OUTPUT",
        mountName,
        correlationId,
        payloadVersion: "1.0",
        payload: (targetConsumer === "APT") ? aptPayload : onfPayload
      },
      logger
    });
  }

  /* if (shouldPublishDataQuality()) {
    await redisQueueKafkaOutbound.run({
      dataStoreEsClient,
      output: {
        targetConsumer: "DATAQUALITY",
        messageType: "DATA_QUALITY_RESULT",
        mountName,
        correlationId,
        payloadVersion: "1.0",
        payload: {
          qualityStatus: "PASSED",
          checks: [
            {
              checkName: "dpmmp-processing-completed",
              status: "PASSED"
            }
          ]
        }
      },
      logger
    });
  } */
}

/**
 * Request:
 * {
 *   mountName,
 *   parameters,
 *   configFile,
 *   mwdiReplicaEsClient,
 *   dataStoreEsClient,
 *   logger
 * }
 *
 * Response:
 * {
 *   resultCc,
 *   interfaceMetadataList
 * }
 */
async function run(request) {
  let validation;

  try {
    validation = validateRequest(request);
  } catch (error) {
    throw buildTopLevelError(error, getRequestValue(request, "mountName", "mount-name"));
  }

  const {
    mountName,
    parameters,
    configFile,
    mwdiReplicaEsClient,
    dataStoreEsClient
  } = validation;
  const kafkaConsumerTypes = getRequestValue(request, "kafkaConsumerTypes", "kafka-consumer-types");

  //const logger = request.logger || console;
  let createResultCcResponse = null;

  try {
    const p1LoadRawCcParameters = findFunctionNode(parameters, "p1LoadRawCc");
    const p1CreateResultCcParameters = findFunctionNode(parameters, "p1CreateResultCc");
    const p1FormattingOutputAptParameters = findFunctionNode(parameters, "p1FormattingOutputApt");
    const p1FormattingOutputOnfParameters = findFunctionNode(parameters, "p1FormattingOutputOnf");

    const loadRawCcResponse = await p1LoadRawCc.run({
      mountName,
      parameters: p1LoadRawCcParameters,
      mwdiReplicaEsClient,
      dataStoreEsClient,
      logger
    });

    createResultCcResponse = await p1CreateResultCc.run({
      parameters: p1CreateResultCcParameters,
      rawCc: loadRawCcResponse.rawCc,
      mountName: loadRawCcResponse.mountName || mountName,
      logger
    });

    /*
       P1FormattingOutputApt is an APT function that formats the output result CC according to the target consumer's requirements. 
       It also performs some basic validations on the result CC. If the formatting fails or the result CC is invalid, 
       it returns an error response with details about the error.
    */

    if (!p1FormattingOutputAptParameters || !createResultCcResponse || !createResultCcResponse.resultCc) {
      logger.error(
          {
            label: "invalid-input for-formatting-output-apt", 
            mountName
          },
          "Invalid input: parameters and resultCc are mandatory for p1FormattingOutputApt"
        );
      throw new Error("parameters and resultCc are mandatory for p1FormattingOutputApt");
    }

    
    const responseApt = await p1FormattingOutputApt({
        "result-cc": createResultCcResponse.resultCc,
        parameters: p1FormattingOutputAptParameters
    });

    if (!isValidFormattedOutputAptResponse(responseApt)) {
        if (logger && logger.error) {
            logger.error(
            {
                label: "p1-formatting-output-apt-error",
                mountName,
                vendorResponse: responseApt
            },
            "p1FormattingOutputApt returned an error response"
            );
        }

        throw buildFormattingOutputAptError(responseApt, mountName);
    }

    function isValidFormattedOutputAptResponse(response) {
        return (
            response &&
            typeof response === "object" &&
            response["output-format"]
        );
    }

    function buildFormattingOutputAptError(response, mountName) {
        const error = new Error(
            `p1FormattingOutputApt returned error response: ${JSON.stringify(response)}`
        );

        error.stage = "p1FormattingOutputApt";
        error.vendorResponse = response;
        error.mountName = mountName;

        if (
            response === formatAptOutputErrors.RESULTCC_NOT_PROVIDED ||
            response === formatAptOutputErrors.RESULTCC_INCOMPLETE ||
            response === formatAptOutputErrors.RESULTCC_INVALID ||
            response === formatAptOutputErrors.OUTPUT_COULD_NOT_BE_PROVIDED ||
            response === formatAptOutputErrors.GENERAL_ERROR
        ) {
            error.retryable = false;
        } else {
            error.retryable = true;
        }

        return error;
    }

    const resultCcApt = responseApt["output-format"];//sampleResultCcApt;//

    /*   P1FormattingOutputOnf is an ONF function that formats the output result CC according to the ONF output format. 
        It also performs some basic validations on the result CC. If the formatting fails or the result CC is invalid, 
        it returns an error response with details about the error.
    */

    if (!p1FormattingOutputOnfParameters || !createResultCcResponse || !createResultCcResponse.resultCc) {
      logger.error(
          {
            label: "invalid-input for-formatting-output-onf", 
            mountName
          },
          "Invalid input: parameters and resultCc are mandatory for p1FormattingOutputOnf"
        );
      throw new Error("parameters and resultCc are mandatory for p1FormattingOutputOnf");
    }

    
    const responseOnf = await p1FormattingOutputOnf({
        'result-cc': createResultCcResponse.resultCc,
        parameters: p1FormattingOutputOnfParameters
    });

    if (!isValidFormattedOutputOnfResponse(responseOnf)) {
        if (logger && logger.error) {
            logger.error(
            {
                label: "p1-formatting-output-onf-error",
                mountName,
                vendorResponse: responseOnf
            },
            "p1FormattingOutputOnf returned an error response"
            );
        }

        throw buildFormattingOutputOnfError(responseOnf, mountName);
    } 

    function isValidFormattedOutputOnfResponse(response) {
        return (
            response &&
            typeof response === "object" &&
            response["output-format"]
        );
    }

    function buildFormattingOutputOnfError(response, mountName) {
        const error = new Error(
            `p1FormattingOutputOnf returned error response: ${JSON.stringify(response)}`
        );

        error.stage = "p1FormattingOutputOnf";
        error.vendorResponse = response;
        error.mountName = mountName;

        if (
            response === formatOnfOutputErrors.PARAMETERS_NOT_PROVIDED ||
            response === formatOnfOutputErrors.PARAMETERS_INVALID ||
            response === formatOnfOutputErrors.RESULT_CC_NOT_PROVIDED ||
            response === formatOnfOutputErrors.RESULT_CC_INVALID ||
            response === formatOnfOutputErrors.ONF_OUTPUT_FORMAT ||
            response === formatOnfOutputErrors.GENERAL_ERROR ||
            response === formatOnfOutputErrors.OUTPUT_COULD_NOT_BE_PROVIDED ||
            response === formatOnfOutputErrors.FILTER_INVALID
        ) {
            error.retryable = false;
        } else {
            error.retryable = true;
        }

        return error;
    }

    const resultCcOnf = responseOnf["output-format"];//sampleResultCcOnf;//

   const resultMountName =
      createResultCcResponse.mountName ||
      loadRawCcResponse.mountName ||
      mountName;

    const correlationId = `dpmdp-${resultMountName}-${Date.now()}`;

    /* function loadJsonToField(filePath) {
      const fileContent = fs.readFileSync(filePath, "utf8");
      const outputObject = JSON.parse(fileContent);
      return outputObject;
    }

    const sampleOutputResultCcApt = loadJsonToField("./outputAPTSample.json"); */

    await queueKafkaOutputsOneByOne({
        mountName: resultMountName,
        aptPayload: resultCcApt,
        onfPayload: resultCcOnf,
        correlationId,
        dataStoreEsClient,
        logger: request.logger,
        kafkaConsumerTypes
    }); 

    await p1Storing.run({
      dataStoreEsClient,
      resultCc: createResultCcResponse.resultCc,
      interfaceMetadataList: createResultCcResponse.interfaceMetadataList,
      mountName: resultMountName,
      logger
    });

    return {
      resultCc: createResultCcResponse.resultCc,
      interfaceMetadataList: createResultCcResponse.interfaceMetadataList
    };
  } catch (error) {
    logger.error(
      {
        label: "p1-process-device",
        mountName,
        error: error.message || error
      },
      "Failed to process device"
    );

    const normalizedError = buildTopLevelError(error, mountName);

    normalizedError.mountName = mountName;
    normalizedError.retryable = normalizedError.retryable ?? error.retryable;
    normalizedError.vendorResponse = normalizedError.vendorResponse ?? error.vendorResponse;
    throw normalizedError;
  }
}

module.exports = { run };
