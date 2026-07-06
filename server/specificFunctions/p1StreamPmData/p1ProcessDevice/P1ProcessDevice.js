const p1LoadRawCc = require("./p1LoadRawCc/P1LoadRawCc");
const p1CreateResultCc = require("./p1CreateResultCc/P1CreateResultCc");
const redisQueueKafkaOutbound = require("../../../infra/kafka/queueKafkaOutbound");
const p1Storing = require("./p1Storing/P1Storing");
const { findFunctionNode } = require("../../../utils/functionTree.js");
const logger = require('../../../service/LoggingService.js').getLogger();
const formatAptOutputErrors = require('./p1FormattingOutputApt/ErrorsEnum');
const p1FormattingOutputApt = require("./p1FormattingOutputApt/P1FormattingOutputApt");
const formatOnfOutputErrors = require('./p1FormattingOutputOnf/ErrorsEnum');
const {p1FormattingOutputOnf} = require("./p1FormattingOutputOnf/P1FormattingOutputOnf");
const fs = require("fs");
const sampleResultCcApt = require("./outputAPTSample.json");
const sampleResultCcOnf = require("./outputOnfSample.json");

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
  const {
    mountName,
    parameters,
    configFile,
    mwdiReplicaEsClient,
    dataStoreEsClient,
    kafkaConsumerTypes
  } = request;

  //const logger = request.logger || console;
  let createResultCcResponse = null;

  if (
    !mountName ||
    !parameters ||
    !configFile ||
    !mwdiReplicaEsClient ||
    !dataStoreEsClient
  ) {
    throw new Error(
      "mountName, parameters, configFile, mwdiReplicaEsClient and dataStoreEsClient are mandatory"
    );
  }

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

    const resultCcApt = responseApt["output-format"];//sampleResultCcApt;//

    /*   P1FormattingOutputOnf is an ONF function that formats the output result CC according to the ONF output format. 
        It also performs some basic validations on the result CC. If the formatting fails or the result CC is invalid, 
        it returns an error response with details about the error.
    */

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

    throw {
      mountName,
      stage: error.stage || "p1ProcessDevice",
      message: error.message || String(error),
      retryable: error.retryable,
      details: error.details,
      vendorResponse: error.vendorResponse,
      originalError: error
    };
  }
}

module.exports = { run };
