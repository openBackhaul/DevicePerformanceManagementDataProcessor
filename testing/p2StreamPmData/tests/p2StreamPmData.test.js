jest.mock("@confluentinc/kafka-javascript", () => ({
  KafkaJS: {
    Kafka: jest.fn()
  }
}), { virtual: true });

jest.mock("@elastic/elasticsearch", () => ({
  Client: jest.fn()
}), { virtual: true });

jest.mock("../../../server/service/LoggingService.js", () => {
  const silentLogger = {
    fatal: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn()
  };

  return {
    getLogger: jest.fn(() => silentLogger)
  };
});

jest.mock("../../../server/infra/redis/redisLock.js", () => ({
  acquireLock: jest.fn(() => Promise.reject(new Error("stop cleanup loop in test"))),
  renewLock: jest.fn(() => Promise.resolve(false)),
  releaseLock: jest.fn(() => Promise.resolve())
}));

// ✅ Keep real exports (including withRetry), override only sleep
jest.mock("../../../server/utils/retry", () => ({
  ...jest.requireActual("../../../server/utils/retry"),
  sleep: jest.fn(() => Promise.resolve())
}));

jest.mock("../../../server/core/gracefulShutdown", () => ({
  registerGracefulShutdown: jest.fn()
}));

jest.mock("../../../server/core/monitoringServer", () => ({
  startMonitoringServer: jest.fn()
}));

jest.mock("../../../server/utils/config", () => ({
  loadRuntimeConfig: jest.fn(() => ({
    redis: {},
    service: {},
    monitoring: {}
  }))
}));

jest.mock("../../../server/core/performanceMetrics", () => ({
  configure: jest.fn()
}));

jest.mock("../../../server/genericFunctions/p1LoadParameters/P1LoadParameters", () => ({
  run: jest.fn()
}));

jest.mock("../../../server/genericFunctions/p1ResolveEsAddress/P1ResolveEsAddress", () => ({
  run: jest.fn()
}));

jest.mock("../../../server/genericFunctions/p1InitKafka/P1InitKafka", () => ({
  run: jest.fn()
}));

jest.mock("../../../server/infra/elasticSearch/esBootstrap.js", () => ({
  ensureIndicesAndMappings: jest.fn()
}));

// ✅ Mock storage optimization so startup test doesn't depend on deep ES adapter behavior
jest.mock("../../../server/infra/elasticSearch/storageOptimization", () => ({
  prepareStorage: jest.fn(() => Promise.resolve())
}));

// Optional: prevent cleanup worker side effects if module is reached during startup
jest.mock("../../../server/runtime/kafka/kafkaPayloadCleanupWorker", () => ({
  start: jest.fn(() => Promise.resolve())
}));

jest.mock("../../../server/core/replicaStateStore.js", () => ({
  loadLastReplicaTime: jest.fn()
}));

jest.mock("../../../server/runtime/replica/replicaLeaderLoop", () => ({
  startReplicaLeaderLoop: jest.fn(() => Promise.resolve())
}));

jest.mock("../../../server/runtime/processing/processingWorkerPoolRedis", () => ({
  startProcessingWorkerPoolRedis: jest.fn(() => Promise.resolve())
}));

jest.mock("../../../server/runtime/kafka/kafkaOutboundWorker", () => ({
  startKafkaOutboundWorkerPool: jest.fn(() => Promise.resolve())
}));

jest.mock("../../../server/runtime/processing/retryWorker", () => ({
  startRetryWorkerPool: jest.fn(() => Promise.resolve())
}));

jest.mock("../../../server/specificFunctions/p1StreamPmData/p1MaintainDs/P1MaintainDs", () => ({
  run: jest.fn(() => Promise.resolve())
}));

const { getLogger } = require("../../../server/service/LoggingService.js");
const { registerGracefulShutdown } = require("../../../server/core/gracefulShutdown.js");
const { startMonitoringServer } = require("../../../server/core/monitoringServer.js");
const { loadRuntimeConfig } = require("../../../server/utils/config.js");
const performanceMetrics = require("../../../server/core/performanceMetrics.js");
const p1LoadParameters = require("../../../server/genericFunctions/p1LoadParameters/P1LoadParameters.js");
const p1ResolveESAddress = require("../../../server/genericFunctions/p1ResolveEsAddress/P1ResolveEsAddress.js");
const p1InitKafka = require("../../../server/genericFunctions/p1InitKafka/P1InitKafka.js");
const { ensureIndicesAndMappings } = require("../../../server/infra/elasticSearch/esBootstrap.js");
const { prepareStorage } = require("../../../server/infra/elasticSearch/storageOptimization");
const { loadLastReplicaTime } = require("../../../server/core/replicaStateStore.js");
const { startReplicaLeaderLoop } = require("../../../server/runtime/replica/replicaLeaderLoop.js");
const { startProcessingWorkerPoolRedis } = require("../../../server/runtime/processing/processingWorkerPoolRedis.js");
const { startKafkaOutboundWorkerPool } = require("../../../server/runtime/kafka/kafkaOutboundWorker.js");
const { startRetryWorkerPool } = require("../../../server/runtime/processing/retryWorker.js");
const kafkaPayloadCleanupWorker = require("../../../server/runtime/kafka/kafkaPayloadCleanupWorker");

const p2StreamPmData = require("../../../server/specificFunctions/p2StreamPmData/P2StreamPmData.js");
const { run, _internal } = p2StreamPmData;

function makeLoadedParameters() {
  return {
    parameters: {
      name: "p2StreamPmData",
      subFunctions: [
        { name: "p1ResolveEsAddress", parameter: [] },
        { name: "p1InitKafka", parameter: [] },
        { name: "p1UpdateMwdiReplica", parameter: [] },
        { name: "p2ProcessDevice", parameter: [] },
        { name: "p1TransmittingKafka", parameter: [] },
        { name: "p1MaintainDs", parameter: [] }
      ]
    },
    configFile: {}
  };
}

function makeKafkaInit() {
  return {
    kafkaConnectionList: [
      {
        parameterName: "aptProvider",
        kafkaClientUuid: "dpmdp-1-0-0-kmb-c-kmb-1-0-0-000",
        clientId: "aptProvider",
        groupId: null,
        brokerList: ["127.0.0.1:9092"],
        topicName: "apt_format",
        type: "provider"
      }
    ]
  };
}

describe("P2StreamPmData.run", () => {
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    _internal.resetInitializationForTest();

    logger = getLogger();

    loadRuntimeConfig.mockReturnValue({
      redis: {
        staleMessageIdleMs: 60000,
        retryWorkerCount: 1,
        retryIntervalMs: 2 * 60 * 60 * 1000,
        retryReadCount: 500,
        retryMaxRequeuePerCycle: 20000,
        maxQueueLengthBeforeReplicaPause: 20000,
        replicaPauseMsWhenBacklogged: 30000,
        replicaLockTtlMs: 60000,
        cleanupLockTtlMs: 300000
      },
      service: {
        concurrency: 4,
        maxProcessingConcurrency: 16,
        processingReadCount: 10,
        kafkaOutboundConcurrency: 1,
        kafkaOutboundReadCount: 100,
        kafkaOutboundBatchSize: 100,
        kafkaOutboundMaxBatchBytes: 900 * 1024,
        kafkaOutboundFailureSleepMs: 10000,
        kafkaOutboundWorkerIdleSleepMs: 1000,
        kafkaOutboundStaleMessageIdleMs: 300000,
        kafkaOutboundHeartbeatIntervalMs: 60000,
        workerIdleSleepMs: 1000,
        httpPort: 8040,
        shutdownGraceMs: 30000,
        replicaMinimumCycleDelayMs: 3000
      },
      monitoring: {
        enabled: true,
        performanceTimings: {}
      }
    });

    p1LoadParameters.run.mockResolvedValue(makeLoadedParameters());

    p1ResolveESAddress.run
      .mockResolvedValueOnce({ esAddress: { url: "http://mwdi-es:9200" } })
      .mockResolvedValueOnce({ esAddress: { url: "http://mwdi-replica-es:9200" } })
      .mockResolvedValueOnce({ esAddress: { url: "http://logging-es:9200" } })
      .mockResolvedValueOnce({ esAddress: { url: "http://datastore-es:9200" } });

    ensureIndicesAndMappings.mockResolvedValue({});
    prepareStorage.mockResolvedValue(undefined);
    loadLastReplicaTime.mockResolvedValue("2010-11-20T14:00:00+01:00");
    p1InitKafka.run.mockResolvedValue(makeKafkaInit());
  });

  it("returns startup state and kafka connections on the happy path", async () => {
    const result = await run();

    expect(result).toEqual(
      expect.objectContaining({
        instanceId: expect.any(String),
        appState: expect.objectContaining({
          isShuttingDown: false,
          lastReplicaTime: "2010-11-20T14:00:00+01:00"
        }),
        kafkaConnectionList: expect.arrayContaining([
          expect.objectContaining({
            parameterName: "aptProvider",
            topicName: "apt_format",
            type: "provider"
          })
        ])
      })
    );
  });

  it("configures performance metrics from runtime config", async () => {
    await run();
    expect(performanceMetrics.configure).toHaveBeenCalledWith({}, logger);
  });

  it("registers graceful shutdown with the configured grace period", async () => {
    loadRuntimeConfig.mockReturnValue({
      redis: {},
      service: { shutdownGraceMs: 45000 },
      monitoring: {}
    });

    await run();

    expect(registerGracefulShutdown).toHaveBeenCalledWith(
      expect.any(Object),
      logger,
      { shutdownGraceMs: 45000 }
    );
  });

  it("starts monitoring server with configured port", async () => {
    loadRuntimeConfig.mockReturnValue({
      redis: {},
      service: { httpPort: 9050 },
      monitoring: {
        enabled: true,
        performanceTimings: {}
      }
    });

    await run();

    expect(startMonitoringServer).toHaveBeenCalledWith(
      expect.any(Object),
      logger,
      { enabled: true, port: 9050 }
    );
  });

  it("resolves all four elasticsearch clients in order", async () => {
    await run();

    expect(p1ResolveESAddress.run).toHaveBeenCalledTimes(4);
    expect(p1ResolveESAddress.run).toHaveBeenNthCalledWith(1, expect.objectContaining({ esName: "mwdiEsClient" }));
    expect(p1ResolveESAddress.run).toHaveBeenNthCalledWith(2, expect.objectContaining({ esName: "mwdiReplicaEsClient" }));
    expect(p1ResolveESAddress.run).toHaveBeenNthCalledWith(3, expect.objectContaining({ esName: "loggingEsClient" }));
    expect(p1ResolveESAddress.run).toHaveBeenNthCalledWith(4, expect.objectContaining({ esName: "dataStoreEsClient" }));
  });

  it("passes resolved clients to ensureIndicesAndMappings", async () => {
    await run();

    expect(ensureIndicesAndMappings).toHaveBeenCalledWith(
      {
        mwdiReplicaEsClient: { url: "http://mwdi-replica-es:9200" },
        loggingEsClient: { url: "http://logging-es:9200" },
        dataStoreEsClient: { url: "http://datastore-es:9200" }
      },
      logger
    );
  });

  it("prepares storage before starting workers", async () => {
    await run();

    expect(prepareStorage).toHaveBeenCalledWith(
      { url: "http://datastore-es:9200" },
      expect.objectContaining({
        concurrency: 4,
        maxProcessingConcurrency: 16
      }),
      logger
    );
  });

  it("stores restored last replica time into appState", async () => {
    const result = await run();

    expect(loadLastReplicaTime).toHaveBeenCalledWith(
      { url: "http://logging-es:9200" },
      logger
    );
    expect(result.appState.lastReplicaTime).toBe("2010-11-20T14:00:00+01:00");
  });

  it("passes kafka init parameters and logger to p1InitKafka", async () => {
    await run();

    expect(p1InitKafka.run).toHaveBeenCalledWith(
      expect.objectContaining({
        parameters: expect.any(Object),
        configFile: {},
        logger
      })
    );
  });

  it("starts all background workers with derived config", async () => {
    const result = await run();

    expect(startReplicaLeaderLoop).toHaveBeenCalledTimes(1);
    expect(startProcessingWorkerPoolRedis).toHaveBeenCalledTimes(1);
    expect(startKafkaOutboundWorkerPool).toHaveBeenCalledTimes(1);
    expect(startRetryWorkerPool).toHaveBeenCalledTimes(1);
    expect(kafkaPayloadCleanupWorker.start).toHaveBeenCalledTimes(1);

    expect(startProcessingWorkerPoolRedis).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: result.instanceId,
        appState: result.appState,
        workerCount: 4
      })
    );

    expect(startKafkaOutboundWorkerPool).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: result.instanceId,
        appState: result.appState,
        kafkaConnectionList: result.kafkaConnectionList
      })
    );
  });

  it("returns the same promise/result when run is called twice after initialization starts", async () => {
    const p1 = run();
    const p2 = run();

    expect(p1).toBe(p2);

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.instanceId).toBe(r2.instanceId);
  });

  it("skips duplicate startup and logs a warning", async () => {
    const first = await run();
    const second = await run();

    expect(second.instanceId).toBe(first.instanceId);
    expect(logger.warn).toHaveBeenCalledWith(
      { label: "p2-stream-pm-data.duplicate-start-skipped" },
      "DPMDP P2 stream processing is already initialized; duplicate startup was skipped"
    );
  });

  it("rejects with normalized PARAMETERS_INVALID when parameter loading fails with parameter-related message", async () => {
    p1LoadParameters.run.mockRejectedValue(new Error("parameter loading failed"));

    await expect(run()).rejects.toMatchObject({
      message: expect.any(String),
      stage: "p2StreamPmData"
    });
  });

  it("rejects with normalized ES_ADDRESS_NOT_RESOLVED when elasticsearch address resolution fails", async () => {
    p1ResolveESAddress.run.mockReset();
    p1ResolveESAddress.run
      .mockResolvedValueOnce({ esAddress: { url: "http://mwdi-es:9200" } })
      .mockRejectedValueOnce(new Error("resolve replica es failed"));

    await expect(run()).rejects.toMatchObject({
      message: expect.any(String),
      stage: "p2StreamPmData"
    });
  });

  it("rejects with normalized GENERAL_PROCESSING_ERROR when ensureIndicesAndMappings fails", async () => {
    ensureIndicesAndMappings.mockRejectedValue(new Error("bootstrap failed"));

    await expect(run()).rejects.toMatchObject({
      message: expect.any(String),
      stage: "p2StreamPmData"
    });
  });

  it("rejects with normalized GENERAL_PROCESSING_ERROR when prepareStorage fails", async () => {
    prepareStorage.mockRejectedValue(new Error("storage optimization failed"));

    await expect(run()).rejects.toMatchObject({
      message: expect.any(String),
      stage: "p2StreamPmData"
    });
  });

  it("rejects with normalized GENERAL_PROCESSING_ERROR when loading last replica time fails", async () => {
    loadLastReplicaTime.mockRejectedValue(new Error("restore failed"));

    await expect(run()).rejects.toMatchObject({
      message: expect.any(String),
      stage: "p2StreamPmData"
    });
  });

  it("rejects with normalized KAFKA_SESSION_NOT_ESTABLISHED when kafka init fails", async () => {
    p1InitKafka.run.mockRejectedValue(new Error("kafka init failed"));

    await expect(run()).rejects.toMatchObject({
      message: expect.any(String),
      stage: "p2StreamPmData"
    });
  });

  it("does not fail startup when replica leader loop rejects later", async () => {
    startReplicaLeaderLoop.mockImplementationOnce(() =>
      Promise.reject(new Error("replica loop failed"))
    );

    const result = await run();

    expect(result.instanceId).toEqual(expect.any(String));
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error)
      }),
      expect.stringContaining("Replica leader loop crashed")
    );
  });

  it("does not fail startup when worker pool rejects later", async () => {
    startProcessingWorkerPoolRedis.mockImplementationOnce(() =>
      Promise.reject(new Error("worker pool failed"))
    );

    const result = await run();

    expect(result.instanceId).toEqual(expect.any(String));
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error)
      }),
      "Worker pool crashed"
    );
  });

  it("does not fail startup when kafka outbound worker rejects later", async () => {
    startKafkaOutboundWorkerPool.mockImplementationOnce(() =>
      Promise.reject(new Error("kafka outbound failed"))
    );

    const result = await run();

    expect(result.instanceId).toEqual(expect.any(String));
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error)
      }),
      "Kafka outbound worker pool crashed"
    );
  });

  it("does not fail startup when retry worker rejects later", async () => {
    startRetryWorkerPool.mockImplementationOnce(() =>
      Promise.reject(new Error("retry worker failed"))
    );

    const result = await run();

    expect(result.instanceId).toEqual(expect.any(String));
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error)
      }),
      "Retry worker pool crashed"
    );
  });

  it("does not fail startup when cleanup leader loop stops immediately", async () => {
    const result = await run();
    expect(result.instanceId).toEqual(expect.any(String));
  });
});