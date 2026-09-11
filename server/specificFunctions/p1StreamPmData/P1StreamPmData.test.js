jest.mock("../../utils/config", () => ({
  loadRuntimeConfig: jest.fn()
}));

jest.mock("../../utils/functionTree", () => ({
  findFunctionNode: jest.fn(),
  getParamFromFunction: jest.fn()
}));

jest.mock("../../infra/redis/redisLock", () => ({
  acquireLock: jest.fn(),
  releaseLock: jest.fn()
}));

jest.mock("../../utils/retry", () => ({
  sleep: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("../../core/appState", () => ({
  AppState: jest.fn().mockImplementation(() => ({
    lastReplicaTime: null
  }))
}));

jest.mock("../../core/gracefulShutdown", () => ({
  registerGracefulShutdown: jest.fn()
}));

jest.mock("../../core/monitoringServer", () => ({
  startMonitoringServer: jest.fn()
}));

jest.mock("../../infra/elasticSearch/esBootstrap.js", () => ({
  ensureIndicesAndMappings: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("../../core/replicaStateStore.js", () => ({
  loadLastReplicaTime: jest.fn().mockResolvedValue("2024-01-01T00:00:00Z")
}));

jest.mock("../../genericFunctions/p1LoadParameters/P1LoadParameters", () => ({
  run: jest.fn()
}));

jest.mock("../../genericFunctions/p1ResolveEsAddress/P1ResolveEsAddress", () => ({
  run: jest.fn()
}));

jest.mock("../../genericFunctions/p1InitKafka/P1InitKafka", () => ({
  run: jest.fn()
}));

jest.mock("./p1MaintainDs/P1MaintainDs", () => ({
  run: jest.fn()
}));

jest.mock("../../runtime/replica/replicaLeaderLoop", () => ({
  startReplicaLeaderLoop: jest.fn().mockReturnValue(Promise.resolve())
}));

jest.mock("../../runtime/processing/processingWorkerPoolRedis", () => ({
  startProcessingWorkerPoolRedis: jest.fn().mockReturnValue(Promise.resolve())
}));

jest.mock("../../runtime/kafka/kafkaOutboundWorker", () => ({
  startKafkaOutboundWorkerPool: jest.fn().mockReturnValue(Promise.resolve())
}));

jest.mock("../../runtime/processing/retryWorker", () => ({
  startRetryWorkerPool: jest.fn().mockReturnValue(Promise.resolve())
}));

jest.mock("../../service/LoggingService.js", () => ({
  getLogger: () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

const { loadRuntimeConfig } = require("../../utils/config");
const { findFunctionNode } = require("../../utils/functionTree");
const { acquireLock } = require("../../infra/redis/redisLock");
const p1LoadParameters = require("../../genericFunctions/p1LoadParameters/P1LoadParameters");
const p1ResolveESAddress = require("../../genericFunctions/p1ResolveEsAddress/P1ResolveEsAddress");
const p1InitKafka = require("../../genericFunctions/p1InitKafka/P1InitKafka");
const { run, _internal } = require("./P1StreamPmData");
const ERRORS = require("./ErrorsEnum");

function mockLoadedParameters() {
  findFunctionNode.mockImplementation((parameters, functionName) => {
    if (functionName === "p1ResolveEsAddress") return {};
    if (functionName === "p1InitKafka") return {};
    if (functionName === "p1UpdateMwdiReplica") return {};
    if (functionName === "p1ProcessDevice") return {};
    if (functionName === "p1TransmittingKafka") return {};
    if (functionName === "p1MaintainDs") return {};
    return {};
  });

  p1LoadParameters.run.mockResolvedValue({
    parameters: { test: "config" },
    configFile: { test: "config" }
  });

  p1ResolveESAddress.run.mockImplementation(async ({ esName }) => ({
    esAddress: { uuid: esName }
  }));

  p1InitKafka.run.mockResolvedValue({
    kafkaConnectionList: [{ topicName: "topic-a" }]
  });
}

describe("P1StreamPmData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _internal.resetInitializationForTest();
    acquireLock.mockRejectedValue(new Error("stop cleanup loop in unit test"));
    loadRuntimeConfig.mockReturnValue({
      redis: {},
      service: {
        concurrency: 1,
        kafkaOutboundConcurrency: 1,
        kafkaConsumerTypes: "APT,ONF"
      }
    });

    mockLoadedParameters();
  });

  test("exports a run function", () => {
    expect(typeof run).toBe("function");
  });

  test("returns initialized service information on success", async () => {
    const result = await run();

    expect(result).toEqual(
      expect.objectContaining({
        instanceId: expect.any(String),
        appState: expect.any(Object),
        kafkaConnectionList: [{ topicName: "topic-a" }]
      })
    );
  });

  test("starts the service only once when run is called repeatedly", async () => {
    const first = run();
    const second = run();

    await expect(first).resolves.toEqual(await second);
    expect(p1LoadParameters.run).toHaveBeenCalledTimes(1);
    expect(p1InitKafka.run).toHaveBeenCalledTimes(1);
  });

  test("normalizes parameter loading failures as the interface error contract", async () => {
    p1LoadParameters.run.mockRejectedValue(new Error("functionName not found in configFile"));

    const result = run();
    await expect(result).rejects.toBeInstanceOf(Error);
    await expect(result).rejects.toMatchObject({
      message: ERRORS.PARAMETERS_INVALID
    });
  });
});
