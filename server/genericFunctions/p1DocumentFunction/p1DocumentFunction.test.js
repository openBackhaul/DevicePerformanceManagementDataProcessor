const p1DocumentFunction = require('./P1DocumentFunction');
const ERRORS = require('./ErrorsEnum');
const fs = require('fs');

const properties = [  "function-name", "description", "is-active", "parameter" ];

describe("Test documentation function", () => {

  test("null value", () => {
    const result = p1DocumentFunction(null);
    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.GENERAL_ERROR);
  });

  test("undefined property", () => {
    const result = p1DocumentFunction({ "parameters-of-to-be-documented-function": undefined });
    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.PARAMETERS_NOT_PROVIDED);
  });

  test("Invalid property", () => {
    const result = p1DocumentFunction({ "parameters-of-to-be-documented-function": "not valid" });
    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.PARAMETERS_INVALID);
  });

  test("Invalid property", () => {
    const result = p1DocumentFunction({ "parameters-of-to-be-documented-function": {} });
    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.PARAMETERS_INVALID);
  });


  test("missing property - return empty data", () => {
    const result = p1DocumentFunction({ "parameters-of-to-be-documented-function": {
      "function-name": "",
      "description": "",
    } });
    expect(result).toBeDefined();
    expect(result).toBe("");
  });


  test("Test real data", () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/dataFunction.json', 'utf8');
    let functionDataset = JSON.parse(dataFile);

    const result = p1DocumentFunction({
      "parameters-of-to-be-documented-function": functionDataset
    });

    expect(result).toBeDefined();
    expect(result).toEqual(expect.stringContaining("- p1IterateEcPmSlices"));
    expect(result).toEqual(expect.stringContaining("Iterates through all EthernetContainer historical performance data slices and calls the processing Functions"));
    expect(result).toEqual(expect.stringContaining("Deletes attributes with default values from the transferred object"));
  });


  test("Test real data for p2ProcessDevice function", () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/p2ProcessDeviceDoc.json', 'utf8');
    let functionDataset = JSON.parse(dataFile);

    const result = p1DocumentFunction({
      "parameters-of-to-be-documented-function": functionDataset['parameters']
    });

    expect(result).toBeDefined();
    fs.writeFileSync("resultDataDoc.txt", result, "utf-8");
  })
});

// Expected output
// - p1CalculateBusyHour
//   Calculates busy hour KPIs.
//   . period
//     Defines the aggregation period.
//     15min
//   . granularity
//     Defines the calculation granularity.
//     hour
//   - p1CategorizeDataVolume
//     Categorizes PM data by day and hour.
//     . source
//       Input PM data source.
//       historical-performance-data