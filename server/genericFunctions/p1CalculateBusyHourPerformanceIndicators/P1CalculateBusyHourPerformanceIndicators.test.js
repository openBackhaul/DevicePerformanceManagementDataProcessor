const p1CalculateBusyHourPerformanceIndicators = require('./P1CalculateBusyHourPerformanceIndicators');
const ERRORS = require('./ErrorsEnum');
const fs = require('fs');

describe("p1CalculateBusyHourPerformanceIndicators - Errors", () => {

  describe("Errors checks", () => {
    test("input null", () => {
      const result = p1CalculateBusyHourPerformanceIndicators(null);
      expect(result).toBeDefined();
      expect(result).toBe(ERRORS.GENERAL_ERROR);
    });

    test("input undefined", () => {
      const result = p1CalculateBusyHourPerformanceIndicators({});
      expect(result).toBeDefined();
      expect(result).toBe(ERRORS.GENERAL_ERROR);
    });

    test("input undefined 2", () => {
      const result = p1CalculateBusyHourPerformanceIndicators({
        "historical-performance-data": undefined,
        "interface-status": undefined
      });
      expect(result).toBeDefined();
      expect(result).toBe(ERRORS.GENERAL_ERROR);
    });

    test("input historical undefined", () => {
      const result = p1CalculateBusyHourPerformanceIndicators({
        "historical-performance-data": undefined,
        "interface-status": {}
      });
      expect(result).toBeDefined();
      expect(result).toBe(ERRORS.HISTORICAL_PERF_NOT_PROVIDED);
    });

    test("input historical undefined", () => {
      const result = p1CalculateBusyHourPerformanceIndicators({
        "historical-performance-data": {},
        "interface-status": {}
      });
      expect(result).toBeDefined();
      // expect(result).toBe(ERRORS.HISTORICAL_PERF_WRONG_GRAN_PROV);
    });

  });

  describe("Data content tests", () => {
    const GRANULARITY_24H = "ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS";

    function createEmptyHours() {
      return Array.from({ length: 24 }, (_, hour) => ({
        hour,
        "15-minute-values": []
      }));
    }

    test("Test content 1", () => {
      const input1 = {
        "historical-performance-data": {
          "granularity-period": GRANULARITY_24H,
          "period-end-time": "2025-06-10T23:59:59Z",
          "performance-data": {}
        },
        "interface-status": {
          "uuid": "eth-container-001",
          "15-minute-values-by-day": [
            {
              "day": 10,
              "15-minute-values-by-hour": createEmptyHours()
            }
          ]
        }
      };

      input1["interface-status"]["15-minute-values-by-day"][0]["15-minute-values-by-hour"][10]["15-minute-values"] = [
        {
          "period-end-time": "2025-06-10T10:15:00Z",
          "total-bytes-output": 900000000,
          "total-air-interface-interval-capacity": 100000,
          "errored-frames-input": 1,
          "dropped-frames-input": 2
        },
        {
          "period-end-time": "2025-06-10T10:30:00Z",
          "total-bytes-output": 800000000,
          "total-air-interface-interval-capacity": 100000,
          "errored-frames-input": 0,
          "dropped-frames-input": 1
        },
        {
          "period-end-time": "2025-06-10T10:45:00Z",
          "total-bytes-output": 700000000,
          "total-air-interface-interval-capacity": 100000,
          "errored-frames-input": 2,
          "dropped-frames-input": 0
        },
        {
          "period-end-time": "2025-06-10T11:00:00Z",
          "total-bytes-output": 600000000,
          "total-air-interface-interval-capacity": 100000,
          "errored-frames-input": 1,
          "dropped-frames-input": 1
        }
      ];
      const result = p1CalculateBusyHourPerformanceIndicators(input1);
      expect(result).toBeDefined();
      const struct = {
        "historical-performance-data": {
          "granularity-period": GRANULARITY_24H,
          "period-end-time": "2025-06-10T23:59:59Z",
          "performance-data": {
            "busy-hour": {
              "period-end-time-list": [
                "2025-06-10T10:15:00Z",
                "2025-06-10T10:30:00Z",
                "2025-06-10T10:45:00Z",
                "2025-06-10T11:00:00Z"
              ],
              "label": "2025/06/10/10/00",
              "throughput": 6666,
              "capacity": 100000,
              "utilization": 6,
              "errored-frames": 4,
              "dropped-frames": 4,
              "suspicious-result-flag": false
            }
          }
        }
      };

      expect(result).toEqual(struct);
    });

    test("Test content 2", () => {
      const input2 = {
        "historical-performance-data": {
          "granularity-period": GRANULARITY_24H,
          "period-end-time": "2025-06-10T23:59:59Z",
          "performance-data": {}
        },
        "interface-status": {
          uuid: "eth-container-001",
          "15-minute-values-by-day": [
            {
              day: 10,
              "15-minute-values-by-hour": createEmptyHours()
            }
          ]
        }
      };

      input2["interface-status"]["15-minute-values-by-day"][0]
      ["15-minute-values-by-hour"][15]["15-minute-values"] = [
          {
            "period-end-time": "2025-06-10T15:15:00Z",
            "total-bytes-output": 2000000000,
            "total-air-interface-interval-capacity": 100000,
            "errored-frames-input": 1,
            "dropped-frames-input": 0
          },
          {
            "period-end-time": "2025-06-10T15:30:00Z",
            "total-bytes-output": 1000000000,
            "total-air-interface-interval-capacity": 100000,
            "errored-frames-input": 2,
            "dropped-frames-input": 1
          }
        ];
      const result = p1CalculateBusyHourPerformanceIndicators(input2);
      expect(result).toBeDefined();
      const struct = {
        "historical-performance-data": {
          "granularity-period": GRANULARITY_24H,
          "period-end-time": "2025-06-10T23:59:59Z",
          "performance-data": {
            "busy-hour": {
              "label": "2025/06/10/15/00",
              "throughput": 6666,
              "capacity": 50000,
              "utilization": 13,
              "errored-frames": 3,
              "dropped-frames": 1,
              "suspicious-result-flag": true,
              "period-end-time-list": [
                "2025-06-10T15:15:00Z",
                "2025-06-10T15:30:00Z"
              ]
            }
          }
        }
      };

      expect(result).toEqual(struct);
    });

    test("Test content 3", () => {
      const input3 = {
        "historical-performance-data": {
          "granularity-period": "ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MINUTES",
          "period-end-time": "2025-06-10T10:15:00Z",
          "performance-data": {}
        },
        "interface-status": {
          "uuid": "eth-container-001",
          "15-minute-values-by-day": []
        }
      };

      const result = p1CalculateBusyHourPerformanceIndicators(input3);
      expect(result).toBeDefined();
      expect(result).toBe(ERRORS.HISTORICAL_PERF_WRONG_GRAN_PROV);
    });

    test("Test content 4", () => {
      const input4 = {
        "interface-status": {
          uuid: "eth-container-001",
          "15-minute-values-by-day": []
        }
      };

      const result = p1CalculateBusyHourPerformanceIndicators(input4);
      expect(result).toBeDefined();
      expect(result).toBe(ERRORS.HISTORICAL_PERF_NOT_PROVIDED);
    });

    test("Test content 5", () => {
      const input5 = {
        "historical-performance-data": {
          "granularity-period": GRANULARITY_24H,
          "period-end-time": "2025-06-10T23:59:59Z",
          "performance-data": {}
        }
      };
      const result = p1CalculateBusyHourPerformanceIndicators(input5);
      expect(result).toBeDefined();
      expect(result).toBe(ERRORS.INT_STATUS_NOT_PROVIDED);
    });

    test("Test content 6", () => {
      const input6 = {
        "historical-performance-data": {
          "granularity-period": GRANULARITY_24H,
          "period-end-time": "2025-06-10T23:59:59Z",
          "performance-data": {}
        },
        "interface-status": {
          uuid: "eth-container-001",
          "15-minute-values-by-day": [
            {
              day: 10,
              "15-minute-values-by-hour": createEmptyHours()
            }
          ]
        }
      };

      input6["interface-status"]["15-minute-values-by-day"][0]
      ["15-minute-values-by-hour"][8]["15-minute-values"] = [
          {
            "period-end-time": "2025-06-10T08:15:00Z",
            "total-bytes-output": 1000000000,
            "total-air-interface-interval-capacity": 100000,
            "errored-frames-input": 0,
            "dropped-frames-input": 0
          }
        ];

      input6["interface-status"]["15-minute-values-by-day"][0]
      ["15-minute-values-by-hour"][18]["15-minute-values"] = [
          {
            "period-end-time": "2025-06-10T18:15:00Z",
            "total-bytes-output": 1000000000,
            "total-air-interface-interval-capacity": 100000,
            "errored-frames-input": 0,
            "dropped-frames-input": 0
          }
        ];

      const result = p1CalculateBusyHourPerformanceIndicators(input6);
      expect(result).toBeDefined();
      const struct = {
        "historical-performance-data": {
          "granularity-period": "ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS",
          "period-end-time": "2025-06-10T23:59:59Z",
          "performance-data": {
            "busy-hour": {
              "period-end-time-list": [
                "2025-06-10T08:15:00Z"
              ],
              "label": "2025/06/10/08/00",
              "throughput": 2222,
              "capacity": 25000,
              "utilization": 8,
              "errored-frames": 0,
              "dropped-frames": 0,
              "suspicious-result-flag": true
            }
          }
        }
      }
      expect(result).toEqual(struct);
    });
  });
});
