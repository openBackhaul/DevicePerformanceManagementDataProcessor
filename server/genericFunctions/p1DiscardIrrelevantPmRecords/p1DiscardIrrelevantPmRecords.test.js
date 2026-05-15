const p1DiscardIrrelevantPmRecords = require('./P1DiscardIrrelevantPmRecords');
const fs = require('fs');
const ERRORS = require('./ErrorsEnum');

const HISTORICAL_PERF_LIST2 = [
  {
    "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
    "period-end-time": "2024-01-01T10:15:00Z",
    "performance-data": {}
  },
  {
    "granularity-period": ":INVALID",
    "period-end-time": "2024-01-01T10:15:00Z",
    "performance-data": {}
  }
];

const HISTORICAL_PERF_LIST3 = [
  {
    "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
    "period-end-time": "2020-01-01T00:00:00Z",
    "performance-data": {}
  }
];

const HISTORICAL_PERF_LIST4 = [
  {
    "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
    "period-end-time": "invalid-date",
    "performance-data": {}
  }
];

const HISTORICAL_PERF_LIST5 = [
  {
    "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
    "period-end-time": "2024-01-01T10:15:00Z",
    "performance-data": {}
  },
  {
    "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS",
    "period-end-time": "2024-01-02T00:00:00Z",
    "performance-data": {}
  }
];

describe('p1DiscardIrrelevantPmRecords', () => {

  test('should return error if input is missing', () => {
    expect(p1DiscardIrrelevantPmRecords(null))
      .toBe(ERRORS.GENERAL_ERROR);
  });

  test('should filter records correctly (full scenario)', () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/historicalDataFull.json', 'utf8');
    let historicalData = JSON.parse(dataFile);
    const input = {
      "historical-performance-data-list": historicalData,
      "most-recent-period-end-time": "2024-01-01T10:00:00Z",
      "most-recent-period-end-time-24": "2024-01-01T00:00:00Z"
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(97);
  });

  test('should filter records correctly (full scenario) - only 15 minutes', () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/historicalDataFull.json', 'utf8');
    let historicalData = JSON.parse(dataFile);
    const input = {
      "historical-performance-data-list": historicalData,
      "relevant-granularities": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN$",
      "most-recent-period-end-time": "2024-01-01T10:00:00Z",
      "most-recent-period-end-time-24": "2024-01-01T00:00:00Z"
    };

    const result = p1DiscardIrrelevantPmRecords(input);
    expect(result["filtered-historical-performance-data-list"]).toHaveLength(96);
  });

  test('should filter records correctly (full scenario) - only 15 minutes, entries already processed', () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/historicalDataFull.json', 'utf8');
    let historicalData = JSON.parse(dataFile);
    const input = {
      "historical-performance-data-list": historicalData,
      "relevant-granularities": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN$",
      "most-recent-period-end-time": "2026-01-01T10:00:00Z",
      "most-recent-period-end-time-24": "2024-01-01T00:00:00Z"
    };

    const result = p1DiscardIrrelevantPmRecords(input);
    expect(result["filtered-historical-performance-data-list"]).toHaveLength(0);
  });

  test('should filter records correctly (full scenario) - only 24 hours', () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/historicalDataFull.json', 'utf8');
    let historicalData = JSON.parse(dataFile);
    const input = {
      "historical-performance-data-list": historicalData,
      "relevant-granularities": ":GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS$",
      "most-recent-period-end-time": "2024-01-01T10:00:00Z",
      "most-recent-period-end-time-24": "2024-01-01T00:00:00Z"
    };

    const result = p1DiscardIrrelevantPmRecords(input);
    expect(result["filtered-historical-performance-data-list"]).toHaveLength(1);
  });

  test('should filter records correctly (full scenario) - only 24 hours, entries already processed', () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/historicalDataFull.json', 'utf8');
    let historicalData = JSON.parse(dataFile);
    const input = {
      "historical-performance-data-list": historicalData,
      "relevant-granularities": ":GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS$",
      "most-recent-period-end-time": "2024-01-01T10:00:00Z",
      "most-recent-period-end-time-24": "2026-01-01T00:00:00Z"
    };

    const result = p1DiscardIrrelevantPmRecords(input);
    expect(result["filtered-historical-performance-data-list"]).toHaveLength(0);
  });

  test('should apply default granularity regex if not provided', () => {
    const input = {
      "historical-performance-data-list": HISTORICAL_PERF_LIST2
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(1);
  });

  test('should not filter by time if thresholds are missing', () => {
    const input = {
      "historical-performance-data-list": HISTORICAL_PERF_LIST3
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(1);
  });

  test('should discard invalid date records', () => {
    const input = {
      "historical-performance-data-list": HISTORICAL_PERF_LIST4
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(0);
  });

  test('should support custom granularity regex', () => {
    const input = {
      "historical-performance-data-list": HISTORICAL_PERF_LIST5,
      "relevant-granularities": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN"
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(1);
  });

  test('load real data', () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/historicalDataFull.json', 'utf8');
    let historicalDataList = JSON.parse(dataFile);

    const input = {
      "historical-performance-data-list": historicalDataList,
      "relevant-granularities": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
      "most-recent-period-end-time": "2025-12-16T00:45:00+01:00",
      "most-recent-period-end-time-24": "2025-12-15T09:00:00+01:00"
    }

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(33);
  });

  test('should return empty array when input is empty array', () => {
    const input = {
      "historical-performance-data-list": []
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(0);
  });

  test('should return error when input is not an array (string)', () => {
    const input = {
      "historical-performance-data-list": "not-an-array"
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result).toBe(ERRORS.HISTPERF_NOT_PROVIDED);
  });

  test('should return error when input is not an array (number)', () => {
    const input = {
      "historical-performance-data-list": 123
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result).toBe(ERRORS.HISTPERF_NOT_PROVIDED);
  });

  test('should return error when input is not an array (object)', () => {
    const input = {
      "historical-performance-data-list": { "key": "value" }
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result).toBe(ERRORS.HISTPERF_NOT_PROVIDED);
  });

  test('should return empty array when all records are filtered by granularity', () => {
    const input = {
      "historical-performance-data-list": [
        { "granularity-period": ":INVALID_GRANULARITY", "period-end-time": "2024-01-01T10:15:00Z" }
      ]
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(0);
  });

  test('should return empty array when all records filtered by time threshold', () => {
    const input = {
      "historical-performance-data-list": [
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "2020-01-01T00:00:00Z" }
      ],
      "most-recent-period-end-time": "2024-01-01T00:00:00Z"
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(0);
  });

  test('should filter 24-HOURS granularity correctly', () => {
    const input = {
      "historical-performance-data-list": [
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS", "period-end-time": "2024-01-01T00:00:00Z" },
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS", "period-end-time": "2023-12-01T00:00:00Z" }
      ],
      "most-recent-period-end-time-24": "2023-12-15T00:00:00Z"
    };

    const result = p1DiscardIrrelevantPmRecords(input);
    expect(result).toMatchObject(
      {
        "filtered-historical-performance-data-list": [
          { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS", "period-end-time": "2024-01-01T00:00:00Z" }
        ]
      });
    expect(result["filtered-historical-performance-data-list"]).toHaveLength(1);
  });

  test('should handle both 15-MIN and 24-HOURS filtering together', () => {
    const input = {
      "historical-performance-data-list": [
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "2024-01-01T11:00:00Z" },
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "2024-01-01T10:00:00Z" },
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS", "period-end-time": "2024-01-02T00:00:00Z" },
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS", "period-end-time": "2023-12-01T00:00:00Z" }
      ],
      "most-recent-period-end-time": "2024-01-01T10:00:00Z",
      "most-recent-period-end-time-24": "2023-12-15T00:00:00Z"
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(2);
  });

  test('should return empty array when array contains null elements', () => {
    const input = {
      "historical-performance-data-list": [
        null,
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "2024-01-01T10:15:00Z" },
        null
      ]
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(1);
  });

  test('should return error for invalid regex pattern', () => {
    const input = {
      "historical-performance-data-list": [
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "2024-01-01T10:15:00Z" }
      ],
      "relevant-granularities": "invalid[regex"
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result).toBe(ERRORS.GENERAL_ERROR);
  });

  test('should handle timezone-aware dates correctly', () => {
    const input = {
      "historical-performance-data-list": [
        { "granularity-period": "air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "2025-12-16T00:45:00+01:00" },
        { "granularity-period": "air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "2025-12-15T09:15:00+01:00" }
      ],
      "most-recent-period-end-time": "2025-12-16T00:45:00+01:00"
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(0);
  });

  test('should filter out record with exactly equal timestamp (not greater than)', () => {
    const input = {
      "historical-performance-data-list": [
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "2024-01-01T10:00:00Z" }
      ],
      "most-recent-period-end-time": "2024-01-01T10:00:00Z"
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(0);
  });

  test('should handle missing granularity in record', () => {
    const input = {
      "historical-performance-data-list": [
        { "period-end-time": "2024-01-01T10:15:00Z" }
      ]
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(0);
  });

  test('should handle missing period-end-time in record', () => {
    const input = {
      "historical-performance-data-list": [
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN" }
      ]
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(0);
  });

  test('should filter granularity with different prefixes', () => {
    const input = {
      "historical-performance-data-list": [
        { "granularity-period": "air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "2024-01-01T11:00:00Z" },
        { "granularity-period": "air-interface-1-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "2024-01-01T11:00:00Z" },
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "2024-01-01T11:00:00Z" }
      ],
      "most-recent-period-end-time": "2024-01-01T10:00:00Z"
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(3);
  });

  test('should handle granularity as null', () => {
    const input = {
      "historical-performance-data-list": [
        { "granularity-period": null, "period-end-time": "2024-01-01T10:15:00Z" }
      ]
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(0);
  });

  test('should handle granularity as undefined', () => {
    const input = {
      "historical-performance-data-list": [
        { "granularity-period": undefined, "period-end-time": "2024-01-01T10:15:00Z" }
      ]
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(0);
  });

  test('should handle granularity as number', () => {
    const input = {
      "historical-performance-data-list": [
        { "granularity-period": 123, "period-end-time": "2024-01-01T10:15:00Z" }
      ]
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(0);
  });

  test('should handle period-end-time as null', () => {
    const input = {
      "historical-performance-data-list": [
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": null }
      ]
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(0);
  });

  test('should handle period-end-time as undefined', () => {
    const input = {
      "historical-performance-data-list": [
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": undefined }
      ]
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(0);
  });

  test('should handle period-end-time as number', () => {
    const input = {
      "historical-performance-data-list": [
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": 1704067200 }
      ]
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(0);
  });

  test('should compare dates across different timezones correctly - all are older', () => {
    const input = {
      "historical-performance-data-list": [
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "2024-01-01T10:00:00+01:00" },  // <<== those are the same time slot
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "2024-01-01T09:00:00Z" }        // <<== those are the same time slot
      ],
      "most-recent-period-end-time": "2024-01-01T10:00:00Z"
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(0);
  });

  test('should compare dates across different timezones correctly all are to be process, ', () => {
    const input = {
      "historical-performance-data-list": [
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "2024-01-01T10:00:00+01:00" },  // <<== those are the same time slot
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "2024-01-01T09:00:00Z" }        // <<== those are the same time slot
      ],
      "most-recent-period-end-time": "2024-01-01T08:59:59Z"
    };

    const result = p1DiscardIrrelevantPmRecords(input);
    expect(result).toMatchObject(
      {
        "filtered-historical-performance-data-list": [
          { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "2024-01-01T10:00:00+01:00" },  // <<== those are the same time slot
          { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "2024-01-01T09:00:00Z" }        // <<== those are the same time slot
        ]
      });
    expect(result["filtered-historical-performance-data-list"]).toHaveLength(2);
  });


  test('should handle invalid most-recent-period-end-time', () => {
    const input = {
      "historical-performance-data-list": [
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "2024-01-01T10:15:00Z" }
      ],
      "most-recent-period-end-time": "invalid-date"
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(1);
  });

  test('edge case: should filter out records with empty strings for granularity or period-end-time', () => {
    const input = {
      "historical-performance-data-list": [
        { "granularity-period": "", "period-end-time": "2024-01-01T10:15:00Z" },
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "" },
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "2024-01-01T10:15:00Z" }
      ],
      "most-recent-period-end-time": "2024-01-01T10:00:00Z"
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(1);
    expect(result["filtered-historical-performance-data-list"][0]["period-end-time"]).toBe("2024-01-01T10:15:00Z");
  });

  test('edge case: should filter out records with whitespace-only granularity or period-end-time', () => {
    const input = {
      "historical-performance-data-list": [
        { "granularity-period": "   ", "period-end-time": "2024-01-01T10:15:00Z" },
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "   " },
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "2024-01-01T10:15:00Z" }
      ],
      "most-recent-period-end-time": "2024-01-01T10:00:00Z"
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(1);
    expect(result["filtered-historical-performance-data-list"][0]["period-end-time"]).toBe("2024-01-01T10:15:00Z");
  });

  test('edge case: should filter out records with newline characters in granularity or period-end-time', () => {
    const input = {
      "historical-performance-data-list": [
        { "granularity-period": "\n", "period-end-time": "2024-01-01T10:15:00Z" },
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "\n  \n" },
        { "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN", "period-end-time": "2024-01-01T10:15:00Z" }
      ],
      "most-recent-period-end-time": "2024-01-01T10:00:00Z"
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(1);
    expect(result["filtered-historical-performance-data-list"][0]["period-end-time"]).toBe("2024-01-01T10:15:00Z");
  });

});
