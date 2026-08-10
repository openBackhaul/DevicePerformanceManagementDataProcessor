"use strict";

// Mock getParamFromFunction using factory-function syntax (per team convention —
// avoids pulling in extra mocking helpers that are blocked by the corporate
// npm registry). Adjust this path if your test file doesn't sit in the same
// folder as p2LoadRawCc.js.
jest.mock("../../../../utils/functionTree", () => ({
  getParamFromFunction: jest.fn()
}));

const { getParamFromFunction } = require("../../../../utils/functionTree");
const { run } = require("./p2LoadRawCc");

describe("p2LoadRawCc", () => {
  let baseRequest;
  let replicaClient;
  let p1FieldsFilterMock;
  let p2DiscardIrrelevantPmRecordsMock;
  let p1CalculateInterfacePmDataQualityMock;

  const rawControlConstruct = {
    "logical-termination-point": [
      {
        uuid: "ltp-air-1",
        "layer-protocol": [
          {
            "air-interface-2-0:air-interface-pac": {
              "air-interface-historical-performances": {
                "historical-performance-data-list": [
                  { timestamp: "2024-01-01T00:15:00Z" }
                ]
              },
              "air-interface-current-performance": {
                "current-performance-data-list": [
                  { timestamp: "2024-01-01T00:30:00Z" }
                ]
              }
            }
          }
        ]
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();

    replicaClient = {
      get: jest.fn().mockResolvedValue({
        body: {
          _source: {
            "core-model-1-4:control-construct": [
              { uuid: "device-1", ...rawControlConstruct }
            ]
          }
        }
      })
    };

    p1FieldsFilterMock = jest.fn();
    p2DiscardIrrelevantPmRecordsMock = jest.fn().mockResolvedValue({
      "filtered-historical-performance-data-list": [
        { timestamp: "2024-01-01T00:15:00Z" }
      ],
      "new-most-recent-period-end-time": "2024-01-01T00:15:00Z",
      "new-most-recent-period-end-time-24": "2024-01-01T00:00:00Z",
      "amount-received": [{ date: "2024/01/01", count: 1 }]
    });
    p1CalculateInterfacePmDataQualityMock = jest.fn().mockResolvedValue({
      "interface-pm-data-quality": {
        uuid: "ltp-air-1",
        quality: [{ date: "2024/01/01", received: 1, expected: 96 }]
      }
    });

    getParamFromFunction.mockReturnValue("");

    baseRequest = {
      parameters: {},
      mwdiReplicaEsClient: {
        uuid: "es-client-1",
        "index-alias": "mwdireplica"
      },
      mountName: "device-1",
      offsets: [],
      replicaClient,
      dependencies: {
        p1FieldsFilter: p1FieldsFilterMock,
        p2DiscardIrrelevantPmRecords: p2DiscardIrrelevantPmRecordsMock,
        p1CalculateInterfacePmDataQuality: p1CalculateInterfacePmDataQualityMock
      }
    };
  });

  describe("input validation", () => {
    it("throws when parameters is missing", async () => {
      delete baseRequest.parameters;
      await expect(run(baseRequest)).rejects.toThrow("parameters not provided");
    });

    it("throws when parameters is not an object", async () => {
      baseRequest.parameters = "not-an-object";
      await expect(run(baseRequest)).rejects.toThrow("parameters invalid");
    });

    it("throws when mwdiReplicaEsClient is missing", async () => {
      delete baseRequest.mwdiReplicaEsClient;
      await expect(run(baseRequest)).rejects.toThrow("mwdiReplicaEsClient not provided");
    });

    it("throws when mwdiReplicaEsClient is missing required fields", async () => {
      baseRequest.mwdiReplicaEsClient = { uuid: "es-client-1" }; // missing index-alias
      await expect(run(baseRequest)).rejects.toThrow("mwdiReplicaEsClient invalid");
    });

    it("throws when mountName is missing", async () => {
      delete baseRequest.mountName;
      await expect(run(baseRequest)).rejects.toThrow("mountName not provided");
    });

    it("throws when mountName is an empty string", async () => {
      baseRequest.mountName = "   ";
      await expect(run(baseRequest)).rejects.toThrow("mountName invalid");
    });

    it("throws when offsets is missing", async () => {
      delete baseRequest.offsets;
      await expect(run(baseRequest)).rejects.toThrow("offsets not provided");
    });

    it("throws when offsets is not an array", async () => {
      baseRequest.offsets = "not-an-array";
      await expect(run(baseRequest)).rejects.toThrow("offsets invalid");
    });
  });

  describe("reading the control construct", () => {
    it("throws a retryable error when the ES read fails", async () => {
      replicaClient.get.mockRejectedValue(new Error("connection refused"));

      await expect(run(baseRequest)).rejects.toMatchObject({
        message: "rawCc could not be provided",
        retryable: true
      });
    });

    it("throws when the ES response has no usable control construct", async () => {
      replicaClient.get.mockResolvedValue({ body: { _source: {} } });

      await expect(run(baseRequest)).rejects.toThrow("rawCc could not be provided");
    });
  });

  describe("fields filter", () => {
    it("skips p1FieldsFilter entirely when no filter string is configured", async () => {
      getParamFromFunction.mockReturnValue("");

      await run(baseRequest);

      expect(p1FieldsFilterMock).not.toHaveBeenCalled();
    });

    it("applies p1FieldsFilter when a filter string is present in parameters", async () => {
      getParamFromFunction.mockReturnValue("uuid;layer-protocol");
      p1FieldsFilterMock.mockResolvedValue({
        "filtered-data-structure": {
          "logical-termination-point": []
        }
      });

      const result = await run(baseRequest);

      expect(p1FieldsFilterMock).toHaveBeenCalledWith(
        expect.objectContaining({ "fields-filter-string": "uuid;layer-protocol" })
      );
      expect(result["raw-cc"]).toEqual({ "logical-termination-point": [] });
    });

    it("throws when p1FieldsFilter returns no usable filtered structure", async () => {
      getParamFromFunction.mockReturnValue("uuid");
      p1FieldsFilterMock.mockResolvedValue({});

      await expect(run(baseRequest)).rejects.toThrow("rawCc could not be provided");
    });
  });

  describe("successful run", () => {
    it("returns raw-cc, offsets, and device-pm-data-quality", async () => {
      const result = await run(baseRequest);

      expect(result).toHaveProperty("raw-cc");
      expect(result).toHaveProperty("offsets");
      expect(result).toHaveProperty("device-pm-data-quality");
      expect(result["device-pm-data-quality"]).toEqual({
        "mount-name": "device-1",
        interface: [
          {
            uuid: "ltp-air-1",
            quality: [{ date: "2024/01/01", received: 1, expected: 96 }]
          }
        ]
      });
    });

    it("creates a new p2LoadRawCc offset entry when none exists yet", async () => {
      const result = await run(baseRequest);

      const functionOffset = result.offsets.find(
        (item) => item["function-name"] === "p2LoadRawCc"
      );
      expect(functionOffset).toBeDefined();
      expect(functionOffset.offset["interface-offsets"]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ uuid: "ltp-air-1" })
        ])
      );
    });

    it("reuses and updates an existing interface offset instead of resetting it", async () => {
      baseRequest.offsets = [
        {
          "function-name": "p2LoadRawCc",
          offset: {
            "interface-offsets": [
              {
                uuid: "ltp-air-1",
                "most-recent-period-end-time": "2023-06-01T00:00:00Z",
                "most-recent-period-end-time-24": "2023-06-01T00:00:00Z"
              }
            ]
          }
        }
      ];

      const result = await run(baseRequest);

      expect(p2DiscardIrrelevantPmRecordsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          "former-most-recent-period-end-time": "2023-06-01T00:00:00Z"
        })
      );

      const functionOffset = result.offsets.find(
        (item) => item["function-name"] === "p2LoadRawCc"
      );
      const interfaceOffset = functionOffset.offset["interface-offsets"].find(
        (item) => item.uuid === "ltp-air-1"
      );
      expect(interfaceOffset["most-recent-period-end-time"]).toBe(
        "2024-01-01T00:15:00Z"
      );
    });

    it("does not mutate the offsets array that was passed in", async () => {
      const originalOffsets = [];
      baseRequest.offsets = originalOffsets;

      await run(baseRequest);

      expect(originalOffsets).toEqual([]);
    });
  });

  describe("pm data quality failure", () => {
    it("throws when p1CalculateInterfacePmDataQuality returns no usable result", async () => {
      p1CalculateInterfacePmDataQualityMock.mockResolvedValue(
        "UUID_NOT_PROVIDED" // delivered module returns an error string/enum on failure
      );

      await expect(run(baseRequest)).rejects.toThrow(
        "pmDataQuality could not be provided"
      );
    });
  });
});