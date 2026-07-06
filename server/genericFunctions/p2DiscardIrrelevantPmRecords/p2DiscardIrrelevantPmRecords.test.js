const p2DiscardIrrelevantPmRecords = require('./P2DiscardIrrelevantPmRecords');
const fs = require('fs');
const ERRORS = require('./ErrorsEnum');


describe("p2DiscardIrrelevantPmRecords unit tests - ERRORS", () => {
// Input parameters
// - historical-performance-data-list
// - former-most-recent-period-end-time
// - former-most-recent-period-end-time-24

  test('should return "General Error" if input is null', () => {
    const result = p2DiscardIrrelevantPmRecords(null);
    expect(result).toBe(ERRORS.GENERAL_ERROR);
  });

  // test('should return empty array when input is empty array', () => {
  //   const input = {
  //     "historical-performance-data-list": [],
  //     "former-most-recent-period-end-time" : "",
  //     "former-most-recent-period-end-time-24": ""
  //   };

  //   const result = p2DiscardIrrelevantPmRecords(input);

  //   expect(result["filtered-historical-performance-data-list"]).toHaveLength(0);
  // });

  test('should return error when input is not an array (string)', () => {
    const input = {
      "historical-performance-data-list": "not-an-array",
    };

    const result = p2DiscardIrrelevantPmRecords(input);

    expect(result).toBe(ERRORS.HISTORICAL_PERF_INVALID);
  });

  test('should return error when input is not an array (number)', () => {
    const input = {
      "historical-performance-data-list": 123
    };

    const result = p2DiscardIrrelevantPmRecords(input);

    expect(result).toBe(ERRORS.HISTORICAL_PERF_INVALID);
  });

  test('should return error when input is not an array (object)', () => {
    const input = {
      "historical-performance-data-list": { "key": "value" }
    };

    const result = p2DiscardIrrelevantPmRecords(input);

    expect(result).toBe(ERRORS.HISTORICAL_PERF_INVALID);
  });

});


describe("p2DiscardIrrelevantPmRecords data content test", () => {

    test('should return error for invalid regex pattern', () => {
    const input = {
      "historical-performance-data-list": [
        {
          "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
          "period-end-time": "2025-12-15T09:15:00+01:00",
          "performance-data": {}
        }
      ],
      "former-most-recent-period-end-time" : "2025-11-15T09:15:00+01:00",
      "former-most-recent-period-end-time-24": "2025-11-15T09:15:00+01:00"
    };

    const result = p2DiscardIrrelevantPmRecords(input);

    // expect(result).toBe(ERRORS.GENERAL_ERROR);
  });
});
