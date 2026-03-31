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
      .toBe(ERRORS.HISTPERF_NOT_PROVIDED);
  });

  test('should filter records correctly (full scenario)', () => {
    let dataFile = fs.readFileSync(__dirname + '/historicalData1.json', 'utf8');
    let historicalData = JSON.parse(dataFile);
    const input = {
      "historical-performance-data-list": historicalData,
      "most-recent-period-end-time": "2024-01-01T10:00:00Z",
      "most-recent-period-end-time-24": "2024-01-01T00:00:00Z"
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(3);
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
    let dataFile = fs.readFileSync(__dirname + '/historicalDataFull.json', 'utf8');
    let historicalDataList = JSON.parse(dataFile);

    const input = {
      "historical-performance-data-list": historicalDataList,
      "relevant-granularities": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
      "most-recent-period-end-time": "2025-12-16T00:45:00+01:00",
      "most-recent-period-end-time-24": "2025-12-15T09:00:00+01:00"
    }

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(33);
  })

});