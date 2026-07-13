jest.mock("../../../infra/onf/onfAdapter", () => ({
  getEsClient: jest.fn()
}));

jest.mock("../../../utils/functionTree", () => ({
  getParamFromFunction: jest.fn()
}));

jest.mock("../../../utils/retry", () => ({
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
      search: jest.fn().mockResolvedValue({
        body: {
          hits: {
            hits: []
          }
        }
      }),
      index: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({})
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

  test("logs ElasticSearch read error and returns empty summary when datastore search fails", async () => {
    mockDataStoreClient.search.mockRejectedValueOnce(new Error("search failed"));

    const result = await moduleUnderTest.run(validRequest());

    expect(result.cleanupSummary.devicesVisited).toBe(0);
    expect(result.cleanupSummary.batchesDeleted).toBe(0);
    expect(mockLogger.error).toHaveBeenCalledWith(
      ERRORS.ELASTICSEARCH_READ_ERROR
    );
  });

  test("logs ElasticSearch lock error and continues when locking a device fails", async () => {
    mockDataStoreClient.search.mockResolvedValueOnce({
      body: {
        hits: {
          hits: [
            {
              _id: "100250001",
              _source: {
                mountName: "100250001",
                batch: [
                  {
                    batchTimestamp: new Date().toJSON()
                  }
                ]
              }
            }
          ]
        }
      }
    });
    mockDataStoreClient.index.mockRejectedValueOnce(new Error("lock failed"));

    const result = await moduleUnderTest.run(validRequest());

    expect(result.cleanupSummary.devicesVisited).toBe(1);
    expect(result.cleanupSummary.mountNames).toEqual(["100250001"]);
    expect(mockDataStoreClient.index).toHaveBeenCalledTimes(2);
    expect(mockLogger.error).toHaveBeenCalledWith(
      ERRORS.ELASTICSEARCH_LOCK_ERROR
    );
  });

  test("logs ElasticSearch write error and continues when saving a cleaned device fails", async () => {
    mockDataStoreClient.search.mockResolvedValueOnce({
      body: {
        hits: {
          hits: [
            {
              _id: "100250001",
              _source: {
                mountName: "100250001",
                batch: [
                  {
                    batchTimestamp: new Date(Date.now() - 72 * 3600 * 1000).toJSON()
                  },
                  {
                    batchTimestamp: new Date().toJSON()
                  }
                ]
              }
            }
          ]
        }
      }
    });
    mockDataStoreClient.index
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("save failed"));

    const result = await moduleUnderTest.run(validRequest());

    expect(result.cleanupSummary.devicesVisited).toBe(1);
    expect(result.cleanupSummary.batchesDeleted).toBe(1);
    expect(mockDataStoreClient.index).toHaveBeenCalledTimes(2);
    expect(mockLogger.error).toHaveBeenCalledWith(
      ERRORS.ELASTICSEARCH_WRITE_ERROR
    );
  });
});
