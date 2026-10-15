jest.mock("../../utils/config", () => ({ loadRuntimeConfig: jest.fn() }));
jest.mock("../../utils/functionTree", () => ({
  findFunctionNode: jest.fn(() => ({})),
  getParamFromFunction: jest.fn()
}));
jest.mock("../../infra/redis/redisLock", () => ({
  acquireLock: jest.fn().mockRejectedValue(new Error("stop cleanup loop")),
  renewLock: jest.fn(),
  releaseLock: jest.fn()
}));
jest.mock("../../utils/retry", () => ({ sleep: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../../core/appState", () => ({
  AppState: jest.fn(() => ({ lastReplicaTime: null }))
}));
jest.mock("../../core/gracefulShutdown", () => ({ registerGracefulShutdown: jest.fn() }));
jest.mock("../../core/monitoringServer", () => ({ startMonitoringServer: jest.fn() }));
jest.mock("../../core/performanceMetrics", () => ({ configure: jest.fn() }));
jest.mock("../../infra/elasticSearch/esBootstrap.js", () => ({
  ensureIndicesAndMappings: jest.fn().mockResolvedValue(undefined)
}));
jest.mock("../../core/replicaStateStore.js", () => ({
  loadLastReplicaTime: jest.fn().mockResolvedValue("2026-09-01T00:00:00Z")
}));
jest.mock("../../genericFunctions/p1LoadParameters/P1LoadParameters", () => ({ run: jest.fn() }));
jest.mock("../../genericFunctions/p1ResolveEsAddress/P1ResolveEsAddress", () => ({ run: jest.fn() }));
jest.mock("../../genericFunctions/p1InitKafka/P1InitKafka", () => ({ run: jest.fn() }));
jest.mock("../p1StreamPmData/p1MaintainDs/P1MaintainDs", () => ({ run: jest.fn() }));
jest.mock("./p2ProcessDevice/P2ProcessDevice", () => ({ run: jest.fn() }));
jest.mock("../../runtime/replica/replicaLeaderLoop", () => ({
  startReplicaLeaderLoop: jest.fn().mockResolvedValue(undefined)
}));
jest.mock("../../runtime/processing/processingWorkerPoolRedis", () => ({
  startProcessingWorkerPoolRedis: jest.fn().mockResolvedValue(undefined)
}));
jest.mock("../../runtime/kafka/kafkaOutboundWorker", () => ({
  startKafkaOutboundWorkerPool: jest.fn().mockResolvedValue(undefined)
}));
jest.mock("../../runtime/processing/retryWorker", () => ({
  startRetryWorkerPool: jest.fn().mockResolvedValue(undefined)
}));
jest.mock("../../service/LoggingService.js", () => ({
  getLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() })
}));

const { loadRuntimeConfig } = require("../../utils/config");
const p1LoadParameters = require("../../genericFunctions/p1LoadParameters/P1LoadParameters");
const p1ResolveEsAddress = require("../../genericFunctions/p1ResolveEsAddress/P1ResolveEsAddress");
const p1InitKafka = require("../../genericFunctions/p1InitKafka/P1InitKafka");
const { startMonitoringServer } = require("../../core/monitoringServer");
const { startReplicaLeaderLoop } = require("../../runtime/replica/replicaLeaderLoop");
const { startProcessingWorkerPoolRedis } = require("../../runtime/processing/processingWorkerPoolRedis");
const { startKafkaOutboundWorkerPool } = require("../../runtime/kafka/kafkaOutboundWorker");
const { run, _internal } = require("./P2StreamPmData");

describe("P2StreamPmData common runtime integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _internal.resetInitializationForTest();
    loadRuntimeConfig.mockReturnValue({
      monitoring: { enabled: true },
      redis: {},
      service: {
        concurrency: 2,
        maxProcessingConcurrency: 8,
        processingReadCount: 6,
        kafkaConsumerTypes: "APT,MYCOM,NETEXPLORER"
      }
    });
    p1LoadParameters.run.mockResolvedValue({ parameters: {}, configFile: {} });
    p1ResolveEsAddress.run.mockImplementation(async ({ esName }) => ({
      esAddress: { uuid: esName }
    }));
    p1InitKafka.run.mockResolvedValue({ kafkaConnectionList: [{ topicName: "topic-a" }] });
  });

  test("starts once and passes current runtime controls to the worker pools", async () => {
    const first = run();
    const second = run();
    await expect(first).resolves.toEqual(await second);

    expect(p1LoadParameters.run).toHaveBeenCalledTimes(1);
    expect(startMonitoringServer).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), {
      enabled: true,
      port: 8040
    });
    expect(startReplicaLeaderLoop).toHaveBeenCalledWith(expect.objectContaining({
      replicaMinimumCycleDelayMs: 3000,
      runtimeConfig: expect.any(Object)
    }));
    expect(startProcessingWorkerPoolRedis).toHaveBeenCalledWith(expect.objectContaining({
      workerCount: 2,
      maxWorkerCount: 8,
      readCount: 6,
      kafkaConsumerTypes: "APT,MYCOM,NETEXPLORER",
      storingOptions: expect.any(Object)
    }));
    expect(startKafkaOutboundWorkerPool).toHaveBeenCalledWith(expect.objectContaining({
      readCount: 10,
      staleMessageIdleMs: 300000,
      heartbeatIntervalMs: 60000,
      kafkaMaxSingleMessageBytes: 900000
    }));
  });

  test("normalizes initialization errors and permits a later retry", async () => {
    p1LoadParameters.run.mockRejectedValueOnce(new Error("functionName missing from parameters"));
    await expect(run()).rejects.toMatchObject({ message: "Parameters missing or invalid" });

    await expect(run()).resolves.toEqual(expect.objectContaining({
      kafkaConnectionList: [{ topicName: "topic-a" }]
    }));
    expect(p1LoadParameters.run).toHaveBeenCalledTimes(2);
  });
});
