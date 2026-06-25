jest.mock("../../../../infra/onf/onfAdapter", () => ({
    getEsClient: jest.fn()
}));

jest.mock("../../../../utils/functionTree", () => ({
    getParamFromFunction: jest.fn()
}));

jest.mock("../../../../utils/retry", () => ({
    withRetry: jest.fn()
}));

jest.mock("../../../../genericFunctions/p1FieldsFilter/P1FieldsFilter", () => ({
    run: jest.fn()
}));

jest.mock("../../../../genericFunctions/p1DiscardIrrelevantPmRecords/P1DiscardIrrelevantPmRecords", () => jest.fn());

const onfAdapter = require("../../../../infra/onf/onfAdapter");
const { getParamFromFunction } = require("../../../../utils/functionTree");
const { withRetry } = require("../../../../utils/retry");
const p1FieldsFilter = require("../../../../genericFunctions/p1FieldsFilter/P1FieldsFilter");
const p1DiscardIrrelevantPmRecords = require("../../../../genericFunctions/p1DiscardIrrelevantPmRecords/P1DiscardIrrelevantPmRecords");
const ERRORS = require("./ErrorsEnum");
const moduleUnderTest = require("./P1LoadRawCc");

describe("P1LoadRawCc Unit Tests", () => {
    const replicaClient = { get: jest.fn() };
    const dataStoreClient = { get: jest.fn() };
    const mwdiReplicaEsClient = { uuid: "replica-uuid", "index-alias": "replica-alias" };
    const dataStoreEsClient = { uuid: "store-uuid", "index-alias": "store-alias" };
    const mountName = "test-mount";

    beforeEach(() => {
        jest.clearAllMocks();
        onfAdapter.getEsClient.mockResolvedValue(replicaClient);
        getParamFromFunction.mockImplementation((parameters, functionName) => {
            if (functionName === "p1FieldsFilter") {
                return "fields-filter";
            }
            if (functionName === "p1DiscardIrrelevantPmRecords") {
                return ".*";
            }
            return "";
        });
        withRetry.mockImplementation(async (fn) => fn());
        p1FieldsFilter.run.mockResolvedValue({ "filtered-data-structure": {} });
        p1DiscardIrrelevantPmRecords.mockResolvedValue({ "filtered-historical-performance-data-list": [] });
    });

    test("should export run function", () => {
        expect(moduleUnderTest.run).toBeDefined();
        expect(typeof moduleUnderTest.run).toBe("function");
    });

    describe("Input Validation", () => {
        test("should throw when request is null", async () => {
            await expect(moduleUnderTest.run(null)).rejects.toThrow(ERRORS.PARAMETERS_NOT_PROVIDED);
        });

        test("should throw when parameters are missing", async () => {
            await expect(moduleUnderTest.run({})).rejects.toThrow(ERRORS.PARAMETERS_NOT_PROVIDED);
        });

        test("should throw when mwdiReplicaEsClient is invalid", async () => {
            await expect(moduleUnderTest.run({ parameters: {}, dataStoreEsClient, mountName })).rejects.toThrow(ERRORS.MWDI_REPLICA_ES_CLIENT_NOT_PROVIDED);
        });

        test("should throw when dataStoreEsClient is invalid", async () => {
            await expect(moduleUnderTest.run({ parameters: {}, mwdiReplicaEsClient, mountName })).rejects.toThrow(ERRORS.DATA_STORE_ES_CLIENT_NOT_PROVIDED);
        });

        test("should throw when mountName is invalid", async () => {
            await expect(moduleUnderTest.run({ parameters: {}, mwdiReplicaEsClient, dataStoreEsClient, mountName: "    " })).rejects.toThrow(ERRORS.MOUNT_NAME_INVALID);
        });
    });

    test("should throw MWDI_REPLICA_ES_CLIENT_INVALID when replica client initialization fails", async () => {
        onfAdapter.getEsClient.mockRejectedValueOnce(new Error("client init failed"));

        await expect(moduleUnderTest.run({ parameters: {}, mwdiReplicaEsClient, dataStoreEsClient, mountName })).rejects.toThrow(ERRORS.MWDI_REPLICA_ES_CLIENT_INVALID);
    });

    test("should throw RAW_CC_COULD_NOT_BE_PROVIDED when replica ES get fails", async () => {
        replicaClient.get.mockRejectedValueOnce(new Error("read failed"));
        withRetry.mockRejectedValueOnce(new Error("retry failed"));

        await expect(moduleUnderTest.run({ parameters: {}, mwdiReplicaEsClient, dataStoreEsClient, mountName })).rejects.toThrow(ERRORS.RAW_CC_COULD_NOT_BE_PROVIDED);
    });

    test("should throw RAW_CC_COULD_NOT_BE_PROVIDED when p1FieldsFilter throws", async () => {
        replicaClient.get.mockResolvedValue({ body: { _source: { "core-model-1-4:control-construct": { uuid: mountName } } } });
        p1FieldsFilter.run.mockRejectedValueOnce(new Error("fields filter failure"));

        await expect(moduleUnderTest.run({ parameters: {}, mwdiReplicaEsClient, dataStoreEsClient, mountName })).rejects.toThrow(ERRORS.RAW_CC_COULD_NOT_BE_PROVIDED);
    });

    test("should throw RAW_CC_COULD_NOT_BE_PROVIDED when p1FieldsFilter returns invalid response", async () => {
        replicaClient.get.mockResolvedValue({ body: { _source: { "core-model-1-4:control-construct": { uuid: mountName } } } });
        p1FieldsFilter.run.mockResolvedValueOnce({ invalid: true });

        await expect(moduleUnderTest.run({ parameters: {}, mwdiReplicaEsClient, dataStoreEsClient, mountName })).rejects.toThrow(ERRORS.RAW_CC_COULD_NOT_BE_PROVIDED);
    });

    test("should return rawCc with filtered historical data and latest batchTimestamp", async () => {
        const rawCc = {
            "logical-termination-point": [
                {
                    uuid: "ltp-1",
                    "layer-protocol": [
                        {
                            "layer-protocol-name": "air-interface-2-0",
                            "air-interface-2-0:air-interface-pac": {
                                "air-interface-current-performance": {
                                    "current-performance-data-list": [
                                        { "granularity-period": "PT15M", timestamp: "2025-01-01T00:00:00Z" },
                                        { "granularity-period": "", timestamp: "" }
                                    ]
                                },
                                "air-interface-historical-performances": {
                                    "historical-performance-data-list": [
                                        { record: 1 }
                                    ]
                                }
                            }
                        },
                        {
                            "layer-protocol-name": "irrelevant",
                            "other-pac": {}
                        }
                    ]
                }
            ]
        };

        replicaClient.get.mockResolvedValue({ body: { _source: { "core-model-1-4:control-construct": rawCc } } });
        dataStoreClient.get.mockResolvedValue({ body: { _source: { "interface-metadata-list": [{ uuid: "ltp-1", mostRecentPeriodEndTime: "2025-01-01T00:00:00Z", mostRecentPeriodEndTime24: "2024-12-31T00:00:00Z" }] } } });
        onfAdapter.getEsClient.mockResolvedValueOnce(replicaClient).mockResolvedValueOnce(dataStoreClient);
        p1FieldsFilter.run.mockResolvedValueOnce({ "filtered-data-structure": rawCc });
        p1DiscardIrrelevantPmRecords.mockResolvedValueOnce({ "filtered-historical-performance-data-list": [{ kept: true }] });

        const result = await moduleUnderTest.run({ parameters: {}, mwdiReplicaEsClient, dataStoreEsClient, mountName });

        expect(result).toBeDefined();
        expect(result.rawCc.batchTimestamp).toBe("2025-01-01T00:00:00Z");
        expect(result.rawCc["logical-termination-point"][0]["layer-protocol"]).toHaveLength(1);
        expect(result.rawCc["logical-termination-point"][0]["layer-protocol"][0]["air-interface-2-0:air-interface-pac"]["air-interface-current-performance"]["current-performance-data-list"]).toEqual([
            { "granularity-period": "PT15M", timestamp: "2025-01-01T00:00:00Z" }
        ]);
        expect(result.rawCc["logical-termination-point"][0]["layer-protocol"][0]["air-interface-2-0:air-interface-pac"]["air-interface-historical-performances"]).toEqual([{ kept: true }]);

        expect(p1DiscardIrrelevantPmRecords).toHaveBeenCalledTimes(1);
        expect(p1DiscardIrrelevantPmRecords).toHaveBeenCalledWith(expect.objectContaining({
            "historical-performance-data-list": [{ record: 1 }],
            "relevant-granularities": ".*",
            "most-recent-period-end-time": expect.any(Date),
            "most-recent-period-end-time-24": expect.any(Date)
        }));
    });

    test("should set default batchTimestamp when no valid air interface timestamps are present", async () => {
        const rawCc = {
            "logical-termination-point": [
                {
                    uuid: "ltp-1",
                    "layer-protocol": [
                        {
                            "layer-protocol-name": "air-interface-2-0",
                            "air-interface-2-0:air-interface-pac": {
                                "air-interface-current-performance": {
                                    "current-performance-data-list": [
                                        { "granularity-period": "PT15M", timestamp: "" },
                                        { "granularity-period": "PT15M" }
                                    ]
                                },
                                "air-interface-historical-performances": {
                                    "historical-performance-data-list": []
                                }
                            }
                        }
                    ]
                }
            ]
        };

        replicaClient.get.mockResolvedValue({ body: { _source: { "core-model-1-4:control-construct": rawCc } } });
        dataStoreClient.get.mockResolvedValue({ body: { _source: { "interface-metadata-list": [{ uuid: "ltp-1" }] } } });
        onfAdapter.getEsClient.mockResolvedValueOnce(replicaClient).mockResolvedValueOnce(dataStoreClient);
        p1FieldsFilter.run.mockResolvedValueOnce({ "filtered-data-structure": rawCc });
        p1DiscardIrrelevantPmRecords.mockResolvedValueOnce({ "filtered-historical-performance-data-list": [] });

        const result = await moduleUnderTest.run({ parameters: {}, mwdiReplicaEsClient, dataStoreEsClient, mountName });

        expect(result.rawCc.batchTimestamp).toBe("2010-11-20T14:00:00+01:00");
    });

    test("should continue when data store metadata load fails and still return rawCc", async () => {
        const rawCc = {
            "logical-termination-point": [
                {
                    uuid: "ltp-1",
                    "layer-protocol": [
                        {
                            "layer-protocol-name": "air-interface-2-0",
                            "air-interface-2-0:air-interface-pac": {
                                "air-interface-current-performance": {
                                    "current-performance-data-list": [
                                        { "granularity-period": "PT15M", timestamp: "2025-01-01T01:00:00Z" }
                                    ]
                                },
                                "air-interface-historical-performances": {
                                    "historical-performance-data-list": []
                                }
                            }
                        }
                    ]
                }
            ]
        };

        replicaClient.get.mockResolvedValue({ body: { _source: { "core-model-1-4:control-construct": rawCc } } });
        withRetry
            .mockImplementationOnce(async (fn) => fn())
            .mockImplementationOnce(async () => { throw new Error("data store failure"); });
        onfAdapter.getEsClient.mockResolvedValueOnce(replicaClient).mockResolvedValueOnce(dataStoreClient);
        p1FieldsFilter.run.mockResolvedValueOnce({ "filtered-data-structure": rawCc });
        p1DiscardIrrelevantPmRecords.mockResolvedValueOnce({ "filtered-historical-performance-data-list": [] });

        const result = await moduleUnderTest.run({ parameters: {}, mwdiReplicaEsClient, dataStoreEsClient, mountName });

        expect(result.rawCc.batchTimestamp).toBe("2025-01-01T01:00:00Z");
    });

    test("should throw GENERAL_PROCESSING_ERROR when discard helper returns invalid response", async () => {
        const rawCc = {
            "logical-termination-point": [
                {
                    uuid: "ltp-1",
                    "layer-protocol": [
                        {
                            "layer-protocol-name": "air-interface-2-0",
                            "air-interface-2-0:air-interface-pac": {
                                "air-interface-current-performance": {
                                    "current-performance-data-list": [
                                        { "granularity-period": "PT15M", timestamp: "2025-01-02T00:00:00Z" }
                                    ]
                                },
                                "air-interface-historical-performances": {
                                    "historical-performance-data-list": []
                                }
                            }
                        }
                    ]
                }
            ]
        };

        replicaClient.get.mockResolvedValue({ body: { _source: { "core-model-1-4:control-construct": rawCc } } });
        dataStoreClient.get.mockResolvedValue({ body: { _source: { "interface-metadata-list": [{ uuid: "ltp-1" }] } } });
        onfAdapter.getEsClient.mockResolvedValueOnce(replicaClient).mockResolvedValueOnce(dataStoreClient);
        p1FieldsFilter.run.mockResolvedValueOnce({ "filtered-data-structure": rawCc });
        p1DiscardIrrelevantPmRecords.mockResolvedValueOnce({ invalid: true });

        await expect(moduleUnderTest.run({ parameters: {}, mwdiReplicaEsClient, dataStoreEsClient, mountName })).rejects.toThrow(ERRORS.GENERAL_PROCESSING_ERROR);
    });
});
