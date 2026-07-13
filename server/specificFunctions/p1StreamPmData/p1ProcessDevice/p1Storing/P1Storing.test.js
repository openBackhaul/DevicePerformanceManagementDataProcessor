jest.mock("../../../../infra/onf/onfAdapter", () => ({
  getEsClient: jest.fn()
}));

jest.mock("../../../../utils/retry", () => ({
  withRetry: jest.fn()
}));

const mockLogger = {
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

jest.mock("../../../../service/LoggingService.js", () => ({
  getLogger: jest.fn(() => mockLogger)
}));

const onfAdapter = require("../../../../infra/onf/onfAdapter");
const { withRetry } = require("../../../../utils/retry");
const moduleUnderTest = require("./P1Storing");
const ERRORS = require("./ErrorsEnum");

const validDataStoreEsClient = {
  uuid: "datastore-uuid",
  "index-alias": "datastore-index"
};

function validRequest(overrides = {}) {
  return {
    dataStoreEsClient: validDataStoreEsClient,
    resultCc: {
      mountName: "100250001",
      uuid: "cc-uuid"
    },
    interfaceMetadataList: [],
    mountName: "100250001",
    logger: mockLogger,
    ...overrides
  };
}

describe("P1Storing", () => {
  let mockDataStoreClient;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDataStoreClient = {
      get: jest.fn().mockResolvedValue({
        body: {
          _source: {
            mountName: "100250001",
            batch: []
          }
        }
      }),
      index: jest.fn().mockResolvedValue({})
    };

    onfAdapter.getEsClient.mockResolvedValue(mockDataStoreClient);
    withRetry.mockImplementation((fn) => fn());
  });

  test("exports a run function", () => {
    expect(moduleUnderTest.run).toBeDefined();
    expect(typeof moduleUnderTest.run).toBe("function");
  });

  test("throws dataStoreEsClient not provided when request is missing", async () => {
    await expect(moduleUnderTest.run()).rejects.toThrow(
      ERRORS.DATA_STORE_ES_CLIENT_NOT_PROVIDED
    );
  });

  test("throws dataStoreEsClient invalid when required address fields are missing", async () => {
    await expect(
      moduleUnderTest.run(validRequest({ dataStoreEsClient: { uuid: "only" } }))
    ).rejects.toThrow(ERRORS.DATA_STORE_ES_CLIENT_INVALID);
  });

  test("throws resultCc not provided when resultCc is missing", async () => {
    await expect(
      moduleUnderTest.run(validRequest({ resultCc: undefined }))
    ).rejects.toThrow(ERRORS.RESULT_CC_NOT_PROVIDED);
  });

  test("throws resultCc invalid when resultCc is not an object", async () => {
    await expect(
      moduleUnderTest.run(validRequest({ resultCc: "invalid" }))
    ).rejects.toThrow(ERRORS.RESULT_CC_INVALID);
  });

  test("throws interfaceMetadataList not provided when interfaceMetadataList is missing", async () => {
    await expect(
      moduleUnderTest.run(validRequest({ interfaceMetadataList: undefined }))
    ).rejects.toThrow(ERRORS.INTERFACE_METADATA_LIST_NOT_PROVIDED);
  });

  test("throws interfaceMetadataList invalid when interfaceMetadataList is not an array", async () => {
    await expect(
      moduleUnderTest.run(validRequest({ interfaceMetadataList: {} }))
    ).rejects.toThrow(ERRORS.INTERFACE_METADATA_LIST_INVALID);
  });

  test("stores a new batch and unlocks the document on success", async () => {
    const result = await moduleUnderTest.run(validRequest());

    expect(result.mountName).toBe("100250001");
    expect(result.batch).toHaveLength(1);
    expect(mockDataStoreClient.index).toHaveBeenCalledTimes(2);
    expect(mockDataStoreClient.index).toHaveBeenLastCalledWith(
      expect.objectContaining({
        index: "datastore-index",
        id: "100250001",
        body: expect.objectContaining({
          locked: false,
          "interface-metadata-list": [],
          batch: expect.arrayContaining([
            expect.objectContaining({
              resultCc: expect.objectContaining({
                mountName: "100250001"
              })
            })
          ])
        })
      })
    );
  });

  test("creates a new datastore document when existing document is not found", async () => {
    const notFound = new Error("not found");
    notFound.meta = { statusCode: 404 };
    mockDataStoreClient.get.mockRejectedValue(notFound);

    const result = await moduleUnderTest.run(validRequest());

    expect(result.batch).toHaveLength(1);
    expect(mockDataStoreClient.index).toHaveBeenCalledTimes(2);
  });

  test("supports hyphenated interface input names", async () => {
    const result = await moduleUnderTest.run({
      "data-store-es-client": validDataStoreEsClient,
      "result-cc": {
        "mount-name": "100250002"
      },
      "interface-metadata-list": [],
      logger: mockLogger
    });

    expect(result.mountName).toBe("100250002");
  });

  test("logs ElasticSearch lock error and continues when locking fails", async () => {
    mockDataStoreClient.index.mockRejectedValueOnce(new Error("lock failed"));

    const result = await moduleUnderTest.run(validRequest());

    expect(result.mountName).toBe("100250001");
    expect(result.batch).toHaveLength(1);
    expect(mockDataStoreClient.index).toHaveBeenCalledTimes(2);
    expect(mockLogger.error).toHaveBeenCalledWith(
      ERRORS.ELASTICSEARCH_LOCK_ERROR
    );
  });

  test("logs Writing to dataStore failed and continues when final save fails", async () => {
    mockDataStoreClient.index
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("save failed"));

    const result = await moduleUnderTest.run(validRequest());

    expect(result.mountName).toBe("100250001");
    expect(result.batch).toHaveLength(1);
    expect(mockDataStoreClient.index).toHaveBeenCalledTimes(2);
    expect(mockLogger.error).toHaveBeenCalledWith(
      ERRORS.WRITING_TO_DATA_STORE_FAILED
    );
  });
});
