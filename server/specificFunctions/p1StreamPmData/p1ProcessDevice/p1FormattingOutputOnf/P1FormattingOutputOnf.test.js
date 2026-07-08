const { p1FormattingOutputOnf } = require("./P1FormattingOutputOnf");
const ERRORS = require("./ErrorsEnum");
const fs = require('fs');

describe("Validation Tests", () => {

  test("parameters missing", () => {
    p1FormattingOutputOnf().then((res) => {
      expect(res).toBe(ERRORS.PARAMETERS_NOT_PROVIDED);
    })
  });

  test("resultCc missing", () => {
    p1FormattingOutputOnf({ "parameters": {} }).then((res) =>
      expect(res).toBe(ERRORS.RESULT_CC_NOT_PROVIDED)
    );
  });

  test("invalid parameters", () => {
    p1FormattingOutputOnf({
      "parameters": "bad",
      "result-cc": {}
    }).then((res) => {
      expect(res).toBe(ERRORS.PARAMETERS_INVALID);
    });
  });

  test("invalid resultCc", () => {
    p1FormattingOutputOnf({
      "parameters": {},
      "result-cc": "bad"
    }).then((res) => {
      expect(res).toBe(ERRORS.RESULT_CC_INVALID);
    })
  });

  // TODO @ll to be concluded
  // test("ONF OutputFormat couldn't be provided", () => {
  //   const res = p1FormattingOutputOnf({
  //     "parameters": {},
  //     "result-cc": "bad"
  //   });

  //   expect(res);
  // })

});


describe("Basic Functionality", () => {

  test("no filter returns full object", async () => {
    p1FormattingOutputOnf({
      "parameters": {},
      "result-cc": { a: 1 }
    }).then((res) => {
      expect(res).toEqual({
        "format-name": "onf-output-format",
        "output-format": { a: 1 }
      });
    });
  });

  test("deep clone check", () => {
    const input = { a: 1 };

    p1FormattingOutputOnf({
      "parameters": {},
      "result-cc": input
    }).then((res) => {
      expect(res["output-format"]).not.toBe(input);
    });
  });

});

describe("Filter Tests", () => {

  test("object filtering", () => {
    p1FormattingOutputOnf({
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
        "a": { "b": { "c": 10 } }
      }
    }).then((res) => {
      expect(res["output-format"]).toEqual({ "a": { "b": { "c": 10 } } });
    });
  });

  test("array filtering (NETCONF compliant)", () => {
    p1FormattingOutputOnf({
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
        ]
      }
    }).then((res) => {
      expect(res["output-format"]).toBeDefined();
    })


    // expect(res["output-format"]).toEqual([
    //   "1",
    //   "2"
    // ]);
  });


  test("invalid filter returns empty object", () => {
    p1FormattingOutputOnf({
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
    }).then((res) => {
      expect(res).toBeDefined();
    });

    // expect(res["output-format"]).toEqual({}); // to be verify
  });

});


describe("Real Dataset Tests", () => {

  let dataFile;
  let REAL_CC;
  beforeAll(() => {
    dataFile = fs.readFileSync(__dirname + '/datasets/cc_clean_CO01715.json', 'utf8');
    REAL_CC = JSON.parse(dataFile);
  })

  test("basic execution", () => {
    p1FormattingOutputOnf({
      "parameters": {},
      "result-cc": REAL_CC
    }).then((res) => {
      expect(res).toBeDefined();
      expect(res["format-name"]).toBe("onf-output-format");
      expect(res["output-format"]).toEqual(REAL_CC);
    });
  });

  test("filter top-level array", () => {
    p1FormattingOutputOnf({
      "parameters": {
        "sub-function": [{
          "function-name": "p1FieldsFilter",
          "parameter": [{
            "parameter-name": "fieldsFilter",
            "value": "equipment-augment-1-0:control-construct-pac;logical-termination-point;batch-timestamp"
          }]
        }]
      },
      "result-cc": REAL_CC
    }).then((res) => {
      expect(res).toBeDefined();
      expect(res["format-name"]).toBe("onf-output-format");
      // expect(res["result-cc"]).toEqual(REAL_CC);
    });

    //TODO
    // expect(Array.isArray(res["output-format"])).toBe(true);
  });

});
