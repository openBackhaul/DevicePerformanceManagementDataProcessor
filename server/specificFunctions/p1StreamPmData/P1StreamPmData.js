const os = require("os");
const crypto = require("crypto");
const { findFunctionNode, getParamFromFunction } = require("../../utils/functionTree");
const { acquireLock, releaseLock } = require("../../infra/redis/redisLock");
const { sleep } = require("../../utils/retry");
const { loadRuntimeConfig } = require("../../utils/config");
const { AppState } = require("../../core/appState");
const { registerGracefulShutdown } = require("../../core/gracefulShutdown");
const { startMonitoringServer } = require("../../core/monitoringServer");

const { ensureIndicesAndMappings } = require("../../infra/elasticSearch/esBootstrap.js");
const { loadLastReplicaTime } = require("../../core/replicaStateStore.js");

const p1LoadParameters = require("../../genericFunctions/p1LoadParameters/P1LoadParameters");
const p1ResolveESAddress = require("../../genericFunctions/p1ResolveEsAddress/P1ResolveEsAddress");
const p1InitKafka = require("../../genericFunctions/p1InitKafka/P1InitKafka");

const p1MaintainDs = require("./p1MaintainDs/P1MaintainDs");
const { startReplicaLeaderLoop } = require("../../runtime/replica/replicaLeaderLoop");
const { startProcessingWorkerPoolRedis } = require("../../runtime/processing/processingWorkerPoolRedis");
const { startKafkaOutboundWorkerPool } = require("../../runtime/kafka/kafkaOutboundWorker");
const { startRetryWorkerPool } = require("../../runtime/processing/retryWorker");

const logger = require('../../service/LoggingService.js').getLogger();
const appState = new AppState();


async function startCleanupLeaderLoop(context) {
    const lockKey = "dpmdp:lock:cleanup";
    const ttlMs = context.cleanupLockTtlMs || 300000;
    const cleanupPeriodHours = Number(
        getParamFromFunction(context.cleanupParameters, "p1MaintainDs", "dataStoreCleanupPeriod", 12)
    );

    while (true) {
        const token = await acquireLock(lockKey, ttlMs, context.logger);

        if (!token) {
            await sleep(10000);
            continue;
        }

        try {
            await p1MaintainDs.run({
                parameters: context.cleanupParameters,
                dataStoreEsClient: context.dataStoreEsClient,
                loggingEsClient: context.loggingEsClient,
                logger: context.logger
            });
        } finally {
            await releaseLock(lockKey, token, context.logger).catch(() => {});
        }

        await sleep(cleanupPeriodHours * 3600 * 1000);
    }
}

/**
 * Request:
 * {
 * }
 *
 * Response:
 * {
 *   instanceId,
 *   kafkaConnectionList,
 *   appState
 * }
 */
async function run() {
  const sequence = [];

  const runtimeConfig = loadRuntimeConfig() || {};
  const redisConfig = runtimeConfig.redis || {};
  const serviceConfig = runtimeConfig.service || {};

  const instanceId = `${os.hostname()}-${process.pid}-${crypto.randomUUID()}`;

  registerGracefulShutdown(appState, logger, {
    shutdownGraceMs: (((runtimeConfig || {}).service || {}).shutdownGraceMs) || 30000
  });

  /* startMonitoringServer(appState, logger, {
    enabled: ((((runtimeConfig || {}).monitoring || {}).enabled) !== false),
    port: ((((runtimeConfig || {}).service || {}).httpPort) || 8040)
  }); */

  const loaded = await p1LoadParameters.run({
    functionName: "p1StreamPmData",
  });

  const p1ResolveEsAddressParameters = findFunctionNode(loaded.parameters, "p1ResolveEsAddress");
  const p1InitKafkaParameters = findFunctionNode(loaded.parameters, "p1InitKafka");
  const p1UpdateMwdiReplicaParameters = findFunctionNode(loaded.parameters, "p1UpdateMwdiReplica");
  const p1ProcessDeviceParameters = findFunctionNode(loaded.parameters, "p1ProcessDevice");
  const p1TransmittingKafkaParameters = findFunctionNode(loaded.parameters, "p1TransmittingKafka");
  const p1MaintainDsParameters = findFunctionNode(loaded.parameters, "p1MaintainDs");

  const mwdiEsClient = (
    await p1ResolveESAddress.run({
      parameters: p1ResolveEsAddressParameters,
      configFile: loaded.configFile,
      esName: "mwdiEsClient"
    })
  ).esAddress;

  const mwdiReplicaEsClient = (
    await p1ResolveESAddress.run({
      parameters: p1ResolveEsAddressParameters,
      configFile: loaded.configFile,
      esName: "mwdiReplicaEsClient"
    })
  ).esAddress;

  const loggingEsClient = (
    await p1ResolveESAddress.run({
      parameters: p1ResolveEsAddressParameters,
      configFile: loaded.configFile,
      esName: "loggingEsClient"
    })
  ).esAddress;

  const dataStoreEsClient = (
    await p1ResolveESAddress.run({
      parameters: p1ResolveEsAddressParameters,
      configFile: loaded.configFile,
      esName: "dataStoreEsClient"
    })
  ).esAddress;

  await ensureIndicesAndMappings(
    {
      mwdiReplicaEsClient,
      loggingEsClient,
      dataStoreEsClient
    },
    logger
  );

  const restoredLastReplicaTime = await loadLastReplicaTime(loggingEsClient, logger);

  appState.lastReplicaTime = restoredLastReplicaTime;

  const kafkaInit = await p1InitKafka.run({
    parameters: p1InitKafkaParameters,
    configFile: loaded.configFile,
    logger
  });

  
  startReplicaLeaderLoop({
    logger,
    appState,
    updateParameters: p1UpdateMwdiReplicaParameters,
    mwdiEsClient,
    mwdiReplicaEsClient,
    loggingEsClient,
    maxQueueLengthBeforeReplicaPause: Number(redisConfig.maxQueueLengthBeforeReplicaPause) || 20000,
    replicaPauseMsWhenBacklogged: Number(redisConfig.replicaPauseMsWhenBacklogged) || 30000,
    replicaLockTtlMs: redisConfig.replicaLockTtlMs || 60000
  }).catch((error) => logger.error({ error }, `Replica leader loop crashed: ${error.message || error}`));

  /* startCleanupLeaderLoop({
    logger,
    cleanupParameters: p1MaintainDsParameters,
    dataStoreEsClient,
    loggingEsClient,
    cleanupLockTtlMs: redisConfig.cleanupLockTtlMs || 300000
  }).catch((error) => logger.error({ error }, "Cleanup leader loop crashed"));*/

  startProcessingWorkerPoolRedis({
    logger,
    instanceId,
    appState,
    workerCount: Number(serviceConfig.concurrency || 4),
    processDeviceParameters: p1ProcessDeviceParameters,
    configFile: loaded.configFile,
    mwdiReplicaEsClient,
    dataStoreEsClient,
    staleMessageIdleMs: Number(redisConfig.staleMessageIdleMs || 60000),
    workerIdleSleepMs: Number(serviceConfig.workerIdleSleepMs || 1000)
  }).catch((error) => logger.error({ error }, "Worker pool crashed"));

  /* startKafkaOutboundWorkerPool({
    logger,
    instanceId,
    appState,
    dataStoreEsClient,
    workerCount: Number(serviceConfig.kafkaOutboundConcurrency || 1),
    readCount: Number(serviceConfig.kafkaOutboundReadCount || 100),
    batchSize: Number(serviceConfig.kafkaOutboundBatchSize || 100),
    maxBatchBytes: Number(serviceConfig.kafkaOutboundMaxBatchBytes || 900 * 1024),
    staleMessageIdleMs: Number(redisConfig.staleMessageIdleMs || 60000)
  }).catch((error) =>
    logger.error({ error }, "Kafka outbound worker pool crashed")
  ); */

  startRetryWorkerPool({
    logger,
    instanceId,
    appState,
    workerCount: 1,
    retryDelayMs: Number(redisConfig.retryIntervalMs || 10000),
    staleMessageIdleMs: Number(redisConfig.staleMessageIdleMs || 60000)
  }).catch((error) => logger.error({ error }, "Retry worker pool crashed")); 

  return {
    instanceId,
    appState,
    kafkaConnectionList: kafkaInit.kafkaConnectionList
  };
}

module.exports = { run };
