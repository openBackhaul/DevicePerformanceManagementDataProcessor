const p1DocumentFunction = require('./P1DocumentFunction');
const ERRORS = require('./ErrorsEnum');
const fs = require('fs');

describe("Test documentation function", () => {

  test("null value", () => {
    const result = p1DocumentFunction(null);

    expect(result).toBe(ERRORS.GENERAL_ERROR);
  });

  test("Test real data", () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/dataFunction.json', 'utf8');
    let functionDataset = JSON.parse(dataFile);

    const result = p1DocumentFunction({
      "parameters-of-to-be-documented-function": functionDataset
    });
    console.log(result);
  });

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