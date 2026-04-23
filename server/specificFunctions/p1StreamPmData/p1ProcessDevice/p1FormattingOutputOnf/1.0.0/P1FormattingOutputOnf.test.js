const { p1FormattingOutputOnf } = require("./P1FormattingOutputOnf");
const ERRORS = require("./ErrorsEnum");

const REAL_CC = require("./datasets/cc_clean_CO01715.json");

describe("Validation Tests", () => {

  test("parameters missing", () => {
    expect(p1FormattingOutputOnf()).toBe(ERRORS.PARAMETERS_NOT_PROVIDED);
  });

  test("resultCc missing", () => {
    const res = p1FormattingOutputOnf({ parameters: {} });
    expect(res).toBe(ERRORS.RESULT_CC_NOT_PROVIDED);
  });

  test("invalid parameters", () => {
    const res = p1FormattingOutputOnf({
      parameters: "bad",
      "result-cc": {}
    });
    expect(res).toBe(ERRORS.PARAMETERS_INVALID);
  });

  test("invalid resultCc", () => {
    const res = p1FormattingOutputOnf({
      parameters: {},
      "result-cc": "bad"
    });
    expect(res).toBe(ERRORS.RESULT_CC_INVALID);
  });

});


describe("Basic Functionality", () => {

  test("no filter returns full object", () => {
    const res = p1FormattingOutputOnf({
      parameters: {},
      "result-cc": { a: 1 }
    });

    expect(res).toEqual({
      "format-name": "onf-output-format",
      "output-format": { a: 1 }
    });
  });

  test("deep clone check", () => {
    const input = { a: 1 };

    const res = p1FormattingOutputOnf({
      parameters: {},
      "result-cc": input
    });

    expect(res["output-format"]).not.toBe(input);
  });

});


describe("Filter Tests", () => {

  test("object filtering", () => {
    const res = p1FormattingOutputOnf({
      parameters: {
        "sub-function": [{
          "function-name": "p1FieldsFilter",
          parameter: [{
            "parameter-name": "fieldsFilter",
            value: "a.b"
          }]
        }]
      },
      "result-cc": {
        a: { b: { c: 10 } }
      }
    });

    expect(res["output-format"]).toEqual({ c: 10 });
  });


  test("array filtering (NETCONF compliant)", () => {
    const res = p1FormattingOutputOnf({
      parameters: {
        "sub-function": [{
          "function-name": "p1FieldsFilter",
          parameter: [{
            "parameter-name": "fieldsFilter",
            value: "logical-termination-point.uuid"
          }]
        }]
      },
      "result-cc": {
        "logical-termination-point": [
          { uuid: "1", name: "A" },
          { uuid: "2", name: "B" }
        ]
      }
    });

    expect(res["output-format"]).toEqual([
      "1",
      "2"
    ]);
  });


  test("invalid filter returns empty object", () => {
    const res = p1FormattingOutputOnf({
      parameters: {
        "sub-function": [{
          "function-name": "p1FieldsFilter",
          parameter: [{
            "parameter-name": "fieldsFilter",
            value: "x.y"
          }]
        }]
      },
      "result-cc": { a: 1 }
    });

    expect(res["output-format"]).toEqual({});
  });

});


describe("Real Dataset Tests", () => {

  test("basic execution", () => {
    const res = p1FormattingOutputOnf({
      parameters: {},
      "result-cc": REAL_CC
    });

    expect(res["format-name"]).toBe("onf-output-format");
  });

  test("filter top-level array", () => {
    const res = p1FormattingOutputOnf({
      parameters: {
        "sub-function": [{
          "function-name": "p1FieldsFilter",
          parameter: [{
            "parameter-name": "fieldsFilter",
            value: "logical-termination-point"
          }]
        }]
      },
      "result-cc": REAL_CC
    });

    expect(Array.isArray(res["output-format"])).toBe(true);
  });

});