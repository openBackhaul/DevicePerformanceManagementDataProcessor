jest.mock("../../../../utils/functionTree", () => ({
  getParamFromFunction: jest.fn()
}));

jest.mock("../../../../utils/retry", () => ({
  withRetry: jest.fn((task) => task())
}));

const { getParamFromFunction } = require("../../../../utils/functionTree");
const { withRetry } = require("../../../../utils/retry");
const p2Storing = require("./P2Storing");

function request(overrides = {}) {
  return {
    parameters: {},
    dataStoreEsClient: { uuid: "store", "index-alias": "data-store" },
    resultCc: {
      "batch-timestamp": "2026-09-21T10:00:00.000Z",
      value: "new"
    },
    offsets: [{ "function-name": "load", offset: 4 }],
    statusData: [{ "function-name": "load", status: {} }],
    mountName: "device-1",
    atomicDataStoreUpsertEnabled: true,
    esClient: {
      get: jest.fn(),
      update: jest.fn().mockResolvedValue({ result: "updated" })
    },
    logger: { error: jest.fn() },
    ...overrides
  };
}

describe("P2Storing atomic upsert", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getParamFromFunction.mockReturnValue("activated");
  });

  test("atomically updates processing data and upserts a batch without limiting history", async () => {
    const input = request();

    await expect(p2Storing.run(input)).resolves.toEqual({
      "mount-name": "device-1",
      "batch-timestamp": "2026-09-21T10:00:00.000Z"
    });

    expect(input.esClient.get).not.toHaveBeenCalled();
    expect(input.esClient.update).toHaveBeenCalledTimes(1);
    const updateRequest = input.esClient.update.mock.calls[0][0];
    expect(updateRequest).toEqual(expect.objectContaining({
      index: "data-store",
      id: "device-1",
      retry_on_conflict: 3
    }));
    expect(updateRequest.body.scripted_upsert).toBe(true);
    expect(updateRequest.body.script.params.resultEntry).toEqual({
      "batch-timestamp": "2026-09-21T10:00:00.000Z",
      "result-cc": input.resultCc
    });
    expect(updateRequest.body.script.source).toContain("existingIndex");
    expect(updateRequest.body.script.source).not.toContain("historyLimit");
    expect(updateRequest.body.upsert["result-data"]).toHaveLength(1);
    expect(withRetry).toHaveBeenCalledTimes(1);
  });

  test("does not create or replace result-data when storingResultCc is deactivated", async () => {
    getParamFromFunction.mockReturnValue("deactivated");
    const input = request();

    await p2Storing.run(input);

    const updateRequest = input.esClient.update.mock.calls[0][0];
    expect(updateRequest.body.script.params.storeResultCc).toBe(false);
    expect(updateRequest.body.upsert).not.toHaveProperty("result-data");
    expect(updateRequest.body.upsert["processing-data"]).toEqual({
      offsets: input.offsets,
      "status-data": input.statusData
    });
  });

  test("wraps an exhausted atomic update as a retryable storing error", async () => {
    const input = request();
    input.esClient.update.mockRejectedValue(new Error("temporarily unavailable"));

    await expect(p2Storing.run(input)).rejects.toMatchObject({
      message: "resultData could not be stored",
      stage: "p2Storing",
      retryable: true
    });
  });
});
