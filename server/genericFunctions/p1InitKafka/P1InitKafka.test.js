jest.mock("../../utils/functionTree", () => ({
    getParamsByPurpose: jest.fn()
}));

jest.mock("../../utils/ltpResolution", () => ({
    readKafkaAddress: jest.fn()
}));

jest.mock("../../infra/onf/onfAdapter", () => ({
    connectKafkaProducer: jest.fn()
}));

const {
    getParamsByPurpose
} = require("../../utils/functionTree");

const {
    readKafkaAddress
} = require("../../utils/ltpResolution");

const onfAdapter = require("../../infra/onf/onfAdapter");

const ERRORS = require("./ErrorsEnum");
const moduleUnderTest = require("./P1InitKafka");

describe("P1InitKafka Unit Tests", () => {

    const logger = {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    };

    const validConfig = {
        applicationData: {}
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("Module Validation", () => {

        test("should export run function", () => {

            expect(moduleUnderTest.run).toBeDefined();
            expect(typeof moduleUnderTest.run).toBe("function");

        });

    });

    describe("Input Validation", () => {

        test("should throw when request is null", async () => {

            await expect(
                moduleUnderTest.run(null)
            ).rejects.toThrow();

        });

        test("should throw when request is undefined", async () => {

            await expect(
                moduleUnderTest.run(undefined)
            ).rejects.toThrow();

        });

        test("should throw 'parameters missing' when parameters is not provided", async () => {

            await expect(
                moduleUnderTest.run({
                    configFile: validConfig
                })
            ).rejects.toThrow(ERRORS.PARAMETERS_MISSING);

        });

        test("should throw 'parameters invalid' when parameters is a string", async () => {

            await expect(
                moduleUnderTest.run({
                    parameters: "invalid",
                    configFile: validConfig
                })
            ).rejects.toThrow(ERRORS.PARAMETERS_INVALID);

        });

        test("should throw 'parameters invalid' when parameters is an array", async () => {

            await expect(
                moduleUnderTest.run({
                    parameters: [],
                    configFile: validConfig
                })
            ).rejects.toThrow(ERRORS.PARAMETERS_INVALID);

        });

        test("should throw 'config-file missing' when configFile is not provided", async () => {

            await expect(
                moduleUnderTest.run({
                    parameters: {}
                })
            ).rejects.toThrow(ERRORS.CONFIG_FILE_MISSING);

        });

        test("should throw 'config-file invalid' when configFile is a string", async () => {

            await expect(
                moduleUnderTest.run({
                    parameters: {},
                    configFile: "invalid"
                })
            ).rejects.toThrow(ERRORS.CONFIG_FILE_INVALID);

        });

        test("should throw 'config-file invalid' when configFile is an array", async () => {

            await expect(
                moduleUnderTest.run({
                    parameters: {},
                    configFile: []
                })
            ).rejects.toThrow(ERRORS.CONFIG_FILE_INVALID);

        });

    });

    describe("Happy Path", () => {

        test("should initialize kafka successfully and return kafkaConnectionList", async () => {

            getParamsByPurpose.mockReturnValue([
                {
                    "parameter-name": "pmCollectionKafka",
                    value: "kafka-uuid-1"
                }
            ]);

            readKafkaAddress.mockResolvedValue({
                clientId: "client-1",
                groupId: "group-1",
                auth: false,
                brokerList: [
                    "localhost:9092"
                ],
                topicName: "pm-data",
                type: "producer"
            });

            onfAdapter.connectKafkaProducer.mockResolvedValue();

            const result = await moduleUnderTest.run({
                parameters: {},
                configFile: validConfig,
                logger
            });

            expect(result).toEqual({
                kafkaConnectionList: [
                    {
                        parameterName: "pmCollectionKafka",
                        kafkaClientUuid: "kafka-uuid-1",
                        clientId: "client-1",
                        groupId: "group-1",
//                      auth: false,
                        brokerList: [
                            "localhost:9092"
                        ],
                        topicName: "pm-data",
                        type: "producer"
                    }
                ]
            });

            expect(getParamsByPurpose).toHaveBeenCalledTimes(1);
            expect(readKafkaAddress).toHaveBeenCalledTimes(1);
            expect(onfAdapter.connectKafkaProducer).toHaveBeenCalledTimes(1);

        });

        test("should initialize multiple kafka clients", async () => {

            getParamsByPurpose.mockReturnValue([
                {
                    "parameter-name": "kafka1",
                    value: "uuid-1"
                },
                {
                    "parameter-name": "kafka2",
                    value: "uuid-2"
                }
            ]);

            readKafkaAddress.mockResolvedValue({
                clientId: "client",
                groupId: "group",
                auth: false,
                brokerList: [
                    "localhost:9092"
                ],
                topicName: "topic",
                type: "producer"
            });

            onfAdapter.connectKafkaProducer.mockResolvedValue();

            const result = await moduleUnderTest.run({
                parameters: {},
                configFile: validConfig,
                logger
            });

            expect(result.kafkaConnectionList).toHaveLength(2);
            expect(readKafkaAddress).toHaveBeenCalledTimes(2);
            expect(onfAdapter.connectKafkaProducer).toHaveBeenCalledTimes(2);

        });

        test("should return empty kafkaConnectionList when no kafka params found", async () => {

            getParamsByPurpose.mockReturnValue([]);

            const result = await moduleUnderTest.run({
                parameters: {},
                configFile: validConfig,
                logger
            });

            expect(result).toEqual({
                kafkaConnectionList: []
            });

        });

        test("should handle malformed kafka address response without throwing", async () => {

            getParamsByPurpose.mockReturnValue([
                {
                    "parameter-name": "kafka1",
                    value: "uuid-1"
                }
            ]);

            readKafkaAddress.mockResolvedValue({});
            onfAdapter.connectKafkaProducer.mockResolvedValue();

            const result = await moduleUnderTest.run({
                parameters: {},
                configFile: validConfig,
                logger
            });

            expect(result).toBeDefined();
            expect(result.kafkaConnectionList).toHaveLength(1);

        });

        test("should call getParamsByPurpose with correct purpose arguments", async () => {
            getParamsByPurpose.mockReturnValue([]);

            const mockParams = { some: "params" };

            await moduleUnderTest.run({
                parameters: mockParams,
                configFile: validConfig,
                logger
            });

            expect(getParamsByPurpose).toHaveBeenCalledWith(
                mockParams,
                "p1InitKafka",
                "kafkaClient"
            );
        });

        test("should call readKafkaAddress with configFile and kafka uuid", async () => {
            getParamsByPurpose.mockReturnValue([
                { "parameter-name": "pmCollectionKafka", value: "kafka-uuid-1" }
            ]);

            readKafkaAddress.mockResolvedValue({
                clientId: "client-1",
                brokerList: ["localhost:9092"]
            });

            onfAdapter.connectKafkaProducer.mockResolvedValue();

            await moduleUnderTest.run({
                parameters: {},
                configFile: validConfig,
                logger
            });

            expect(readKafkaAddress).toHaveBeenCalledWith(validConfig, "kafka-uuid-1");
        });


        test("should call connectKafkaProducer with clientId, brokerList and logger", async () => {
            getParamsByPurpose.mockReturnValue([
                { "parameter-name": "pmCollectionKafka", value: "kafka-uuid-1" }
            ]);

            readKafkaAddress.mockResolvedValue({
                clientId: "client-1",
                brokerList: ["localhost:9092"],
                topicName: "pm-data",
                type: "producer"
            });

            onfAdapter.connectKafkaProducer.mockResolvedValue();

            await moduleUnderTest.run({
                parameters: {},
                configFile: validConfig,
                logger
            });

            expect(onfAdapter.connectKafkaProducer).toHaveBeenCalledWith(
                "client-1",
                ["localhost:9092"],
                logger
            );
        });


        test("should throw 'Kafka address could not be resolved' when second client readKafkaAddress fails", async () => {
            getParamsByPurpose.mockReturnValue([
                { "parameter-name": "kafka1", value: "uuid-1" },
                { "parameter-name": "kafka2", value: "uuid-2" }
            ]);

            readKafkaAddress
                .mockResolvedValueOnce({
                    clientId: "client-1",
                    brokerList: ["localhost:9092"]
                })
                .mockRejectedValueOnce(new Error("timeout on second"));

            onfAdapter.connectKafkaProducer.mockResolvedValue();

            await expect(
                moduleUnderTest.run({ parameters: {}, configFile: validConfig, logger })
            ).rejects.toThrow(ERRORS.KAFKA_ADDRESS_COULD_NOT_BE_RESOLVED);
        });



        test("should throw GENERAL_PROCESSING_ERROR when getParamsByPurpose returns null", async () => {
            getParamsByPurpose.mockReturnValue(null);

            await expect(
                moduleUnderTest.run({ parameters: {}, configFile: validConfig, logger })
            ).rejects.toThrow(ERRORS.GENERAL_PROCESSING_ERROR);
        });



    });

    describe("Error Path", () => {

        test("should throw 'Kafka address could not be resolved' when readKafkaAddress fails", async () => {

            getParamsByPurpose.mockReturnValue([
                {
                    "parameter-name": "kafka1",
                    value: "uuid-1"
                }
            ]);

            readKafkaAddress.mockRejectedValue(new Error("network timeout"));

            await expect(
                moduleUnderTest.run({
                    parameters: {},
                    configFile: validConfig,
                    logger
                })
            ).rejects.toThrow(ERRORS.KAFKA_ADDRESS_COULD_NOT_BE_RESOLVED);

        });

        test("should throw 'Producer connection to kafka failed' when connectKafkaProducer fails", async () => {

            getParamsByPurpose.mockReturnValue([
                {
                    "parameter-name": "kafka1",
                    value: "uuid-1"
                }
            ]);

            readKafkaAddress.mockResolvedValue({
                clientId: "client-1",
                brokerList: [
                    "localhost:9092"
                ]
            });

            onfAdapter.connectKafkaProducer.mockRejectedValue(new Error("connection refused"));

            await expect(
                moduleUnderTest.run({
                    parameters: {},
                    configFile: validConfig,
                    logger
                })
            ).rejects.toThrow(ERRORS.PRODUCER_CONNECTION_TO_KAFKA_FAILED);

        });

        test("should throw 'General processing error' for unexpected errors", async () => {

            getParamsByPurpose.mockImplementation(() => {
                throw new Error("unexpected internal failure");
            });

            await expect(
                moduleUnderTest.run({
                    parameters: {},
                    configFile: validConfig,
                    logger
                })
            ).rejects.toThrow(ERRORS.GENERAL_PROCESSING_ERROR);

        });

    });

});
