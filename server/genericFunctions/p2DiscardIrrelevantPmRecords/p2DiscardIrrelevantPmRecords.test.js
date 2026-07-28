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
    expect(result['amount-received']).toStrictEqual([{ "count": 1, "date": "2025/12/15" }]);
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
    expect(result['amount-received']).toStrictEqual([{ "count": 3, "date": "2025/12/15" }]);
    expect(result['filtered-historical-performance-data-list']).toBeDefined();
  });



  test('should return Couting 3 entries of 15 minutes', () => {
    const input = {
      "historical-performance-data-list": [
        {
          "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
          "period-end-time": "2025-12-13T09:15:00+01:00",
          "performance-data": {}
        },
        {
          "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
          "period-end-time": "2025-12-14T09:13:00+01:00",
          "performance-data": {}
        },
        {
          "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
          "period-end-time": "2025-12-14T09:15:00+01:00",
          "performance-data": {}
        },
        /// 15 December
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
      "former-most-recent-period-end-time": "2025-12-15T09:15:00+01:00",
      "former-most-recent-period-end-time-24": "2025-11-15T09:15:00+01:00"
    };

    const result = p2DiscardIrrelevantPmRecords(input);
    expect(result).toBeDefined();
    expect(result['amount-received']).toBeDefined();
    expect(result['amount-received']).toStrictEqual([{ "count": 2, "date": "2025/12/15" }]);
    expect(result['filtered-historical-performance-data-list']).toBeDefined();
  });


  test('should return Couting 3 entries of 15 minutes', () => {
    const input = {
      "historical-performance-data-list": [
        {
          "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
          "period-end-time": "2025-12-13T09:15:00+01:00",
          "performance-data": {}
        },
        {
          "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
          "period-end-time": "2025-12-14T09:13:00+01:00",
          "performance-data": {}
        },
        {
          "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
          "period-end-time": "2025-12-14T09:15:00+01:00",
          "performance-data": {}
        },
        /// 15 December
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
      "former-most-recent-period-end-time": "2025-12-14T09:15:00+01:00",
      "former-most-recent-period-end-time-24": "2025-11-15T09:15:00+01:00"
    };

    const result = p2DiscardIrrelevantPmRecords(input);
    expect(result).toBeDefined();
    expect(result['amount-received']).toBeDefined();
    expect(result['amount-received']).toStrictEqual([{ "count": 3, "date": "2025/12/15" }]);
    expect(result['filtered-historical-performance-data-list']).toBeDefined();
  });


  test('should return Couting 3 entries of 15 minutes', () => {
    const input = {
      "historical-performance-data-list": [
        {
          "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
          "period-end-time": "2025-12-13T09:15:00+01:00",
          "performance-data": {}
        },
        {
          "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
          "period-end-time": "2025-12-14T09:13:00+01:00",
          "performance-data": {}
        },
        {
          "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
          "period-end-time": "2025-12-14T09:15:00+01:00",
          "performance-data": {}
        },
        /// 15 December
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
      "former-most-recent-period-end-time": "2025-12-14T02:15:00+01:00",
      "former-most-recent-period-end-time-24": "2025-11-15T09:15:00+01:00"
    };

    const result = p2DiscardIrrelevantPmRecords(input);
    expect(result).toBeDefined();
    expect(result['amount-received']).toBeDefined();
    expect(result['amount-received']).toStrictEqual([{ "count": 2, "date": "2025/12/14" }, { "count": 3, "date": "2025/12/15" }]);
    expect(result['filtered-historical-performance-data-list']).toBeDefined();
  });

  test('should return Counting 1,2 and 3 entries of 15 minutes in differents days', () => {
    const input = {
      "historical-performance-data-list": [
        {
          "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
          "period-end-time": "2025-12-13T09:15:00+01:00",
          "performance-data": {}
        },
        {
          "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
          "period-end-time": "2025-12-14T09:13:00+01:00",
          "performance-data": {}
        },
        {
          "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
          "period-end-time": "2025-12-14T09:15:00+01:00",
          "performance-data": {}
        },
        /// 15 December
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
      "former-most-recent-period-end-time": "2025-12-12T02:15:00+01:00",
      "former-most-recent-period-end-time-24": "2025-11-15T09:15:00+01:00"
    };

    const result = p2DiscardIrrelevantPmRecords(input);
    expect(result).toBeDefined();
    expect(result['amount-received']).toBeDefined();
    expect(result['amount-received']).toStrictEqual([{ "count": 1, "date": "2025/12/13" }, { "count": 2, "date": "2025/12/14" }, { "count": 3, "date": "2025/12/15" }]);
    expect(result['filtered-historical-performance-data-list']).toBeDefined();
  });

  // from old function
  test('should filter records correctly - 2 Days 97 entries', () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/historicalDataFull.json', 'utf8');
    let historicalData = JSON.parse(dataFile);
    const input = {
      "historical-performance-data-list": historicalData,
      "former-most-recent-period-end-time": "2024-01-01T10:00:00Z",
      "former-most-recent-period-end-time-24": "2024-01-01T00:00:00Z"
    };

    const result = p2DiscardIrrelevantPmRecords(input);
    expect(result['amount-received']).toStrictEqual([{ "count": 63, "date": "2025/12/15" }, { "count": 33, "date": "2025/12/16" }]);
    expect(result['filtered-historical-performance-data-list']).toBeDefined();
    expect(result["filtered-historical-performance-data-list"]).toHaveLength(97);
  });

  test('should filter records correctly - 2 Days 89 entries', () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/historicalDataFull.json', 'utf8');
    let historicalData = JSON.parse(dataFile);
    const input = {
      "historical-performance-data-list": historicalData,
      "former-most-recent-period-end-time": "2025-12-15T10:00:00Z",
      "former-most-recent-period-end-time-24": "2024-01-01T00:00:00Z"
    };

    const result = p2DiscardIrrelevantPmRecords(input);
    expect(result['amount-received']).toStrictEqual([{ "count": 55, "date": "2025/12/15" }, { "count": 33, "date": "2025/12/16" }]);
    expect(result['filtered-historical-performance-data-list']).toBeDefined();
    expect(result["filtered-historical-performance-data-list"]).toHaveLength(89);
  });

  test('should filter records correctly - All data process, result entries must be empty, only 1 entry 24 hours', () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/historicalDataFull.json', 'utf8');
    let historicalData = JSON.parse(dataFile);
    const input = {
      "historical-performance-data-list": historicalData,
      "former-most-recent-period-end-time": "2026-01-01T10:00:00Z",
      // "period-end-time": "2025-12-16T00:00:00+01:00",
      "former-most-recent-period-end-time-24": "2025-01-01T00:00:00Z"
    };

    const result = p2DiscardIrrelevantPmRecords(input);
    expect(result['amount-received']).toStrictEqual([]);
    expect(result['filtered-historical-performance-data-list']).toBeDefined();
    expect(result["filtered-historical-performance-data-list"]).toHaveLength(1);
  });

  test('should filter records correctly - All data process, result entries must be empty, 0 entry of 24 hours', () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/historicalDataFull.json', 'utf8');
    let historicalData = JSON.parse(dataFile);
    const input = {
      "historical-performance-data-list": historicalData,
      "former-most-recent-period-end-time": "2026-01-01T10:00:00Z",
      // "period-end-time": "2025-12-16T00:00:00+01:00",
      "former-most-recent-period-end-time-24": "2025-12-31T00:00:00Z"
    };

    const result = p2DiscardIrrelevantPmRecords(input);
    expect(result['amount-received']).toStrictEqual([]);
    expect(result['filtered-historical-performance-data-list']).toBeDefined();
    expect(result["filtered-historical-performance-data-list"]).toHaveLength(0);
  });

  test('should filter records correctly - 1 Day 24 entries', () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/historicalDataFull.json', 'utf8');
    let historicalData = JSON.parse(dataFile);
    const input = {
      "historical-performance-data-list": historicalData,
      "former-most-recent-period-end-time": "2025-12-16T02:00:00Z",
      // "period-end-time": "2025-12-16T00:00:00+01:00",
      "former-most-recent-period-end-time-24": "2026-01-01T00:00:00Z"
    };

    const result = p2DiscardIrrelevantPmRecords(input);
    expect(result['amount-received']).toStrictEqual([ { "count": 24, "date": "2025/12/16" }]);
    expect(result['filtered-historical-performance-data-list']).toBeDefined();
    expect(result["filtered-historical-performance-data-list"]).toHaveLength(24);
  });

});
