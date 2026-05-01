const p1LoadRawCc = require("./p1LoadRawCc/P1LoadRawCc");
const p1CreateResultCc = require("./p1CreateResultCc/P1CreateResultCc");
const redisQueueKafkaOutbound = require("../../../infra/kafka/queueKafkaOutbound");
const p1Storing = require("./p1Storing/P1Storing");

/*function getTargetConsumers() {
  return String(
    global.DPMDP_KAFKA_TARGET_CONSUMERS ||
      "APT,MYCOM,NETEXPLORER,IVERITAS"
  )
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
}

function shouldPublishDataQuality() {
  return String(global.DPMDP_ENABLE_DATAQUALITY_TOPIC || "true") === "true";
}

 function buildKafkaOutputs(mountName, resultCc, correlationId) {
  const outputs = [];

  for (const targetConsumer of getTargetConsumers()) {
    outputs.push({
      targetConsumer,
      messageType: "PERFORMANCE_OUTPUT",
      mountName,
      correlationId,
      payloadVersion: "1.0",
      payload: resultCc
    });
  }

  if (shouldPublishDataQuality()) {
    outputs.push({
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
    });
  }

  return outputs;
} */

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
    dataStoreEsClient
  } = request;

  const logger = request.logger || console;
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
    const loadRawCcResponse = await p1LoadRawCc.run({
      mountName,
      parameters,
      mwdiReplicaEsClient,
      dataStoreEsClient,
      logger
    });

    createResultCcResponse = await p1CreateResultCc.run({
      parameters,
      rawCc: loadRawCcResponse.rawCc,
      mountName: loadRawCcResponse.mountName || mountName,
      logger
    });

   /* const resultMountName =
      createResultCcResponse.mountName ||
      loadRawCcResponse.mountName ||
      mountName;

    const correlationId = `dpmdp-${resultMountName}-${Date.now()}`;

     await redisQueueKafkaOutbound.run({
      output: buildKafkaOutputs(
        resultMountName,
        createResultCcResponse.resultCc,
        correlationId
      ),
      logger
    });

    await p1Storing.run({
      dataStoreEsClient,
      resultCc: createResultCcResponse.resultCc,
      interfaceMetadataList: createResultCcResponse.interfaceMetadataList,
      mountName: resultMountName,
      logger
    }); */

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
      originalError: error
    };
  }
}

module.exports = { run };