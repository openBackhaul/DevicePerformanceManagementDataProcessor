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
  releaseLock: jest.fn(() => Promise.resolve())
}));

jest.mock("../../../server/core/gracefulShutdown", () => ({
  registerGracefulShutdown: jest.fn()
}));

jest.mock("../../../server/utils/config", () => ({
  loadRuntimeConfig: jest.fn(() => ({
    redis: {},
    service: {}
  }))
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

const { getLogger } = require("../../../server/service/LoggingService.js");
const { registerGracefulShutdown } = require("../../../server/core/gracefulShutdown");
const { loadRuntimeConfig } = require("../../../server/utils/config");
const p1LoadParameters = require("../../../server/genericFunctions/p1LoadParameters/P1LoadParameters");
const p1ResolveESAddress = require("../../../server/genericFunctions/p1ResolveEsAddress/P1ResolveEsAddress");
const p1InitKafka = require("../../../server/genericFunctions/p1InitKafka/P1InitKafka");
const { ensureIndicesAndMappings } = require("../../../server/infra/elasticSearch/esBootstrap.js");
const { loadLastReplicaTime } = require("../../../server/core/replicaStateStore.js");
const { startReplicaLeaderLoop } = require("../../../server/runtime/replica/replicaLeaderLoop");
const { startProcessingWorkerPoolRedis } = require("../../../server/runtime/processing/processingWorkerPoolRedis");
const { startKafkaOutboundWorkerPool } = require("../../../server/runtime/kafka/kafkaOutboundWorker");
const { startRetryWorkerPool } = require("../../../server/runtime/processing/retryWorker");

const { run } = require("../../../server/specificFunctions/p1StreamPmData/P1StreamPmData");

function makeLoadedParameters() {
  return {
    parameters: {
      name: "p1StreamPmData",
      subFunctions: [
        { name: "p1ResolveEsAddress", parameter: [] },
        { name: "p1InitKafka", parameter: [] },
        { name: "p1UpdateMwdiReplica", parameter: [] },
        { name: "p1ProcessDevice", parameter: [] },
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

describe("P1StreamPmData.run", () => {
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();

    logger = getLogger();

    loadRuntimeConfig.mockReturnValue({
      redis: {
        staleMessageIdleMs: 60000,
        retryWorkerCount: 1,
        retryIntervalMs: 2 * 60 * 60 * 1000,
        retryReadCount: 500,
        retryMaxRequeuePerCycle: 20000
      },
      service: {
        concurrency: 4,
        kafkaOutboundConcurrency: 1,
        kafkaOutboundReadCount: 100,
        kafkaOutboundBatchSize: 100,
        kafkaOutboundMaxBatchBytes: 900 * 1024,
        kafkaOutboundFailureSleepMs: 10000,
        kafkaOutboundWorkerIdleSleepMs: 1000,
        workerIdleSleepMs: 1000
      }
    });

    p1LoadParameters.run.mockResolvedValue(makeLoadedParameters());

    p1ResolveESAddress.run
      .mockResolvedValueOnce({ esAddress: { url: "http://mwdi-es:9200" } })
      .mockResolvedValueOnce({ esAddress: { url: "http://mwdi-replica-es:9200" } })
      .mockResolvedValueOnce({ esAddress: { url: "http://logging-es:9200" } })
      .mockResolvedValueOnce({ esAddress: { url: "http://datastore-es:9200" } });

    ensureIndicesAndMappings.mockResolvedValue({});
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

  it("registers graceful shutdown with the configured grace period", async () => {
    loadRuntimeConfig.mockReturnValue({
      redis: {},
      service: {
        shutdownGraceMs: 45000
      }
    });

    await run();

    expect(registerGracefulShutdown).toHaveBeenCalledWith(
      expect.any(Object),
      logger,
      { shutdownGraceMs: 45000 }
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

  it("rejects when parameter loading fails", async () => {
    p1LoadParameters.run.mockRejectedValue(new Error("load parameters failed"));

    await expect(run()).rejects.toThrow("load parameters failed");
  });

  it("rejects when elasticsearch address resolution fails", async () => {
    p1ResolveESAddress.run.mockReset();
    p1ResolveESAddress.run
      .mockResolvedValueOnce({ esAddress: { url: "http://mwdi-es:9200" } })
      .mockRejectedValueOnce(new Error("resolve replica es failed"));

    await expect(run()).rejects.toThrow("resolve replica es failed");
  });

  it("rejects when ensureIndicesAndMappings fails", async () => {
    ensureIndicesAndMappings.mockRejectedValue(new Error("bootstrap failed"));

    await expect(run()).rejects.toThrow("bootstrap failed");
  });

  it("rejects when loading last replica time fails", async () => {
    loadLastReplicaTime.mockRejectedValue(new Error("restore failed"));

    await expect(run()).rejects.toThrow("restore failed");
  });

  it("rejects when kafka init fails", async () => {
    p1InitKafka.run.mockRejectedValue(new Error("kafka init failed"));

    await expect(run()).rejects.toThrow("kafka init failed");
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
        error: expect.any(Error)
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