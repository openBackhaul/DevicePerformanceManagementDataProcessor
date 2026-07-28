const p1CategorizeDataVolume = require('./P1CategorizeDataVolume');

const ERRORS = require('./ErrorsEnum');
const fs = require('fs');

describe('p1CategorizeDataVolume', () => {

  const GRANULARITY_15_MIN =
    "ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN";

  function buildPmData(periodEndTime, values = {}) {
    return {
      "granularity-period": GRANULARITY_15_MIN,
      "period-end-time": periodEndTime,
      "performance-data": {
        "total-bytes-output": values.totalBytesOutput ?? 1000,
        "total-air-interface-interval-capacity":
          values.totalAirInterfaceIntervalCapacity ?? 5000,
        "errored-frames-input": values.erroredFramesInput ?? 0,
        "dropped-frames-input": values.droppedFramesInput ?? 0
      }
    };
  }

  function buildInput(periodEndTime, interfaceStatus = { uuid: "interface-001" }) {
    return {
      "historical-performance-data": buildPmData(periodEndTime),
      "interface-status": interfaceStatus
    };
  }

  test('Input null', () => {
    const result = p1CategorizeDataVolume(null);
    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.GENERAL_ERROR)
  });

  test('Content test 1', () => {
    const input = {
      "historical-performance-data": {
        "granularity-period": "ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
        "period-end-time": "2026-07-06T12:15:00.000Z",
        "performance-data": {
          "total-bytes-output": 1000,
          "total-air-interface-interval-capacity": 5000,
          "errored-frames-input": 2,
          "dropped-frames-input": 1
        }
      },
      "interface-status": {
        "uuid": "interface-001"
      }
    };
    const result = p1CategorizeDataVolume(input);
    expect(result).toBeDefined();

    const constr = {
      "interface-status": {
        "uuid": "interface-001",
        "15-minute-values-by-day": [
          {
            "day": 6,
            "15-minute-values-by-hour": [
              {
                "hour": 0,
                "15-minute-values": []
              },
              {
                "hour": 1,
                "15-minute-values": []
              },
              {
                "hour": 2,
                "15-minute-values": []
              },
              {
                "hour": 3,
                "15-minute-values": []
              },
              {
                "hour": 4,
                "15-minute-values": []
              },
              {
                "hour": 5,
                "15-minute-values": []
              },
              {
                "hour": 6,
                "15-minute-values": []
              },
              {
                "hour": 7,
                "15-minute-values": []
              },
              {
                "hour": 8,
                "15-minute-values": []
              },
              {
                "hour": 9,
                "15-minute-values": []
              },
              {
                "hour": 10,
                "15-minute-values": []
              },
              {
                "hour": 11,
                "15-minute-values": []
              },
              {
                "hour": 12,
                "15-minute-values": [
                  {
                    "period-end-time": "2026-07-06T12:15:00.000Z",
                    "total-bytes-output": 1000,
                    "total-air-interface-interval-capacity": 5000,
                    "errored-frames-input": 2,
                    "dropped-frames-input": 1
                  }
                ]
              },
              {
                "hour": 13,
                "15-minute-values": []
              },
              {
                "hour": 14,
                "15-minute-values": []
              },
              {
                "hour": 15,
                "15-minute-values": []
              },
              {
                "hour": 16,
                "15-minute-values": []
              },
              {
                "hour": 17,
                "15-minute-values": []
              },
              {
                "hour": 18,
                "15-minute-values": []
              },
              {
                "hour": 19,
                "15-minute-values": []
              },
              {
                "hour": 20,
                "15-minute-values": []
              },
              {
                "hour": 21,
                "15-minute-values": []
              },
              {
                "hour": 22,
                "15-minute-values": []
              },
              {
                "hour": 23,
                "15-minute-values": []
              }
            ]
          }
        ]
      }
    };

    // console.log(JSON.stringify(result));
    expect(result).toEqual(constr);
  });

  test("should initialize 15-minute-values-by-day and categorize one PM record", () => {
    const input = buildInput("2026-07-06T12:15:00.000Z");

    const result = p1CategorizeDataVolume(input);

    const status = result["interface-status"];
    const days = status["15-minute-values-by-day"];

    expect(days).toHaveLength(1);
    expect(days[0].day).toBe(6);
    expect(days[0]["15-minute-values-by-hour"]).toHaveLength(24);

    const hour12 = days[0]["15-minute-values-by-hour"][12];

    expect(hour12.hour).toBe(12);
    expect(hour12["15-minute-values"]).toHaveLength(1);
    expect(hour12["15-minute-values"][0]).toEqual({
      "period-end-time": "2026-07-06T12:15:00.000Z",
      "total-bytes-output": 1000,
      "total-air-interface-interval-capacity": 5000,
      "errored-frames-input": 0,
      "dropped-frames-input": 0
    });
  });

  test("should append multiple 15-minute records into the same hour bucket", () => {
    let interfaceStatus = { "uuid": "interface-001-Lorenzo" };

    interfaceStatus = p1CategorizeDataVolume(
      buildInput("2026-07-06T12:00:00.000Z", interfaceStatus)
    )["interface-status"];

    interfaceStatus = p1CategorizeDataVolume(
      buildInput("2026-07-06T12:15:00.000Z", interfaceStatus)
    )["interface-status"];

    interfaceStatus = p1CategorizeDataVolume(
      buildInput("2026-07-06T12:30:00.000Z", interfaceStatus)
    )["interface-status"];

    const dayBucket = interfaceStatus["15-minute-values-by-day"][0];
    const hour12 = dayBucket["15-minute-values-by-hour"][12];

    expect(hour12["15-minute-values"]).toHaveLength(3);

    expect(hour12["15-minute-values"].map(v => v["period-end-time"])).toEqual([
      "2026-07-06T12:00:00.000Z",
      "2026-07-06T12:15:00.000Z",
      "2026-07-06T12:30:00.000Z"
    ]);
  });

  test("should keep maximum 4 values inside one hour bucket", () => {
    let interfaceStatus = { "uuid": "interface-001" };

    const periods = [
      "2026-07-06T12:00:00.000Z",
      "2026-07-06T12:15:00.000Z",
      "2026-07-06T12:30:00.000Z",
      "2026-07-06T12:45:00.000Z",
      "2026-07-06T12:50:00.000Z"
    ];

    for (const period of periods) {
      interfaceStatus = p1CategorizeDataVolume(
        buildInput(period, interfaceStatus)
      )["interface-status"];
    }

    const hour12 =
      interfaceStatus["15-minute-values-by-day"][0]
      ["15-minute-values-by-hour"][12];

    expect(hour12["15-minute-values"]).toHaveLength(4);

    expect(hour12["15-minute-values"].map(v => v["period-end-time"])).toEqual([
      "2026-07-06T12:15:00.000Z",
      "2026-07-06T12:30:00.000Z",
      "2026-07-06T12:45:00.000Z",
      "2026-07-06T12:50:00.000Z"
    ]);
  });

  test("should categorize records into different hour buckets", () => {
    let interfaceStatus = { "uuid": "interface-001" };

    interfaceStatus = p1CategorizeDataVolume(
      buildInput("2026-07-06T12:15:00.000Z", interfaceStatus)
    )["interface-status"];

    interfaceStatus = p1CategorizeDataVolume(
      buildInput("2026-07-06T13:15:00.000Z", interfaceStatus)
    )["interface-status"];

    const dayBucket = interfaceStatus["15-minute-values-by-day"][0];

    const hour12 = dayBucket["15-minute-values-by-hour"][12];
    const hour13 = dayBucket["15-minute-values-by-hour"][13];

    expect(hour12["15-minute-values"]).toHaveLength(1);
    expect(hour13["15-minute-values"]).toHaveLength(1);

    expect(hour12["15-minute-values"][0]["period-end-time"]).toBe(
      "2026-07-06T12:15:00.000Z"
    );

    expect(hour13["15-minute-values"][0]["period-end-time"]).toBe(
      "2026-07-06T13:15:00.000Z"
    );
  });

  test("should keep only two day buckets", () => {
    let interfaceStatus = { "uuid": "interface-001" };

    interfaceStatus = p1CategorizeDataVolume(
      buildInput("2026-07-05T12:15:00.000Z", interfaceStatus)
    )["interface-status"];

    interfaceStatus = p1CategorizeDataVolume(
      buildInput("2026-07-06T12:15:00.000Z", interfaceStatus)
    )["interface-status"];

    interfaceStatus = p1CategorizeDataVolume(
      buildInput("2026-07-07T12:15:00.000Z", interfaceStatus)
    )["interface-status"];

    const days = interfaceStatus["15-minute-values-by-day"];

    expect(days).toHaveLength(2);
    expect(days.map(d => d.day)).toEqual([6, 7]);
  });

  test("should handle month rollover: day 31 older than day 1", () => {
    let interfaceStatus = { "uuid": "interface-001" };

    interfaceStatus = p1CategorizeDataVolume(
      buildInput("2026-07-31T23:45:00.000Z", interfaceStatus)
    )["interface-status"];

    interfaceStatus = p1CategorizeDataVolume(
      buildInput("2026-08-01T00:00:00.000Z", interfaceStatus)
    )["interface-status"];

    interfaceStatus = p1CategorizeDataVolume(
      buildInput("2026-08-02T00:00:00.000Z", interfaceStatus)
    )["interface-status"];

    const days = interfaceStatus["15-minute-values-by-day"];

    expect(days).toHaveLength(2);
    expect(days.map(d => d.day)).toEqual([1, 2]);
  });

  test("should return error if historical-performance-data is missing", () => {
    const input = {
      "interface-status": {
        "uuid": "interface-001"
      }
    };

    const result = p1CategorizeDataVolume(input);
    expect(result).toBe(ERRORS.HISTORICAL_PERF_NOT_PROVIDED);
  });

  test("should return error if interface-status is missing", () => {
    const input = {
      "historical-performance-data": buildPmData(
        "2026-07-06T12:15:00.000Z"
      )
    };
    const result = p1CategorizeDataVolume(input);
    expect(result).toBe(ERRORS.INTERFACE_STATUS_NOT_PROVVIDED);
  });

  test("should return error if interface-status is invalid", () => {
    const input = {
      "historical-performance-data": buildPmData(
        "2026-07-06T12:15:00.000Z"
      ),
      "interface-status": {}
    };

    const result = p1CategorizeDataVolume(input);
    expect(result).toBe(ERRORS.INTERFACE_STATUS_INVALID);
  });

  test("should return error if PM data has wrong granularity", () => {
    const input = {
      "historical-performance-data": {
        ...buildPmData("2026-07-06T12:15:00.000Z"),
        "granularity-period":
          "ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS"
      },
      "interface-status": {
        "uuid": "interface-001"
      }
    };

    const result = p1CategorizeDataVolume(input);
    expect(result).toBe(ERRORS.PM_DATA_WRONG_GRAN_PROV);
  });

  test("should return error if period-end-time is invalid", () => {
    const input = buildInput("invalid-date");

    const result = p1CategorizeDataVolume(input);
    expect(result).toBe(ERRORS.HISTORICAL_PERF_INVALID);
  });
});
