const p1DiscardIrrelevantPmRecords = require('./P1DiscardIrrelevantPmRecords');
const ERRORS = require('./ErrorsEnum');

const HISTORICAL_PERF_LIST1 = [
  {
    "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
    "period-end-time": "2024-01-01T10:15:00Z",
    "performance-data": {
      "defect-blocks-sum": 0,
      "cses": 0,
      "es": 0,
      "xpd-max": -99,
      "tx-level-max": 23,
      "ses": 0,
      "rx-level-max": -95,
      "rf-temp-max": -99,
      "snir-min": -99,
      "snir-avg": -99,
      "rx-level-avg": -95,
      "unavailability": 900,
      "time-xstates-list": [
        {
          "time-xstate-sequence-number": 14,
          "time": 0,
          "transmission-mode": "56014"
        },
        {
          "time-xstate-sequence-number": 12,
          "time": 0,
          "transmission-mode": "56012"
        },
        {
          "time-xstate-sequence-number": 13,
          "time": 0,
          "transmission-mode": "56013"
        },
        {
          "time-xstate-sequence-number": 10,
          "time": 0,
          "transmission-mode": "56010"
        },
        {
          "time-xstate-sequence-number": 11,
          "time": 0,
          "transmission-mode": "56011"
        },
        {
          "time-xstate-sequence-number": 8,
          "time": 0,
          "transmission-mode": "56008"
        },
        {
          "time-xstate-sequence-number": 9,
          "time": 0,
          "transmission-mode": "56009"
        },
        {
          "time-xstate-sequence-number": 6,
          "time": 0,
          "transmission-mode": "56006"
        },
        {
          "time-xstate-sequence-number": 7,
          "time": 0,
          "transmission-mode": "56007"
        },
        {
          "time-xstate-sequence-number": 4,
          "time": 0,
          "transmission-mode": "56004"
        },
        {
          "time-xstate-sequence-number": 5,
          "time": 0,
          "transmission-mode": "56005"
        },
        {
          "time-xstate-sequence-number": 2,
          "time": 0,
          "transmission-mode": "56002"
        },
        {
          "time-xstate-sequence-number": 3,
          "time": 0,
          "transmission-mode": "56003"
        },
        {
          "time-xstate-sequence-number": 1,
          "time": 0,
          "transmission-mode": "56001"
        }
      ],
      "rx-level-min": -96,
      "xpd-min": -99,
      "xpd-avg": -99,
      "tx-level-min": 23,
      "tx-level-avg": 23,
      "rf-temp-min": -99,
      "rf-temp-avg": -99,
      "snir-max": -99,
      "time-period": 900
    }
  },
  {
    "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
    "period-end-time": "2024-01-01T10:30:00Z",
    "performance-data": {
      "defect-blocks-sum": 0,
      "cses": 0,
      "es": 0,
      "xpd-max": -99,
      "tx-level-max": 23,
      "ses": 0,
      "rx-level-max": -95,
      "rf-temp-max": -99,
      "snir-min": -99,
      "snir-avg": -99,
      "rx-level-avg": -95,
      "unavailability": 77,
      "time-xstates-list": [
        {
          "time-xstate-sequence-number": 14,
          "time": 0,
          "transmission-mode": "56014"
        },
        {
          "time-xstate-sequence-number": 12,
          "time": 0,
          "transmission-mode": "56012"
        },
        {
          "time-xstate-sequence-number": 13,
          "time": 0,
          "transmission-mode": "56013"
        },
        {
          "time-xstate-sequence-number": 10,
          "time": 0,
          "transmission-mode": "56010"
        },
        {
          "time-xstate-sequence-number": 11,
          "time": 0,
          "transmission-mode": "56011"
        },
        {
          "time-xstate-sequence-number": 8,
          "time": 0,
          "transmission-mode": "56008"
        },
        {
          "time-xstate-sequence-number": 9,
          "time": 0,
          "transmission-mode": "56009"
        },
        {
          "time-xstate-sequence-number": 6,
          "time": 0,
          "transmission-mode": "56006"
        },
        {
          "time-xstate-sequence-number": 7,
          "time": 0,
          "transmission-mode": "56007"
        },
        {
          "time-xstate-sequence-number": 4,
          "time": 0,
          "transmission-mode": "56004"
        },
        {
          "time-xstate-sequence-number": 5,
          "time": 0,
          "transmission-mode": "56005"
        },
        {
          "time-xstate-sequence-number": 2,
          "time": 0,
          "transmission-mode": "56002"
        },
        {
          "time-xstate-sequence-number": 3,
          "time": 0,
          "transmission-mode": "56003"
        },
        {
          "time-xstate-sequence-number": 1,
          "time": 0,
          "transmission-mode": "56001"
        }
      ],
      "rx-level-min": -96,
      "xpd-min": -99,
      "xpd-avg": -99,
      "tx-level-min": 23,
      "tx-level-avg": 23,
      "rf-temp-min": -99,
      "rf-temp-avg": -99,
      "snir-max": -99,
      "time-period": 77
    },
  },
  {
    "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS",
    "period-end-time": "2024-01-02T00:00:00Z",
    "performance-data": {}
  },
  {
    "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS",
    "period-end-time": "2023-12-30T00:00:00Z",
    "performance-data": {}
  },
  {
    "granularity-period": ":GRANULARITY_PERIOD_TYPE_PERIOD-1-HOUR",
    "period-end-time": "2024-01-01T10:00:00Z",
    "performance-data": {}
  }
];

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

describe('p1DiscardIrrelevantPmRecords', () => {

  test('should return error if input is missing', () => {
    expect(p1DiscardIrrelevantPmRecords(null))
      .toBe(ERRORS.HISTPERF_NOT_PROVIDED);
  });

  test('should filter records correctly (full scenario)', () => {
    const input = {
      "historical-performance-data-list": HISTORICAL_PERF_LIST1,
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
      "historical-performance-data-list": [
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
      ],
      "relevant-granularities": ":GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN"
    };

    const result = p1DiscardIrrelevantPmRecords(input);

    expect(result["filtered-historical-performance-data-list"]).toHaveLength(1);
  });

});