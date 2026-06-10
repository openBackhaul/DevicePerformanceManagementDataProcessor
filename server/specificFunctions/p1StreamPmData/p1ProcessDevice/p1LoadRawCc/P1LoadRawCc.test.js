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

jest.mock(
    "../../../../genericFunctions/p1DiscardIrrelevantPmRecords/P1DiscardIrrelevantPmRecords",
    () => jest.fn()
);

jest.mock("../../../../service/LoggingService.js", () => ({
    getLogger: jest.fn(() => ({
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }))
}));

const onfAdapter = require("../../../../infra/onf/onfAdapter");
const { getParamFromFunction } = require("../../../../utils/functionTree");
const { withRetry } = require("../../../../utils/retry");
const p1FieldsFilter = require("../../../../genericFunctions/p1FieldsFilter/P1FieldsFilter");
const p1DiscardIrrelevantPmRecords = require("../../../../genericFunctions/p1DiscardIrrelevantPmRecords/P1DiscardIrrelevantPmRecords");
const ERRORS = require("./ErrorsEnum");
const moduleUnderTest = require("./P1LoadRawCc");

const validMwdiReplicaEsClient = {
    uuid: "replica-uuid",
    "index-alias": "replica-index"
};

const validDataStoreEsClient = {
    uuid: "datastore-uuid",
    "index-alias": "datastore-index"
};

const validRequest = {
    parameters: { some: "params" },
    mwdiReplicaEsClient: validMwdiReplicaEsClient,
    dataStoreEsClient: validDataStoreEsClient,
    mountName: "100250001"
};

const DEFAULT_BATCH_TIMESTAMP = "2010-11-20T14:00:00+01:00";

describe("P1LoadRawCc Unit Tests", () => {
    let mockReplicaClient;
    let mockDataStoreClient;

    beforeEach(() => {
        jest.resetAllMocks();

        mockReplicaClient = {
            get: jest.fn()
        };

        mockDataStoreClient = {
            get: jest.fn()
        };

        onfAdapter.getEsClient
            .mockResolvedValueOnce(mockReplicaClient)
            .mockResolvedValueOnce(mockDataStoreClient);

        withRetry.mockImplementation((fn) => fn());

        mockReplicaClient.get.mockResolvedValue({
            body: {
                _source: {
                    "core-model-1-4:control-construct": {
                        uuid: "test-uuid"
                    }
                }
            }
        });

        mockDataStoreClient.get.mockResolvedValue({
            body: {
                _source: {
                    "interface-metadata-list": []
                }
            }
        });

        p1FieldsFilter.run.mockResolvedValue({
            "filtered-data-structure": {
                uuid: "test-uuid"
            }
        });

        p1DiscardIrrelevantPmRecords.mockResolvedValue({
            "filtered-historical-performance-data-list": []
        });

        getParamFromFunction
            .mockReturnValueOnce("")
            .mockReturnValueOnce(".*");
    });

    // ─── Module Validation ────────────────────────────────────────────────────

    describe("Module Validation", () => {
        test("should export run function", () => {
            expect(moduleUnderTest.run).toBeDefined();
            expect(typeof moduleUnderTest.run).toBe("function");
        });
    });

    // ─── Input Validation ─────────────────────────────────────────────────────

    describe("Input Validation", () => {
        test("should throw PARAMETERS_NOT_PROVIDED when request is null", async () => {
            await expect(
                moduleUnderTest.run(null)
            ).rejects.toThrow(ERRORS.PARAMETERS_NOT_PROVIDED);
        });

        test("should throw PARAMETERS_NOT_PROVIDED when request is undefined", async () => {
            await expect(
                moduleUnderTest.run(undefined)
            ).rejects.toThrow(ERRORS.PARAMETERS_NOT_PROVIDED);
        });

        test("should throw PARAMETERS_NOT_PROVIDED when parameters is missing", async () => {
            await expect(
                moduleUnderTest.run({
                    ...validRequest,
                    parameters: undefined
                })
            ).rejects.toThrow(ERRORS.PARAMETERS_NOT_PROVIDED);
        });

        test("should throw PARAMETERS_INVALID when parameters is null", async () => {
            await expect(
                moduleUnderTest.run({
                    ...validRequest,
                    parameters: null
                })
            ).rejects.toThrow(ERRORS.PARAMETERS_NOT_PROVIDED);
        });

        test("should throw PARAMETERS_INVALID when parameters is a string", async () => {
            await expect(
                moduleUnderTest.run({
                    ...validRequest,
                    parameters: "invalid"
                })
            ).rejects.toThrow(ERRORS.PARAMETERS_INVALID);
        });

        test("should throw PARAMETERS_INVALID when parameters is an array", async () => {
            await expect(
                moduleUnderTest.run({
                    ...validRequest,
                    parameters: []
                })
            ).rejects.toThrow(ERRORS.PARAMETERS_INVALID);
        });

        test("should throw MWDI_REPLICA_ES_CLIENT_NOT_PROVIDED when mwdiReplicaEsClient is missing", async () => {
            await expect(
                moduleUnderTest.run({
                    ...validRequest,
                    mwdiReplicaEsClient: undefined
                })
            ).rejects.toThrow(ERRORS.MWDI_REPLICA_ES_CLIENT_NOT_PROVIDED);
        });

        test("should throw MWDI_REPLICA_ES_CLIENT_NOT_PROVIDED when mwdiReplicaEsClient is null", async () => {
            await expect(
                moduleUnderTest.run({
                    ...validRequest,
                    mwdiReplicaEsClient: null
                })
            ).rejects.toThrow(ERRORS.MWDI_REPLICA_ES_CLIENT_NOT_PROVIDED);
        });

        test("should throw MWDI_REPLICA_ES_CLIENT_INVALID when mwdiReplicaEsClient is not an object", async () => {
            await expect(
                moduleUnderTest.run({
                    ...validRequest,
                    mwdiReplicaEsClient: "invalid"
                })
            ).rejects.toThrow(ERRORS.MWDI_REPLICA_ES_CLIENT_INVALID);
        });

        test("should throw MWDI_REPLICA_ES_CLIENT_INVALID when mwdiReplicaEsClient is an array", async () => {
            await expect(
                moduleUnderTest.run({
                    ...validRequest,
                    mwdiReplicaEsClient: []
                })
            ).rejects.toThrow(ERRORS.MWDI_REPLICA_ES_CLIENT_INVALID);
        });

        test("should throw MWDI_REPLICA_ES_CLIENT_INVALID when mwdiReplicaEsClient.uuid is missing", async () => {
            await expect(
                moduleUnderTest.run({
                    ...validRequest,
                    mwdiReplicaEsClient: {
                        "index-alias": "replica-index"
                    }
                })
            ).rejects.toThrow(ERRORS.MWDI_REPLICA_ES_CLIENT_INVALID);
        });

        test("should throw MWDI_REPLICA_ES_CLIENT_INVALID when mwdiReplicaEsClient index-alias is missing", async () => {
            await expect(
                moduleUnderTest.run({
                    ...validRequest,
                    mwdiReplicaEsClient: {
                        uuid: "replica-uuid"
                    }
                })
            ).rejects.toThrow(ERRORS.MWDI_REPLICA_ES_CLIENT_INVALID);
        });

        test("should throw DATA_STORE_ES_CLIENT_NOT_PROVIDED when dataStoreEsClient is missing", async () => {
            await expect(
                moduleUnderTest.run({
                    ...validRequest,
                    dataStoreEsClient: undefined
                })
            ).rejects.toThrow(ERRORS.DATA_STORE_ES_CLIENT_NOT_PROVIDED);
        });

        test("should throw DATA_STORE_ES_CLIENT_NOT_PROVIDED when dataStoreEsClient is null", async () => {
            await expect(
                moduleUnderTest.run({
                    ...validRequest,
                    dataStoreEsClient: null
                })
            ).rejects.toThrow(ERRORS.DATA_STORE_ES_CLIENT_NOT_PROVIDED);
        });

        test("should throw DATA_STORE_ES_CLIENT_INVALID when dataStoreEsClient is not an object", async () => {
            await expect(
                moduleUnderTest.run({
                    ...validRequest,
                    dataStoreEsClient: 123
                })
            ).rejects.toThrow(ERRORS.DATA_STORE_ES_CLIENT_INVALID);
        });

        test("should throw DATA_STORE_ES_CLIENT_INVALID when dataStoreEsClient is an array", async () => {
            await expect(
                moduleUnderTest.run({
                    ...validRequest,
                    dataStoreEsClient: []
                })
            ).rejects.toThrow(ERRORS.DATA_STORE_ES_CLIENT_INVALID);
        });

        test("should throw DATA_STORE_ES_CLIENT_INVALID when dataStoreEsClient.uuid is missing", async () => {
            await expect(
                moduleUnderTest.run({
                    ...validRequest,
                    dataStoreEsClient: {
                        "index-alias": "datastore-index"
                    }
                })
            ).rejects.toThrow(ERRORS.DATA_STORE_ES_CLIENT_INVALID);
        });

        test("should throw DATA_STORE_ES_CLIENT_INVALID when dataStoreEsClient index-alias is missing", async () => {
            await expect(
                moduleUnderTest.run({
                    ...validRequest,
                    dataStoreEsClient: {
                        uuid: "datastore-uuid"
                    }
                })
            ).rejects.toThrow(ERRORS.DATA_STORE_ES_CLIENT_INVALID);
        });

        test("should throw MOUNT_NAME_NOT_PROVIDED when mountName is missing", async () => {
            await expect(
                moduleUnderTest.run({
                    ...validRequest,
                    mountName: undefined
                })
            ).rejects.toThrow(ERRORS.MOUNT_NAME_NOT_PROVIDED);
        });

        test("should throw MOUNT_NAME_NOT_PROVIDED when mountName is null", async () => {
            await expect(
                moduleUnderTest.run({
                    ...validRequest,
                    mountName: null
                })
            ).rejects.toThrow(ERRORS.MOUNT_NAME_NOT_PROVIDED);
        });

        test("should throw MOUNT_NAME_INVALID when mountName is not a string", async () => {
            await expect(
                moduleUnderTest.run({
                    ...validRequest,
                    mountName: 100250001
                })
            ).rejects.toThrow(ERRORS.MOUNT_NAME_INVALID);
        });

        test("should throw MOUNT_NAME_INVALID when mountName is an empty string", async () => {
            await expect(
                moduleUnderTest.run({
                    ...validRequest,
                    mountName: "   "
                })
            ).rejects.toThrow(ERRORS.MOUNT_NAME_INVALID);
        });
    });

    // ─── Happy Path ───────────────────────────────────────────────────────────

    describe("Happy Path", () => {
        test("should return rawCc and mountName on success", async () => {
            const result = await moduleUnderTest.run(validRequest);

            expect(result).toHaveProperty("rawCc");
            expect(result).toHaveProperty("mountName", validRequest.mountName);
        });

        test("should call getEsClient for replica and dataStore", async () => {
            await moduleUnderTest.run(validRequest);

            expect(onfAdapter.getEsClient).toHaveBeenCalledTimes(2);

            expect(onfAdapter.getEsClient).toHaveBeenNthCalledWith(
                1,
                false,
                validMwdiReplicaEsClient.uuid,
                validMwdiReplicaEsClient,
                expect.anything()
            );

            expect(onfAdapter.getEsClient).toHaveBeenNthCalledWith(
                2,
                false,
                validDataStoreEsClient.uuid,
                validDataStoreEsClient,
                expect.anything()
            );
        });

        test("should read ControlConstruct from replica using mountName", async () => {
            await moduleUnderTest.run(validRequest);

            expect(mockReplicaClient.get).toHaveBeenCalledTimes(1);
            expect(mockReplicaClient.get).toHaveBeenCalledWith({
                index: validMwdiReplicaEsClient["index-alias"],
                id: validRequest.mountName
            });
        });

        test("should read interface metadata from data store using mountName", async () => {
            await moduleUnderTest.run(validRequest);

            expect(mockDataStoreClient.get).toHaveBeenCalledTimes(1);
            expect(mockDataStoreClient.get).toHaveBeenCalledWith({
                index: validDataStoreEsClient["index-alias"],
                id: validRequest.mountName
            });
        });

        test("should call p1FieldsFilter.run with rawCc and fieldsFilterString", async () => {
            await moduleUnderTest.run(validRequest);

            expect(p1FieldsFilter.run).toHaveBeenCalledTimes(1);
            expect(p1FieldsFilter.run).toHaveBeenCalledWith({
                dataStructure: {
                    uuid: "test-uuid"
                },
                fieldsFilterString: ""
            });
        });

        test("should fall back to mountName object when rawCc is missing in replica response", async () => {
            mockReplicaClient.get.mockResolvedValue({
                body: {
                    _source: {}
                }
            });

            p1FieldsFilter.run.mockResolvedValue({
                "filtered-data-structure": {
                    mountName: validRequest.mountName
                }
            });

            const result = await moduleUnderTest.run(validRequest);

            expect(result.rawCc).toHaveProperty("mountName", validRequest.mountName);
        });

        test("should remove LTPs with no relevant layer protocols after fields filter", async () => {
            p1FieldsFilter.run.mockResolvedValue({
                "filtered-data-structure": {
                    uuid: "test-uuid",
                    "logical-termination-point": [
                        {
                            uuid: "ltp-irrelevant",
                            "layer-protocol": [
                                {
                                    "layer-protocol-name": "some-other-protocol"
                                }
                            ]
                        }
                    ]
                }
            });

            const result = await moduleUnderTest.run(validRequest);

            expect(result.rawCc["logical-termination-point"]).toEqual([]);
        });

        test("should keep LTPs that have air-interface-pac", async () => {
            p1FieldsFilter.run.mockResolvedValue({
                "filtered-data-structure": {
                    uuid: "test-uuid",
                    "logical-termination-point": [
                        {
                            uuid: "ltp-air",
                            "layer-protocol": [
                                {
                                    "layer-protocol-name": "air-interface",
                                    "air-interface-2-0:air-interface-pac": {
                                        someField: "value"
                                    }
                                }
                            ]
                        }
                    ]
                }
            });

            const result = await moduleUnderTest.run(validRequest);

            expect(result.rawCc["logical-termination-point"]).toHaveLength(1);
            expect(result.rawCc["logical-termination-point"][0].uuid).toBe("ltp-air");
        });

        test("should keep LTPs that have ethernet-container-pac", async () => {
            p1FieldsFilter.run.mockResolvedValue({
                "filtered-data-structure": {
                    uuid: "test-uuid",
                    "logical-termination-point": [
                        {
                            uuid: "ltp-eth",
                            "layer-protocol": [
                                {
                                    "layer-protocol-name": "ethernet-container",
                                    "ethernet-container-2-0:ethernet-container-pac": {
                                        someField: "value"
                                    }
                                }
                            ]
                        }
                    ]
                }
            });

            const result = await moduleUnderTest.run(validRequest);

            expect(result.rawCc["logical-termination-point"]).toHaveLength(1);
            expect(result.rawCc["logical-termination-point"][0].uuid).toBe("ltp-eth");
        });

        test("should clean current-performance-data-list and keep only granularity-period and timestamp", async () => {
            p1FieldsFilter.run.mockResolvedValue({
                "filtered-data-structure": {
                    uuid: "test-uuid",
                    "logical-termination-point": [
                        {
                            uuid: "ltp-air",
                            "layer-protocol": [
                                {
                                    "layer-protocol-name": "air-interface",
                                    "air-interface-2-0:air-interface-pac": {
                                        "air-interface-current-performance": {
                                            "current-performance-data-list": [
                                                {
                                                    "granularity-period": "PERIOD-15-MIN",
                                                    timestamp: "2024-01-01T10:00:00Z",
                                                    unwanted: "remove-me"
                                                },
                                                {
                                                    "granularity-period": "",
                                                    timestamp: "2024-01-01T11:00:00Z"
                                                }
                                            ]
                                        }
                                    }
                                }
                            ]
                        }
                    ]
                }
            });

            const result = await moduleUnderTest.run(validRequest);

            const cleanedList =
                result.rawCc["logical-termination-point"][0]["layer-protocol"][0]
                ["air-interface-2-0:air-interface-pac"]
                ["air-interface-current-performance"]
                ["current-performance-data-list"];

            expect(cleanedList).toEqual([
                {
                    "granularity-period": "PERIOD-15-MIN",
                    timestamp: "2024-01-01T10:00:00Z"
                }
            ]);
        });

        test("should set default batchTimestamp when no air-interface current performance data exists", async () => {
            const result = await moduleUnderTest.run(validRequest);

            expect(result.rawCc.batchTimestamp).toBe(DEFAULT_BATCH_TIMESTAMP);
        });

        test("should set batchTimestamp to latest timestamp from current performance data", async () => {
            p1FieldsFilter.run.mockResolvedValue({
                "filtered-data-structure": {
                    uuid: "test-uuid",
                    "logical-termination-point": [
                        {
                            uuid: "ltp-air",
                            "layer-protocol": [
                                {
                                    "layer-protocol-name": "air-interface",
                                    "air-interface-2-0:air-interface-pac": {
                                        "air-interface-current-performance": {
                                            "current-performance-data-list": [
                                                {
                                                    "granularity-period": "PERIOD-15-MIN",
                                                    timestamp: "2024-01-01T10:00:00Z"
                                                },
                                                {
                                                    "granularity-period": "PERIOD-15-MIN",
                                                    timestamp: "2024-01-01T12:00:00Z"
                                                }
                                            ]
                                        }
                                    }
                                }
                            ]
                        }
                    ]
                }
            });

            const result = await moduleUnderTest.run(validRequest);

            expect(result.rawCc.batchTimestamp).toBe("2024-01-01T12:00:00Z");
        });

        test("should discard irrelevant air-interface historical PM records when list exists", async () => {
            p1FieldsFilter.run.mockResolvedValue({
                "filtered-data-structure": {
                    uuid: "test-uuid",
                    "logical-termination-point": [
                        {
                            uuid: "ltp-air",
                            "layer-protocol": [
                                {
                                    "layer-protocol-name": "air-interface",
                                    "air-interface-2-0:air-interface-pac": {
                                        "air-interface-historical-performances": {
                                            "historical-performance-data-list": [
                                                {
                                                    timestamp: "2024-01-01T00:00:00Z"
                                                }
                                            ]
                                        }
                                    }
                                }
                            ]
                        }
                    ]
                }
            });

            p1DiscardIrrelevantPmRecords.mockResolvedValue({
                "filtered-historical-performance-data-list": [
                    {
                        timestamp: "2024-01-02T00:00:00Z"
                    }
                ]
            });

            const result = await moduleUnderTest.run(validRequest);

            const historicalPerformances =
                result.rawCc["logical-termination-point"][0]["layer-protocol"][0]
                ["air-interface-2-0:air-interface-pac"]
                ["air-interface-historical-performances"];

            expect(historicalPerformances).toEqual([
                {
                    timestamp: "2024-01-02T00:00:00Z"
                }
            ]);
        });

        test("should discard irrelevant ethernet-container historical PM records when list exists", async () => {
            p1FieldsFilter.run.mockResolvedValue({
                "filtered-data-structure": {
                    uuid: "test-uuid",
                    "logical-termination-point": [
                        {
                            uuid: "ltp-eth",
                            "layer-protocol": [
                                {
                                    "layer-protocol-name": "ethernet-container",
                                    "ethernet-container-2-0:ethernet-container-pac": {
                                        "ethernet-container-historical-performances": {
                                            "historical-performance-data-list": [
                                                {
                                                    timestamp: "2024-01-01T00:00:00Z"
                                                }
                                            ]
                                        }
                                    }
                                }
                            ]
                        }
                    ]
                }
            });

            p1DiscardIrrelevantPmRecords.mockResolvedValue({
                "filtered-historical-performance-data-list": [
                    {
                        timestamp: "2024-01-02T00:00:00Z"
                    }
                ]
            });

            const result = await moduleUnderTest.run(validRequest);

            const historicalPerformances =
                result.rawCc["logical-termination-point"][0]["layer-protocol"][0]
                ["ethernet-container-2-0:ethernet-container-pac"]
                ["ethernet-container-historical-performances"];

            expect(historicalPerformances).toEqual([
                {
                    timestamp: "2024-01-02T00:00:00Z"
                }
            ]);
        });

        test("should pass mostRecentPeriodEndTime from matching interfaceMetadata item", async () => {
            p1FieldsFilter.run.mockResolvedValue({
                "filtered-data-structure": {
                    uuid: "test-uuid",
                    "logical-termination-point": [
                        {
                            uuid: "ltp-air-1",
                            "layer-protocol": [
                                {
                                    "layer-protocol-name": "air-interface",
                                    "air-interface-2-0:air-interface-pac": {
                                        "air-interface-historical-performances": {
                                            "historical-performance-data-list": [
                                                {
                                                    timestamp: "2024-01-01T00:00:00Z"
                                                }
                                            ]
                                        }
                                    }
                                }
                            ]
                        }
                    ]
                }
            });

            mockDataStoreClient.get.mockResolvedValue({
                body: {
                    _source: {
                        "interface-metadata-list": [
                            {
                                uuid: "ltp-air-1",
                                mostRecentPeriodEndTime: "2024-01-01T00:00:00Z",
                                mostRecentPeriodEndTime24: "2024-01-01T00:00:00Z"
                            }
                        ]
                    }
                }
            });

            await moduleUnderTest.run(validRequest);

            expect(p1DiscardIrrelevantPmRecords).toHaveBeenCalledWith(
                expect.objectContaining({
                    "most-recent-period-end-time": "2024-01-01T00:00:00Z",
                    "most-recent-period-end-time-24": "2024-01-01T00:00:00Z"
                })
            );
        });

        test("should pass relevantGranularities from parameters", async () => {
            getParamFromFunction
                .mockReset()
                .mockReturnValueOnce("fields-filter-value")
                .mockReturnValueOnce(":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN$");

            p1FieldsFilter.run.mockResolvedValue({
                "filtered-data-structure": {
                    uuid: "test-uuid",
                    "logical-termination-point": [
                        {
                            uuid: "ltp-air",
                            "layer-protocol": [
                                {
                                    "layer-protocol-name": "air-interface",
                                    "air-interface-2-0:air-interface-pac": {
                                        "air-interface-historical-performances": {
                                            "historical-performance-data-list": [
                                                {
                                                    timestamp: "2024-01-01T00:00:00Z"
                                                }
                                            ]
                                        }
                                    }
                                }
                            ]
                        }
                    ]
                }
            });

            await moduleUnderTest.run(validRequest);

            expect(p1DiscardIrrelevantPmRecords).toHaveBeenCalledWith(
                expect.objectContaining({
                    "relevant-granularities": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN$"
                })
            );
        });
    });

    // ─── Error Path ───────────────────────────────────────────────────────────

    describe("Error Path", () => {
        test("should throw MWDI_REPLICA_ES_CLIENT_INVALID when getEsClient for replica fails", async () => {
            onfAdapter.getEsClient.mockReset();
            onfAdapter.getEsClient.mockRejectedValueOnce(
                new Error("replica client error")
            );

            await expect(
                moduleUnderTest.run(validRequest)
            ).rejects.toThrow(ERRORS.MWDI_REPLICA_ES_CLIENT_INVALID);
        });

        test("should throw RAW_CC_COULD_NOT_BE_PROVIDED when replica read fails", async () => {
            withRetry.mockReset();
            withRetry.mockRejectedValueOnce(new Error("replica read failed"));

            await expect(
                moduleUnderTest.run(validRequest)
            ).rejects.toThrow(ERRORS.RAW_CC_COULD_NOT_BE_PROVIDED);
        });

        test("should throw RAW_CC_COULD_NOT_BE_PROVIDED when p1FieldsFilter returns a string error", async () => {
            p1FieldsFilter.run.mockResolvedValue("fields filter error");

            await expect(
                moduleUnderTest.run(validRequest)
            ).rejects.toThrow(ERRORS.RAW_CC_COULD_NOT_BE_PROVIDED);
        });

        test("should throw RAW_CC_COULD_NOT_BE_PROVIDED when p1FieldsFilter throws", async () => {
            p1FieldsFilter.run.mockRejectedValue(
                new Error("fields filter internal error")
            );

            await expect(
                moduleUnderTest.run(validRequest)
            ).rejects.toThrow(ERRORS.RAW_CC_COULD_NOT_BE_PROVIDED);
        });

        test("should throw RAW_CC_COULD_NOT_BE_PROVIDED when p1FieldsFilter returns null", async () => {
            p1FieldsFilter.run.mockResolvedValue(null);

            await expect(
                moduleUnderTest.run(validRequest)
            ).rejects.toThrow(ERRORS.RAW_CC_COULD_NOT_BE_PROVIDED);
        });

        test("should throw RAW_CC_COULD_NOT_BE_PROVIDED when p1FieldsFilter response misses filtered-data-structure", async () => {
            p1FieldsFilter.run.mockResolvedValue({});

            await expect(
                moduleUnderTest.run(validRequest)
            ).rejects.toThrow(ERRORS.RAW_CC_COULD_NOT_BE_PROVIDED);
        });

        test("should throw DATA_STORE_ES_CLIENT_INVALID when getEsClient for dataStore fails", async () => {
            onfAdapter.getEsClient.mockReset();
            onfAdapter.getEsClient
                .mockResolvedValueOnce(mockReplicaClient)
                .mockRejectedValueOnce(new Error("datastore client error"));

            await expect(
                moduleUnderTest.run(validRequest)
            ).rejects.toThrow(ERRORS.DATA_STORE_ES_CLIENT_INVALID);
        });

        test("should throw GENERAL_PROCESSING_ERROR when interface metadata loading fails", async () => {
            withRetry.mockReset();
            withRetry
                .mockImplementationOnce((fn) => fn())
                .mockRejectedValueOnce(new Error("datastore read failed"));

            await expect(
                moduleUnderTest.run(validRequest)
            ).rejects.toThrow(ERRORS.GENERAL_PROCESSING_ERROR);
        });

        test("should throw GENERAL_PROCESSING_ERROR when p1DiscardIrrelevantPmRecords returns invalid response for air-interface", async () => {
            p1FieldsFilter.run.mockResolvedValue({
                "filtered-data-structure": {
                    uuid: "test-uuid",
                    "logical-termination-point": [
                        {
                            uuid: "ltp-air",
                            "layer-protocol": [
                                {
                                    "layer-protocol-name": "air-interface",
                                    "air-interface-2-0:air-interface-pac": {
                                        "air-interface-historical-performances": {
                                            "historical-performance-data-list": [
                                                {
                                                    timestamp: "2024-01-01T00:00:00Z"
                                                }
                                            ]
                                        }
                                    }
                                }
                            ]
                        }
                    ]
                }
            });

            p1DiscardIrrelevantPmRecords.mockResolvedValue("invalid discard response");

            await expect(
                moduleUnderTest.run(validRequest)
            ).rejects.toThrow(ERRORS.GENERAL_PROCESSING_ERROR);
        });

        test("should throw GENERAL_PROCESSING_ERROR when p1DiscardIrrelevantPmRecords returns invalid response for ethernet-container", async () => {
            p1FieldsFilter.run.mockResolvedValue({
                "filtered-data-structure": {
                    uuid: "test-uuid",
                    "logical-termination-point": [
                        {
                            uuid: "ltp-eth",
                            "layer-protocol": [
                                {
                                    "layer-protocol-name": "ethernet-container",
                                    "ethernet-container-2-0:ethernet-container-pac": {
                                        "ethernet-container-historical-performances": {
                                            "historical-performance-data-list": [
                                                {
                                                    timestamp: "2024-01-01T00:00:00Z"
                                                }
                                            ]
                                        }
                                    }
                                }
                            ]
                        }
                    ]
                }
            });

            p1DiscardIrrelevantPmRecords.mockResolvedValue("invalid discard response");

            await expect(
                moduleUnderTest.run(validRequest)
            ).rejects.toThrow(ERRORS.GENERAL_PROCESSING_ERROR);
        });

        test("should throw GENERAL_PROCESSING_ERROR for unexpected errors", async () => {
            getParamFromFunction.mockReset();

            getParamFromFunction.mockImplementation(() => {
                throw new Error("unexpected crash");
            });

            await expect(
                moduleUnderTest.run(validRequest)
            ).rejects.toThrow(ERRORS.GENERAL_PROCESSING_ERROR);
        });
    });
});


