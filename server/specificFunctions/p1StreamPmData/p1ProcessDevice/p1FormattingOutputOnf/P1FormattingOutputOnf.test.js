const p1FormattingOutputOnf = require("./P1FormattingOutputOnf");
const ERRORS = require("./ErrorsEnum");
const fs = require('fs');

const ONF_FORMAT = "onf-output-format";
const FORMAT_NAME = "format-name";
const OUT_FORMAT = "output-format";

describe("Validation Tests", () => {

  test("parameters missing", async () => {
    const res = await p1FormattingOutputOnf();

    expect(res).toBeDefined();
    expect(res).toBe(ERRORS.PARAMETERS_NOT_PROVIDED);
  });

  test("resultCc missing", async () => {
    const res = await p1FormattingOutputOnf({ "parameters": {} });

    expect(res).toBeDefined();
    expect(res).toBe(ERRORS.RESULT_CC_NOT_PROVIDED)
  });

  test("invalid parameters", async () => {
    const res = await p1FormattingOutputOnf({
      "parameters": "bad",
      "result-cc": {}
    });

    expect(res).toBeDefined();
    expect(res).toBe(ERRORS.PARAMETERS_INVALID);
  });

  test("invalid resultCc", async () => {
    const res = await p1FormattingOutputOnf({
      "parameters": {},
      "result-cc": "bad"
    });

    expect(res).toBeDefined();
    expect(res).toBe(ERRORS.RESULT_CC_INVALID);
  });

  test("ONF OutputFormat couldn't be provided", async () => {
    const res = await p1FormattingOutputOnf({
      "parameters": {
        "sub-function": [{
          "function-name": "p1FieldsFilter",
          "parameter": [{
            "parameter-name": "fieldsFilter",
            "value": "d"
          }]
        }]
      },
      "result-cc": { "a": 1, "b": 2, "c": 3 }
    });
    expect(res).toBeDefined();
    expect(res).toBe(ERRORS.OUTPUT_COULD_NOT_BE_PROVIDED);
  })

});


describe("Basic Functionality", () => {

  test("no filter returns full object", async () => {
    const res = await p1FormattingOutputOnf({
      "parameters": {},
      "result-cc": { "a": 1 }
    });

    expect(res).toBeDefined();
    expect(res).toEqual({
      "format-name": ONF_FORMAT,
      "output-format": { "a": 1 }
    });

  });

  test("deep clone check", async () => {
    const res = await p1FormattingOutputOnf({
      "parameters": {},
      "result-cc": { "a": 1 }
    });

    expect(res).toBeDefined();
    expect(res["format-name"]).toBe(ONF_FORMAT);
    expect(res[OUT_FORMAT]).toBeDefined();
    expect(res[OUT_FORMAT]).toEqual({ "a": 1 });
  });

});

describe("Filter Tests", () => {

  test("object filtering - Test 1", async () => {
    const res = await p1FormattingOutputOnf({
      "parameters": {
        "sub-function": [{
          "function-name": "p1FieldsFilter",
          "parameter": [{
            "parameter-name": "fieldsFilter",
            "value": "a"
          }]
        }]
      },
      "result-cc": {
        "a": 1,
        "b": 2,
        "c": 3
      }
    });

    expect(res).toBeDefined();
    expect(res[FORMAT_NAME]).toBe(ONF_FORMAT);
    expect(res[OUT_FORMAT]).toEqual({ "a": 1 });
  });

  test("object filtering - Test 2", async () => {
    const res = await p1FormattingOutputOnf({
      "parameters": {
        "sub-function": [{
          "function-name": "p1FieldsFilter",
          "parameter": [{
            "parameter-name": "fieldsFilter",
            "value": "a;b"
          }]
        }]
      },
      "result-cc": {
        "a": 1,
        "b": 2,
        "c": 3
      }
    });

    expect(res).toBeDefined();
    expect(res[FORMAT_NAME]).toBe(ONF_FORMAT);
    expect(res[OUT_FORMAT]).toBeDefined();
    expect(res[OUT_FORMAT]).toEqual({ "a": 1, "b": 2 });
  });

  test("array filtering (NETCONF compliant)", async () => {
    const res = await p1FormattingOutputOnf({
      "parameters": {
        "sub-function": [{
          "function-name": "p1FieldsFilter",
          "parameter": [{
            "parameter-name": "fieldsFilter",
            "value": "logical-termination-point"
          }]
        }]
      },
      "result-cc": {
        "logical-termination-point": [
          { "uuid": "1", "name": "A" },
          { "uuid": "2", "name": "B" }
        ],
        "equipment": "SIAE",
        "status": "Active"
      }
    });

    expect(res).toBeDefined();
    expect(res[FORMAT_NAME]).toBe(ONF_FORMAT);
    expect(res[OUT_FORMAT]).toBeDefined();

    expect(res[OUT_FORMAT]["equipment"]).not.toBeDefined();
    expect(res[OUT_FORMAT]["status"]).not.toBeDefined();
    expect(res[OUT_FORMAT]["logical-termination-point"]).toStrictEqual([
      { "uuid": "1", "name": "A" },
      { "uuid": "2", "name": "B" }
    ]);
  })

  test("invalid filter returns empty object - Output could not be provided", async () => {
    const res = await p1FormattingOutputOnf({
      "parameters": {
        "sub-function": [{
          "function-name": "p1FieldsFilter",
          "parameter": [{
            "parameter-name": "fieldsFilter",
            "value": "x;y"
          }]
        }]
      },
      "result-cc": { "a": 1 }
    });

    expect(res).toBeDefined();
    expect(res).toBe(ERRORS.OUTPUT_COULD_NOT_BE_PROVIDED);
  });
});


describe("Real Dataset Tests", () => {

  // Import file
  let dataFile;
  let REAL_CC;
  beforeAll(() => {
    dataFile = fs.readFileSync(__dirname + '/datasets/cc_clean_CO01715.json', 'utf8');
    REAL_CC = JSON.parse(dataFile);
  })

  test("basic execution", async () => {
    const res = await p1FormattingOutputOnf({
      "parameters": {},
      "result-cc": REAL_CC
    });

    expect(res).toBeDefined();
    expect(res[FORMAT_NAME]).toBe(ONF_FORMAT);
    expect(res[OUT_FORMAT]).toEqual(REAL_CC);
  });

  test("filter array is full", async () => {
    const res = await p1FormattingOutputOnf({
      "parameters": {
        "sub-function": [{
          "function-name": "p1FieldsFilter",
          "parameter": [{
            "parameter-name": "fieldsFilter",
            "value": "equipment-augment-1-0:control-construct-pac;equipment;logical-termination-point;batch-timestamp"
          }]
        }]
      },
      "result-cc": REAL_CC
    });

    expect(res).toBeDefined();
    expect(res[FORMAT_NAME]).toBe(ONF_FORMAT);
    expect(res[OUT_FORMAT]).toEqual(REAL_CC);
  });

  test("filter out some fields", async () => {
    const res = await p1FormattingOutputOnf({
      "parameters": {
        "sub-function": [{
          "function-name": "p1FieldsFilter",
          "parameter": [{
            "parameter-name": "fieldsFilter",
            "value": "equipment-augment-1-0:control-construct-pac;batch-timestamp"
          }]
        }]
      },
      "result-cc": REAL_CC
    });

    expect(res).toBeDefined();
    expect(res[FORMAT_NAME]).toBe(ONF_FORMAT);
    expect(res[OUT_FORMAT]).toEqual({
      "equipment-augment-1-0:control-construct-pac": {
        "device-model-name": "MINI-LINK Traffic Node",
        "last-config-change-timestamp": "2010-11-20T14:00:00+01:00",
        "external-label": "AMM6pC-IDU2"
      },
      "batch-timestamp": "2025-12-16T09:11:05.307+01:00"
    });
  });

});
