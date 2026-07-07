jest.mock("../../utils/fieldsFilter", () => ({
    applyFieldsFilter: jest.fn()
}));

const { applyFieldsFilter } = require("../../utils/fieldsFilter");
const ERRORS = require("./ErrorsEnum");
const moduleUnderTest = require("./P1FieldsFilter");

describe("P1FieldsFilter Unit Tests", () => {

    const validDataStructure = {
        "logical-termination-point": [
            { uuid: "ltp-1" }
        ]
    };

    const validFilterString = "logical-termination-point";

    beforeEach(() => {
        jest.clearAllMocks();
        applyFieldsFilter.mockReturnValue({ "logical-termination-point": [{ uuid: "ltp-1" }] });
    });

    // ─── Module Validation ──────────────────────────────────────────────────────

    describe("Module Validation", () => {

        test("should export run function", () => {
            expect(moduleUnderTest.run).toBeDefined();
            expect(typeof moduleUnderTest.run).toBe("function");
        });

    });

    // ─── Input Validation ───────────────────────────────────────────────────────

    describe("Input Validation", () => {

        test("should return GENERAL_ERROR when request is null", async () => {
            const result = await moduleUnderTest.run(null);
            expect(result).toBe(ERRORS.GENERAL_ERROR);
        });

        test("should return GENERAL_ERROR when request is undefined", async () => {
            const result = await moduleUnderTest.run(undefined);
            expect(result).toBe(ERRORS.GENERAL_ERROR);
        });

        test("should return GENERAL_ERROR when request is a string", async () => {
            const result = await moduleUnderTest.run("invalid");
            expect(result).toBe(ERRORS.GENERAL_ERROR);
        });

        test("should return DATA_STRUCTURE_NOT_PROVIDED when dataStructure is absent", async () => {
            const result = await moduleUnderTest.run({
                "fields-filter-string": validFilterString
            });
            expect(result).toBe(ERRORS.DATA_STRUCTURE_NOT_PROVIDED);
        });

        test("should return DATA_STRUCTURE_NOT_PROVIDED when dataStructure is null", async () => {
            const result = await moduleUnderTest.run({
                dataStructure: null,
                fieldsFilterString: validFilterString
            });
            expect(result).toBe(ERRORS.DATA_STRUCTURE_NOT_PROVIDED);
        });

        test("should return DATA_STRUCTURE_INVALID when dataStructure is a string", async () => {
            const result = await moduleUnderTest.run({
                dataStructure: "not-an-object",
                fieldsFilterString: validFilterString
            });
            expect(result).toBe(ERRORS.DATA_STRUCTURE_INVALID);
        });

        test("should return DATA_STRUCTURE_INVALID when dataStructure is an array", async () => {
            const result = await moduleUnderTest.run({
                dataStructure: [{ uuid: "ltp-1" }],
                fieldsFilterString: validFilterString
            });
            expect(result).toBe(ERRORS.DATA_STRUCTURE_INVALID);
        });

        test("should return DATA_STRUCTURE_INVALID when dataStructure is a number", async () => {
            const result = await moduleUnderTest.run({
                dataStructure: 42,
                fieldsFilterString: validFilterString
            });
            expect(result).toBe(ERRORS.DATA_STRUCTURE_INVALID);
        });

        test("should return FIELDS_FILTER_STRING_NOT_PROVIDED when fieldsFilterString is absent", async () => {
            const result = await moduleUnderTest.run({
                dataStructure: validDataStructure
            });
            expect(result).toBe(ERRORS.FIELDS_FILTER_STRING_NOT_PROVIDED);
        });

        test("should return FIELDS_FILTER_STRING_NOT_PROVIDED when fieldsFilterString is null", async () => {
            const result = await moduleUnderTest.run({
                dataStructure: validDataStructure,
                fieldsFilterString: null
            });
            expect(result).toBe(ERRORS.FIELDS_FILTER_STRING_NOT_PROVIDED);
        });

        test("should return FIELDS_FILTER_STRING_INVALID when fieldsFilterString is empty string", async () => {
            const result = await moduleUnderTest.run({
                dataStructure: validDataStructure,
                fieldsFilterString: "   "
            });
            expect(result).toBe(ERRORS.FIELDS_FILTER_STRING_INVALID);
        });

        test("should return FIELDS_FILTER_STRING_INVALID when fieldsFilterString is a number", async () => {
            const result = await moduleUnderTest.run({
                dataStructure: validDataStructure,
                fieldsFilterString: 123
            });
            expect(result).toBe(ERRORS.FIELDS_FILTER_STRING_INVALID);
        });

    });

    // ─── Happy Path ─────────────────────────────────────────────────────────────

    describe("Happy Path", () => {

        test("should return filtered-data-structure on success (camelCase keys)", async () => {
            const filtered = { "logical-termination-point": [{ uuid: "ltp-1" }] };
            applyFieldsFilter.mockReturnValue(filtered);

            const result = await moduleUnderTest.run({
                dataStructure: validDataStructure,
                fieldsFilterString: validFilterString
            });

            expect(result).toEqual({ "filtered-data-structure": filtered });
        });

        test("should return filtered-data-structure on success (kebab-case keys)", async () => {
            const filtered = { "logical-termination-point": [{ uuid: "ltp-1" }] };
            applyFieldsFilter.mockReturnValue(filtered);

            const result = await moduleUnderTest.run({
                "data-structure": validDataStructure,
                "fields-filter-string": validFilterString
            });

            expect(result).toEqual({ "filtered-data-structure": filtered });
        });

        test("should call applyFieldsFilter with dataStructure and fieldsFilterString", async () => {
            applyFieldsFilter.mockReturnValue({ key: "value" });

            await moduleUnderTest.run({
                dataStructure: validDataStructure,
                fieldsFilterString: validFilterString
            });

            expect(applyFieldsFilter).toHaveBeenCalledTimes(1);
            expect(applyFieldsFilter).toHaveBeenCalledWith(validDataStructure, validFilterString);
        });

        test("should accept fieldsFilters alias", async () => {
            applyFieldsFilter.mockReturnValue({ key: "value" });

            const result = await moduleUnderTest.run({
                dataStructure: validDataStructure,
                fieldsFilters: validFilterString
            });

            expect(result).toEqual({ "filtered-data-structure": { key: "value" } });
            expect(applyFieldsFilter).toHaveBeenCalledWith(validDataStructure, validFilterString);
        });

        test("should prefer camelCase dataStructure key over kebab-case", async () => {
            const camelData = { uuid: "camel" };
            const kebabData = { uuid: "kebab" };
            applyFieldsFilter.mockReturnValue({ uuid: "camel" });

            await moduleUnderTest.run({
                dataStructure: camelData,
                "data-structure": kebabData,
                fieldsFilterString: validFilterString
            });

            expect(applyFieldsFilter).toHaveBeenCalledWith(camelData, expect.any(String));
        });

    });

    // ─── Error Path ─────────────────────────────────────────────────────────────

    describe("Error Path", () => {

        test("should return FIELDS_FILTER_STRING_INVALID when applyFieldsFilter throws", async () => {
            applyFieldsFilter.mockImplementation(() => {
                throw new Error("fieldsFilterString invalid");
            });

            const result = await moduleUnderTest.run({
                dataStructure: validDataStructure,
                fieldsFilterString: "invalid(("
            });

            expect(result).toBe(ERRORS.FIELDS_FILTER_STRING_INVALID);
        });

        test("should return FILTERED_DATA_STRUCTURE_COULD_NOT_BE_PROVIDED when result is null", async () => {
            applyFieldsFilter.mockReturnValue(null);

            const result = await moduleUnderTest.run({
                dataStructure: validDataStructure,
                fieldsFilterString: validFilterString
            });

            expect(result).toBe(ERRORS.FILTERED_DATA_STRUCTURE_COULD_NOT_BE_PROVIDED);
        });

        test("should return FILTERED_DATA_STRUCTURE_COULD_NOT_BE_PROVIDED when result is empty object", async () => {
            applyFieldsFilter.mockReturnValue({});

            const result = await moduleUnderTest.run({
                dataStructure: validDataStructure,
                fieldsFilterString: validFilterString
            });

            expect(result).toBe(ERRORS.FILTERED_DATA_STRUCTURE_COULD_NOT_BE_PROVIDED);
        });

        test("should return GENERAL_ERROR for unexpected errors in outer catch", async () => {
            // Force outer catch by making getDataStructure throw via a broken getter
            const brokenRequest = {
                get dataStructure() { throw new Error("unexpected"); },
                fieldsFilterString: validFilterString
            };

            const result = await moduleUnderTest.run(brokenRequest);
            expect(result).toBe(ERRORS.GENERAL_ERROR);
        });

    });

});
