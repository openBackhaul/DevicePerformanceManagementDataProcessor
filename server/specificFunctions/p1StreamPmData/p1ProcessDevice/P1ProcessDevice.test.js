jest.mock("./p1LoadRawCc/P1LoadRawCc", () => ({
  run: jest.fn()
}));

jest.mock("./p1CreateResultCc/P1CreateResultCc", () => ({
  run: jest.fn()
}));

jest.mock("../../../infra/kafka/queueKafkaOutbound", () => ({
  run: jest.fn()
}));

jest.mock("./p1Storing/P1Storing", () => ({
  run: jest.fn()
}));

jest.mock("../../../utils/functionTree.js", () => ({
  findFunctionNode: jest.fn()
}));

jest.mock("./p1FormattingOutputApt/P1FormattingOutputApt", () => jest.fn());
jest.mock("./p1FormattingOutputOnf/P1FormattingOutputOnf", () => jest.fn());

const p1LoadRawCc = require("./p1LoadRawCc/P1LoadRawCc");
const p1CreateResultCc = require("./p1CreateResultCc/P1CreateResultCc");
const redisQueueKafkaOutbound = require("../../../infra/kafka/queueKafkaOutbound");
const p1Storing = require("./p1Storing/P1Storing");
const { findFunctionNode } = require("../../../utils/functionTree.js");
const p1FormattingOutputApt = require("./p1FormattingOutputApt/P1FormattingOutputApt");
const p1FormattingOutputOnf = require("./p1FormattingOutputOnf/P1FormattingOutputOnf");
const { run } = require("./P1ProcessDevice");
const ERRORS = require("./ErrorsEnum");

const logger = {
  info: jest.fn(),
  error: jest.fn()
};

function validRequest(overrides = {}) {
  return {
    mountName: "device-1",
    parameters: {
      "sub-function": "p1LoadRawCc"
    },
    configFile: { contents: "config" },
    mwdiReplicaEsClient: { uuid: "mwdi" },
    dataStoreEsClient: { uuid: "data-store" },
    kafkaConsumerTypes: "APT,ONF",
    logger,
    ...overrides
  };
}

describe("P1ProcessDevice", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    findFunctionNode.mockImplementation(() => ({ some: "parameter" }));

    p1LoadRawCc.run.mockResolvedValue({
      rawCc: { "logical-termination-point": [] },
      mountName: "device-1"
    });

    p1CreateResultCc.run.mockResolvedValue({
      resultCc: { "batch-timestamp": "2024-01-01T00:00:00Z" },
      interfaceMetadataList: []
    });

    p1FormattingOutputApt.mockResolvedValue({
      "format-name": "apt-output-format",
      "output-format": { "air-interface-list": [] }
    });

    p1FormattingOutputOnf.mockResolvedValue({
      "format-name": "onf-output-format",
      "output-format": { "ethernet-container-list": [] }
    });

    redisQueueKafkaOutbound.run.mockResolvedValue({});
    p1Storing.run.mockResolvedValue({});
  });

  test("exports a run function", () => {
    expect(typeof run).toBe("function");
  });

  test("throws Mount name not found when request has no mount name", async () => {
    const result = run({});
    await expect(result).rejects.toBeInstanceOf(Error);
    await expect(result).rejects.toMatchObject({
      message: ERRORS.MOUNT_NAME_NOT_FOUND
    });
  });

  test("preserves stage and retryability from a processing failure", async () => {
    const failure = new Error("upstream failure");
    failure.stage = "p1LoadRawCc";
    failure.retryable = false;
    p1LoadRawCc.run.mockRejectedValue(failure);

    await expect(run(validRequest())).rejects.toMatchObject({
      message: ERRORS.GENERAL_PROCESSING_ERROR,
      stage: "p1LoadRawCc",
      retryable: false,
      cause: failure
    });
  });

  test("runs the orchestration and stores results on success", async () => {
    const result = await run(validRequest());

    expect(result).toEqual({
      resultCc: { "batch-timestamp": "2024-01-01T00:00:00Z" },
      interfaceMetadataList: []
    });

    expect(p1LoadRawCc.run).toHaveBeenCalledWith(
      expect.objectContaining({
        mountName: "device-1",
        mwdiReplicaEsClient: { uuid: "mwdi" },
        dataStoreEsClient: { uuid: "data-store" }
      })
    );

    expect(p1CreateResultCc.run).toHaveBeenCalled();
    expect(p1FormattingOutputApt).toHaveBeenCalledWith(
      expect.objectContaining({
        "result-cc": { "batch-timestamp": "2024-01-01T00:00:00Z" }
      })
    );
    expect(p1FormattingOutputOnf).toHaveBeenCalledWith(
      expect.objectContaining({
        "result-cc": { "batch-timestamp": "2024-01-01T00:00:00Z" }
      })
    );
    expect(redisQueueKafkaOutbound.run).toHaveBeenCalledTimes(2);
    expect(p1Storing.run).toHaveBeenCalled();
  });
});
