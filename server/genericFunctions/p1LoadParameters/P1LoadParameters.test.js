jest.mock("../../utils/config", () => ({
    loadConfigFile: jest.fn()
}));

jest.mock("../../infra/onf/onfAdapter.js", () => ({
    readControlConstruct: jest.fn()
}));

jest.mock("../../utils/functionTree", () => ({
    loadFunctionParameters: jest.fn()
}));

jest.mock("./../../service/LoggingService.js", () => ({
    getLogger: () => ({
        error: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    })
}));

const { loadConfigFile } = require("../../utils/config");
const onfAdapter = require("../../infra/onf/onfAdapter.js");
const { loadFunctionParameters } = require("../../utils/functionTree");
const { ERRORS } = require("./ErrorsEnum");
const moduleUnderTest = require("./P1LoadParameters");

describe("P1LoadParameters Unit Tests", () => {

    const validConfig = {
        "core-model-1-4:control-construct": {
            "profile-collection": {
                profile: []
            }
        }
    };

    const validRequest = {
        functionName: "p1StreamPmData",
        configFile: validConfig
    };

    beforeEach(() => {
        jest.clearAllMocks();
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

        test("should throw ERR_FUNCTION_NAME_NOT_PROVIDED when functionName is missing", async () => {

            await expect(
                moduleUnderTest.run({})
            ).rejects.toThrow(ERRORS.ERR_FUNCTION_NAME_NOT_PROVIDED);

        });

        test("should throw ERR_FUNCTION_NAME_NOT_PROVIDED when functionName is empty string", async () => {

            await expect(
                moduleUnderTest.run({ functionName: "" })
            ).rejects.toThrow(ERRORS.ERR_FUNCTION_NAME_NOT_PROVIDED);

        });

        test("should throw ERR_INVALID_SCHEMA when configFile is an empty object", async () => {

            await expect(
                moduleUnderTest.run({ functionName: "p1StreamPmData", configFile: {} })
            ).rejects.toThrow(ERRORS.ERR_INVALID_SCHEMA);

        });

        test("should throw ERR_INVALID_SCHEMA when configFile has no profile array", async () => {

            await expect(
                moduleUnderTest.run({
                    functionName: "p1StreamPmData",
                    configFile: {
                        "core-model-1-4:control-construct": {
                            "profile-collection": {}
                        }
                    }
                })
            ).rejects.toThrow(ERRORS.ERR_INVALID_SCHEMA);

        });

        test("should throw ERR_INVALID_SCHEMA when profile-collection is missing", async () => {

            await expect(
                moduleUnderTest.run({
                    functionName: "p1StreamPmData",
                    configFile: {
                        "core-model-1-4:control-construct": {}
                    }
                })
            ).rejects.toThrow(ERRORS.ERR_INVALID_SCHEMA);

        });

    });

    // ─── Happy Path ───────────────────────────────────────────────────────────

    describe("Happy Path", () => {

        test("should return parameters and configFile when configFile is provided in request", async () => {

            loadFunctionParameters.mockReturnValue({ test: "parameters" });

            const result = await moduleUnderTest.run(validRequest);

            expect(result).toBeDefined();
            expect(result.parameters).toEqual({ test: "parameters" });
            expect(result.configFile).toBe(validConfig);

        });

        test("should call loadFunctionParameters with configFile and functionName", async () => {

            loadFunctionParameters.mockReturnValue({ test: "parameters" });

            await moduleUnderTest.run(validRequest);

            expect(loadFunctionParameters).toHaveBeenCalledTimes(1);
            expect(loadFunctionParameters).toHaveBeenCalledWith(
                validConfig,
                "p1StreamPmData"
            );

        });

        test("should accept function-name as hyphenated key", async () => {

            loadFunctionParameters.mockReturnValue({ test: "parameters" });

            const result = await moduleUnderTest.run({
                "function-name": "p1StreamPmData",
                configFile: validConfig
            });

            expect(result.parameters).toEqual({ test: "parameters" });

        });

        test("should accept config-file as hyphenated key", async () => {

            loadFunctionParameters.mockReturnValue({ test: "parameters" });

            const result = await moduleUnderTest.run({
                functionName: "p1StreamPmData",
                "config-file": validConfig
            });

            expect(result.parameters).toEqual({ test: "parameters" });

        });

        test("should accept configFile that is the control construct directly without outer wrapper", async () => {

            loadFunctionParameters.mockReturnValue({ test: "parameters" });

            const directCc = {
                "profile-collection": { profile: [] }
            };

            const result = await moduleUnderTest.run({
                functionName: "p1StreamPmData",
                configFile: directCc
            });

            expect(result).toBeDefined();
            expect(result.parameters).toEqual({ test: "parameters" });

        });

        test("should load config from onfAdapter when configFile is not provided in request", async () => {

            onfAdapter.readControlConstruct.mockResolvedValue(validConfig);
            loadFunctionParameters.mockReturnValue({ test: "parameters" });

            const result = await moduleUnderTest.run({ functionName: "p1StreamPmData" });

            expect(result).toBeDefined();
            expect(onfAdapter.readControlConstruct).toHaveBeenCalledTimes(1);
            expect(loadFunctionParameters).toHaveBeenCalled();

        });

        test("should load config from loadConfigFile when onfAdapter returns null", async () => {

            onfAdapter.readControlConstruct.mockResolvedValue(null);
            loadConfigFile.mockReturnValue(validConfig);
            loadFunctionParameters.mockReturnValue({ test: "parameters" });

            const result = await moduleUnderTest.run({ functionName: "p1StreamPmData" });

            expect(result).toBeDefined();
            expect(loadConfigFile).toHaveBeenCalledTimes(1);
            expect(loadFunctionParameters).toHaveBeenCalled();

        });

        test("should not call onfAdapter when configFile is already provided in request", async () => {

            loadFunctionParameters.mockReturnValue({ test: "parameters" });

            await moduleUnderTest.run(validRequest);

            expect(onfAdapter.readControlConstruct).not.toHaveBeenCalled();

        });

        test("should not call loadConfigFile when onfAdapter returns a valid config", async () => {

            onfAdapter.readControlConstruct.mockResolvedValue(validConfig);
            loadFunctionParameters.mockReturnValue({ test: "parameters" });

            await moduleUnderTest.run({ functionName: "p1StreamPmData" });

            expect(loadConfigFile).not.toHaveBeenCalled();

        });

    });

    // ─── Error Path ───────────────────────────────────────────────────────────

    describe("Error Path", () => {

        test("should throw ERR_INVALID_JSON when onfAdapter throws SyntaxError", async () => {

            onfAdapter.readControlConstruct.mockRejectedValue(
                new SyntaxError("Invalid JSON")
            );

            await expect(
                moduleUnderTest.run({ functionName: "p1StreamPmData" })
            ).rejects.toThrow(ERRORS.ERR_INVALID_JSON);

        });

        test("should throw ERR_CONFIG_NOT_ACCESSIBLE when onfAdapter throws generic error", async () => {

            onfAdapter.readControlConstruct.mockRejectedValue(
                new Error("Connection refused")
            );

            await expect(
                moduleUnderTest.run({ functionName: "p1StreamPmData" })
            ).rejects.toThrow(ERRORS.ERR_CONFIG_NOT_ACCESSIBLE);

        });

        test("should throw ERR_INVALID_JSON when loadConfigFile throws SyntaxError", async () => {

            onfAdapter.readControlConstruct.mockResolvedValue(null);
            loadConfigFile.mockImplementation(() => {
                throw new SyntaxError("Invalid JSON");
            });

            await expect(
                moduleUnderTest.run({ functionName: "p1StreamPmData" })
            ).rejects.toThrow(ERRORS.ERR_INVALID_JSON);

        });

        test("should throw ERR_CONFIG_NOT_ACCESSIBLE when loadConfigFile throws generic error", async () => {

            onfAdapter.readControlConstruct.mockResolvedValue(null);
            loadConfigFile.mockImplementation(() => {
                throw new Error("File read error");
            });

            await expect(
                moduleUnderTest.run({ functionName: "p1StreamPmData" })
            ).rejects.toThrow(ERRORS.ERR_CONFIG_NOT_ACCESSIBLE);

        });

        test("should throw ERR_FUNCTION_NOT_FOUND when loadFunctionParameters reports function not found", async () => {

            loadFunctionParameters.mockImplementation(() => {
                throw new Error("Function profile not found");
            });

            await expect(
                moduleUnderTest.run({ functionName: "invalidFunction", configFile: validConfig })
            ).rejects.toThrow(ERRORS.ERR_FUNCTION_NOT_FOUND);

        });

        test("should throw ERR_UNKNOWN when loadFunctionParameters throws unexpected error", async () => {

            loadFunctionParameters.mockImplementation(() => {
                throw new Error("Unexpected internal error");
            });

            await expect(
                moduleUnderTest.run({ functionName: "p1StreamPmData", configFile: validConfig })
            ).rejects.toThrow(ERRORS.ERR_UNKNOWN);

        });

        test("should throw ERR_UNKNOWN when loadConfigFile returns null and onfAdapter also returned null", async () => {

            onfAdapter.readControlConstruct.mockResolvedValue(null);
            loadConfigFile.mockReturnValue(null);

            await expect(
                moduleUnderTest.run({ functionName: "p1StreamPmData" })
            ).rejects.toThrow(ERRORS.ERR_INVALID_SCHEMA);

        });

    });

});