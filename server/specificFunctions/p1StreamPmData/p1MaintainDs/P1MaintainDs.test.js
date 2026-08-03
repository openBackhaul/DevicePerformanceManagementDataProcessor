jest.mock("../../../infra/onf/onfAdapter", () => ({
  getEsClient: jest.fn()
}));

jest.mock("../../../utils/functionTree", () => ({
  getParamFromFunction: jest.fn()
}));

jest.mock("../../../utils/retry", () => ({
  sleep: jest.fn().mockResolvedValue(undefined),
  withRetry: jest.fn()
}));

const mockLogger = {
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

jest.mock("../../../../service/LoggingService.js", () => ({
  getLogger: jest.fn(() => mockLogger)
}), { virtual: true });

const onfAdapter = require("../../../infra/onf/onfAdapter");
const { getParamFromFunction } = require("../../../utils/functionTree");
const { withRetry } = require("../../../utils/retry");
const moduleUnderTest = require("./P1MaintainDs");
const ERRORS = require("./ErrorsEnum");

const validDataStoreEsClient = {
  uuid: "datastore-uuid",
  "index-alias": "datastore-index"
};

const validLoggingEsClient = {
  uuid: "logging-uuid",
  "index-alias": "logging-index"
};

function validRequest(overrides = {}) {
  return {
    parameters: {},
    dataStoreEsClient: validDataStoreEsClient,
    logger: mockLogger,
    ...overrides
  };
}

describe("P1MaintainDs", () => {
  let mockDataStoreClient;
  let mockLoggingClient;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDataStoreClient = {
      updateByQuery: jest.fn().mockResolvedValue({
        body: {
          total: 0,
          updated: 0,
          deleted: 0,
          noops: 0,
          version_conflicts: 0,
          failures: []
        }
      }),
      tasks: {
        get: jest.fn()
      }
    };

    mockLoggingClient = {
      deleteByQuery: jest.fn().mockResolvedValue({
        body: {
          deleted: 2
        }
      })
    };

    onfAdapter.getEsClient.mockImplementation(async (forceCreate, uuid) => {
      if (uuid === "datastore-uuid") {
        return mockDataStoreClient;
      }
      if (uuid === "logging-uuid") {
        return mockLoggingClient;
      }
      throw new Error("unknown client");
    });

    getParamFromFunction.mockImplementation(
      (parameters, functionName, parameterName, defaultValue) => defaultValue
    );

    withRetry.mockImplementation((fn) => fn());
  });

  test("exports a run function", () => {
    expect(moduleUnderTest.run).toBeDefined();
    expect(typeof moduleUnderTest.run).toBe("function");
  });

  test("throws parameters not provided when request is missing", async () => {
    await expect(moduleUnderTest.run()).rejects.toThrow(
      ERRORS.PARAMETERS_NOT_PROVIDED
    );
  });

  test("throws parameters invalid when parameters is not an object", async () => {
    await expect(
      moduleUnderTest.run(validRequest({ parameters: [] }))
    ).rejects.toThrow(ERRORS.PARAMETERS_INVALID);
  });

  test("throws dataStoreEsClient not provided when dataStoreEsClient is missing", async () => {
    await expect(
      moduleUnderTest.run(validRequest({ dataStoreEsClient: undefined }))
    ).rejects.toThrow(ERRORS.DATA_STORE_ES_CLIENT_NOT_PROVIDED);
  });

  test("throws dataStoreEsClient invalid when required address fields are missing", async () => {
    await expect(
      moduleUnderTest.run(validRequest({ dataStoreEsClient: { uuid: "only" } }))
    ).rejects.toThrow(ERRORS.DATA_STORE_ES_CLIENT_INVALID);
  });

  test("runs maintenance without loggingEsClient because it is not an interface input", async () => {
    const result = await moduleUnderTest.run(validRequest());

    expect(result.cleanupSummary).toEqual(
      expect.objectContaining({
        cleanupPeriodHours: 12,
        retentionPeriodHours: 48,
        loggingDocumentsDeleted: 0
      })
    );
    expect(onfAdapter.getEsClient).toHaveBeenCalledTimes(1);
  });

  test("cleans logging documents when loggingEsClient is provided", async () => {
    const result = await moduleUnderTest.run(
      validRequest({ loggingEsClient: validLoggingEsClient })
    );

    expect(result.cleanupSummary.loggingDocumentsDeleted).toBe(2);
    expect(mockLoggingClient.deleteByQuery).toHaveBeenCalledTimes(1);
  });

  test("supports hyphenated data-store-es-client input name", async () => {
    const result = await moduleUnderTest.run({
      parameters: {},
      "data-store-es-client": validDataStoreEsClient,
      logger: mockLogger
    });

    expect(result.cleanupSummary.devicesVisited).toBe(0);
  });

  test("throws retentionPeriod invalid when retention period is not numeric", async () => {
    getParamFromFunction.mockImplementation(
      (parameters, functionName, parameterName, defaultValue) => {
        if (parameterName === "dataStoreRetentionPeriod") {
          return "not-a-number";
        }
        return defaultValue;
      }
    );

    await expect(moduleUnderTest.run(validRequest())).rejects.toThrow(
      ERRORS.RETENTION_PERIOD_INVALID
    );
  });

  test("runs throttled server-side cleanup without searching full _source documents", async () => {
    mockDataStoreClient.updateByQuery.mockResolvedValueOnce({
      body: {
        total: 37458,
        updated: 12000,
        deleted: 25,
        noops: 25433,
        version_conflicts: 2,
        failures: []
      }
    });

    const result = await moduleUnderTest.run(validRequest());

    expect(mockDataStoreClient.updateByQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        index: "datastore-index",
        conflicts: "proceed",
        wait_for_completion: false,
        requests_per_second: 10,
        scroll_size: 100,
        body: expect.objectContaining({
          query: { match_all: {} },
          script: expect.objectContaining({ lang: "painless" })
        })
      })
    );
    expect(result.cleanupSummary).toEqual(expect.objectContaining({
      devicesVisited: 37458,
      devicesUpdated: 12000,
      devicesDeleted: 25,
      devicesUnchanged: 25433,
      versionConflicts: 2,
      batchesDeleted: null
    }));
  });

  test("waits for an asynchronous Elasticsearch cleanup task", async () => {
    mockDataStoreClient.updateByQuery.mockResolvedValueOnce({ body: { task: "node-1:42" } });
    mockDataStoreClient.tasks.get.mockResolvedValueOnce({
      body: {
        completed: true,
        response: {
          total: 100,
          updated: 80,
          deleted: 5,
          noops: 15,
          failures: []
        }
      }
    });

    const result = await moduleUnderTest.run(validRequest());

    expect(mockDataStoreClient.tasks.get).toHaveBeenCalledWith({ task_id: "node-1:42" });
    expect(result.cleanupSummary.devicesVisited).toBe(100);
    expect(result.cleanupSummary.devicesDeleted).toBe(5);
  });

  test("fails the maintenance cycle when server-side cleanup fails", async () => {
    mockDataStoreClient.updateByQuery.mockRejectedValueOnce(new Error("cleanup failed"));

    await expect(moduleUnderTest.run(validRequest())).rejects.toThrow(
      ERRORS.ELASTICSEARCH_WRITE_ERROR
    );
  });
});
