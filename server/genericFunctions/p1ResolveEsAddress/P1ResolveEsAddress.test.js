jest.mock("../../utils/ltpResolution", () => ({
  readEsAddress: jest.fn()
}));

const { readEsAddress } = require("../../utils/ltpResolution");
const ERRORS = require("./ErrorsEnum");
const moduleUnderTest = require("./P1ResolveEsAddress.js");

const validRequest = {
  parameters: {
    parameter: [
      { "parameter-name": "mwdiEsClient", value: "uuid-1" }
    ]
  },
  configFile: { applicationData: {} },
  esName: "mwdiEsClient"
};

const mockEsAddress = {
  uuid: "uuid-1",
  url: "http://localhost:9200",
  "index-alias": "mwdi",
  "api-key": "secret",
  "service-records-policy": "keep",
  "operational-state": "ENABLED",
  "life-cycle-state": "PLANNED"
};

describe("P1ResolveEsAddress", () => {

  beforeEach(() => {
    jest.clearAllMocks();
    readEsAddress.mockResolvedValue(mockEsAddress);
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

    test("should throw UNKNOWN_ERROR_OCCURRED when request is null", async () => {
      await expect(
        moduleUnderTest.run(null)
      ).rejects.toThrow(ERRORS.UNKNOWN_ERROR_OCCURRED);
    });

    test("should throw UNKNOWN_ERROR_OCCURRED when request is undefined", async () => {
      await expect(
        moduleUnderTest.run(undefined)
      ).rejects.toThrow(ERRORS.UNKNOWN_ERROR_OCCURRED);
    });

    test("should throw UNKNOWN_ERROR_OCCURRED when parameters is missing", async () => {
      await expect(
        moduleUnderTest.run({ configFile: {}, esName: "mwdiEsClient" })
      ).rejects.toThrow(ERRORS.UNKNOWN_ERROR_OCCURRED);
    });

    test("should throw UNKNOWN_ERROR_OCCURRED when configFile is missing", async () => {
      await expect(
        moduleUnderTest.run({ parameters: {}, esName: "mwdiEsClient" })
      ).rejects.toThrow(ERRORS.UNKNOWN_ERROR_OCCURRED);
    });

    test("should throw UNKNOWN_ERROR_OCCURRED when esName is missing", async () => {
      await expect(
        moduleUnderTest.run({ parameters: {}, configFile: {} })
      ).rejects.toThrow(ERRORS.UNKNOWN_ERROR_OCCURRED);
    });

    

  });

  // ─── Parameter Lookup ─────────────────────────────────────────────────────

  describe("Parameter Lookup", () => {

    test("should throw ES_NAME_NOT_FOUND_IN_PARAMETERS when parameter array is missing", async () => {
      await expect(
        moduleUnderTest.run({ parameters: {}, configFile: {}, esName: "mwdiEsClient" })
      ).rejects.toThrow(ERRORS.ES_NAME_NOT_FOUND_IN_PARAMETERS);
    });

    test("should throw ES_NAME_NOT_FOUND_IN_PARAMETERS when parameter array is empty", async () => {
      await expect(
        moduleUnderTest.run({
          parameters: { parameter: [] },
          configFile: {},
          esName: "mwdiEsClient"
        })
      ).rejects.toThrow(ERRORS.ES_NAME_NOT_FOUND_IN_PARAMETERS);
    });

    test("should throw ES_NAME_NOT_FOUND_IN_PARAMETERS when parameter name does not match", async () => {
      await expect(
        moduleUnderTest.run({
          parameters: {
            parameter: [{ "parameter-name": "wrongName", value: "uuid-1" }]
          },
          configFile: {},
          esName: "mwdiEsClient"
        })
      ).rejects.toThrow(ERRORS.ES_NAME_NOT_FOUND_IN_PARAMETERS);
    });

    test("should throw ES_NAME_NOT_FOUND_IN_PARAMETERS when parameter object is malformed", async () => {
      await expect(
        moduleUnderTest.run({
          parameters: {
            parameter: [{ invalid: true }]
          },
          configFile: {},
          esName: "mwdiEsClient"
        })
      ).rejects.toThrow(ERRORS.ES_NAME_NOT_FOUND_IN_PARAMETERS);
    });

    test("should throw ES_NAME_NOT_FOUND_IN_PARAMETERS when parameters.parameter is not an array", async () => {
      await expect(
        moduleUnderTest.run({
          parameters: { parameter: "invalid" },
          configFile: {},
          esName: "mwdiEsClient"
        })
      ).rejects.toThrow(ERRORS.ES_NAME_NOT_FOUND_IN_PARAMETERS);
    });

    test("should throw ES_NAME_NOT_FOUND_IN_PARAMETERS when parameters is a non-object string", async () => {
      await expect(
        moduleUnderTest.run({
          parameters: "invalid-string",
          configFile: {},
          esName: "mwdiEsClient"
        })
      ).rejects.toThrow(ERRORS.ES_NAME_NOT_FOUND_IN_PARAMETERS);
    });

  });

  // ─── Happy Path ───────────────────────────────────────────────────────────

  describe("Happy Path", () => {

    test("should resolve ES address successfully and return esAddress", async () => {
      const result = await moduleUnderTest.run(validRequest);

      expect(result).toEqual({ esAddress: mockEsAddress });
    });

    test("should call readEsAddress with configFile and the matched uuid value", async () => {
      await moduleUnderTest.run(validRequest);

      expect(readEsAddress).toHaveBeenCalledTimes(1);
      expect(readEsAddress).toHaveBeenCalledWith(validRequest.configFile, "uuid-1");
    });

    test("should find the correct parameter when multiple entries exist", async () => {
      const request = {
        ...validRequest,
        parameters: {
          parameter: [
            { "parameter-name": "otherClient", value: "other-uuid" },
            { "parameter-name": "mwdiEsClient", value: "uuid-1" }
          ]
        }
      };

      await moduleUnderTest.run(request);

      expect(readEsAddress).toHaveBeenCalledWith(request.configFile, "uuid-1");
    });


    test("should return esAddress containing all spec-required fields", async () => {
      const result = await moduleUnderTest.run(validRequest);

      expect(result.esAddress).toHaveProperty("url");
      expect(result.esAddress).toHaveProperty("api-key");
      expect(result.esAddress).toHaveProperty("index-alias");
      expect(result.esAddress).toHaveProperty("service-records-policy");
      expect(result.esAddress).toHaveProperty("operational-state");
      expect(result.esAddress).toHaveProperty("life-cycle-state");
    });


    test("should still call readEsAddress when parameter value is undefined", async () => {
    const result = await moduleUnderTest.run({
        parameters: {
            parameter: [{ "parameter-name": "mwdiEsClient" }] // no value field
        },
        configFile: validRequest.configFile,
        esName: "mwdiEsClient"
    });

    expect(readEsAddress).toHaveBeenCalledWith(
        validRequest.configFile,
        undefined
    );
    expect(result).toEqual({ esAddress: mockEsAddress });
});



  });

  // ─── Error Path ───────────────────────────────────────────────────────────

  describe("Error Path", () => {

    test("should throw UNKNOWN_ERROR_OCCURRED when readEsAddress fails with unknown error", async () => {
      readEsAddress.mockRejectedValue(new Error("connection failed"));

      await expect(
        moduleUnderTest.run(validRequest)
      ).rejects.toThrow(ERRORS.UNKNOWN_ERROR_OCCURRED);
    });

    test("should rethrow known error as-is when readEsAddress throws a known error", async () => {
      readEsAddress.mockRejectedValue(new Error(ERRORS.URL_COULD_NOT_BE_RESOLVED));

      await expect(
        moduleUnderTest.run(validRequest)
      ).rejects.toThrow(ERRORS.URL_COULD_NOT_BE_RESOLVED);
    });

    test("should rethrow ES_CLIENT_LTP_NOT_FOUND when readEsAddress throws it", async () => {
      readEsAddress.mockRejectedValue(new Error(ERRORS.ES_CLIENT_LTP_NOT_FOUND));

      await expect(
        moduleUnderTest.run(validRequest)
      ).rejects.toThrow(ERRORS.ES_CLIENT_LTP_NOT_FOUND);
    });

    test("should rethrow INDEX_ALIAS_COULD_NOT_BE_RESOLVED when readEsAddress throws it", async () => {
      readEsAddress.mockRejectedValue(
        new Error(ERRORS.INDEX_ALIAS_COULD_NOT_BE_RESOLVED)
      );

      await expect(
        moduleUnderTest.run(validRequest)
      ).rejects.toThrow(ERRORS.INDEX_ALIAS_COULD_NOT_BE_RESOLVED);
    });

  });

});
