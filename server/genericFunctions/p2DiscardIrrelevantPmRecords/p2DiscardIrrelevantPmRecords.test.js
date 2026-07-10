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
    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.GENERAL_ERROR);
  });

  test('should return Error historicalPerformanceDataList not provided', () => {
    const input = {
      // "historical-performance-data-list": [],
      "former-most-recent-period-end-time": "",
      "former-most-recent-period-end-time-24": ""
    };

    const result = p2DiscardIrrelevantPmRecords(input);
    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.HISTORICAL_PERF_NOT_PROVIDED);
  });

  test('should return Error historicalPerformanceDataList invalid - 1', () => {
    const input = {
      "historical-performance-data-list": 20,
      "former-most-recent-period-end-time": "",
      "former-most-recent-period-end-time-24": ""
    };

    const result = p2DiscardIrrelevantPmRecords(input);
    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.HISTORICAL_PERF_INVALID);
  });

  test('should return Error historicalPerformanceDataList invalid - 2', () => {
    const input = {
      "historical-performance-data-list": "",
      "former-most-recent-period-end-time": "",
      "former-most-recent-period-end-time-24": ""
    };

    const result = p2DiscardIrrelevantPmRecords(input);
    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.HISTORICAL_PERF_INVALID);
  });

  test('should return Error historicalPerformanceDataList invalid - 3', () => {
    const input = {
      "historical-performance-data-list": { "key": "value" },
      "former-most-recent-period-end-time": "",
      "former-most-recent-period-end-time-24": ""
    };

    const result = p2DiscardIrrelevantPmRecords(input);
    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.HISTORICAL_PERF_INVALID);
  });

  test('should return Error formerMostRecentPeriodEndTime not provided', () => {
    const input = {
      "historical-performance-data-list": [],
      // "former-most-recent-period-end-time" : "",
      "former-most-recent-period-end-time-24": ""
    };

    const result = p2DiscardIrrelevantPmRecords(input);
    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.FORMER_MRPET_NOT_PROVIDED);
  });

  test('should return Error formerMostRecentPeriodEndTime24 invalid', () => {
    const input = {
      "historical-performance-data-list": [],
      "former-most-recent-period-end-time": "",
      "former-most-recent-period-end-time-24": ""
    };

    const result = p2DiscardIrrelevantPmRecords(input);
    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.FORMER_MRPET_INVALID);
  });

  test('should return error when missing input properties - 1', () => {
    const input = {
      "historical-performance-data-list": [],
      "former-most-recent-period-end-time": undefined,
      "former-most-recent-period-end-time-24": "2025-12-15T09:15:00+01:00"
    };

    const result = p2DiscardIrrelevantPmRecords(input);
    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.FORMER_MRPET_INVALID);
  });


  test('should return error when missing input properties - 2', () => {
    const input = {
      "historical-performance-data-list": [],
      "former-most-recent-period-end-time": "2025-12-15T09:15:00+01:00",
      "former-most-recent-period-end-time-24": undefined
    };

    const result = p2DiscardIrrelevantPmRecords(input);
    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.FORMER_MRPET24_INVALID);
  });

  test('should return error when input is not an array (number)', () => {
    const input = {
      "historical-performance-data-list": 123
    };

    const result = p2DiscardIrrelevantPmRecords(input);
    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.HISTORICAL_PERF_INVALID);
  });

  test('should return error when input is not an array (object)', () => {
    const input = {
      "historical-performance-data-list": { "key": "value" }
    };

    const result = p2DiscardIrrelevantPmRecords(input);
    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.HISTORICAL_PERF_INVALID);
  });

});


describe("p2DiscardIrrelevantPmRecords data content test", () => {

  test('should return 1 entry of 15 minutes', () => {
    const input = {
      "historical-performance-data-list": [
        {
          "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
          "period-end-time": "2025-12-15T09:15:00+01:00",
          "performance-data": {}
        },
        {
          "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS",
          "period-end-time": "2025-12-15T09:15:00+01:00",
          "performance-data": {}
        },
        {
          "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-WRONG",
          "period-end-time": "2025-12-15T09:15:00+01:00",
          "performance-data": {}
        }
      ],
      "former-most-recent-period-end-time": "2025-11-15T09:15:00+01:00",
      "former-most-recent-period-end-time-24": "2025-11-15T09:15:00+01:00"
    };

    const result = p2DiscardIrrelevantPmRecords(input);
    expect(result).toBeDefined();
    expect(result['amount-received']).toBeDefined();
    expect(result['amount-received']).toStrictEqual([{"count": 1, "date": "2025/12/15"}])
    expect(result['filtered-historical-performance-data-list']).toBeDefined();
  });


  test('should return Couting 3 entries of 15 minutes', () => {
    const input = {
      "historical-performance-data-list": [
        {
          "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
          "period-end-time": "2025-12-15T09:15:00+01:00",
          "performance-data": {}
        },
        {
          "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
          "period-end-time": "2025-12-15T10:15:00+01:00",
          "performance-data": {}
        },
                {
          "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
          "period-end-time": "2025-12-15T11:15:00+01:00",
          "performance-data": {}
        },
        {
          "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS",
          "period-end-time": "2025-12-15T09:15:00+01:00",
          "performance-data": {}
        },
        {
          "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-WRONG",
          "period-end-time": "2025-12-15T09:15:00+01:00",
          "performance-data": {}
        }
      ],
      "former-most-recent-period-end-time": "2025-11-15T09:15:00+01:00",
      "former-most-recent-period-end-time-24": "2025-11-15T09:15:00+01:00"
    };

    const result = p2DiscardIrrelevantPmRecords(input);
    expect(result).toBeDefined();
    expect(result['amount-received']).toBeDefined();
    expect(result['amount-received']).toStrictEqual([{"count": 3, "date": "2025/12/15"}])
    expect(result['filtered-historical-performance-data-list']).toBeDefined();
  });
});
