const p1RemoveOutOfRangeLevels = require('./P1RemoveOutOfRangeLevels');
const ERRORS = require('./ErrorsEnum');

const performanceStruct1 = {
  "es": 0,
  "ses": 0,
  "cses": 0,
  "unavailability": 0,
  "tx-level-min": 10,
  "tx-level-max": 100,
  "tx-level-avg": 50,
  "rx-level-min": 1000,
  "rx-level-max": 10000,
  "rx-level-avg": 5000,
  "time-xstates-list": [
    { "transmission-mode": "A" },
    { "transmission-mode": "B" },
    { "transmission-mode": "C" },
  ],
  "interval-capacity": 0,
  "snir-min": 0,
  "snir-max": 0,
  "snir-avg": 0,
  "xpd-min": 0,
  "xpd-max": 0,
  "xpd-avg": 0,
  "defect-blocks-sum": 0,
  "time-period": 100
}

const performanceStruct2 = {
  "es": 0,
  "ses": 0,
  "cses": 0,
  "unavailability": 0,
  "tx-level-min": 5,
  "tx-level-max": 200,
  "tx-level-avg": 50,
  "rx-level-min": 1000,
  "rx-level-max": 100000,
  "rx-level-avg": 5000,
  "time-xstates-list": [
    { "transmission-mode": "A" },
    { "transmission-mode": "B" },
    { "transmission-mode": "C" },
  ],
  "interval-capacity": 0,
  "snir-min": 0,
  "snir-max": 0,
  "snir-avg": 0,
  "xpd-min": 0,
  "xpd-max": 0,
  "xpd-avg": 0,
  "defect-blocks-sum": 0,
  "time-period": 100
}

const wrongPerformanceStruct1 = {
  "es": 0,
  "ses": 0,
  "cses": 0,
  "unavailability": 0,
  "tx-level-min": 5,
  "tx-level-avg": 50,
  "rx-level-min": 1000,
  "rx-level-max": 100000,
  "rx-level-avg": 5000,
  "time-xstates-list": [
    { "transmission-mode": "A" },
    { "transmission-mode": "B" },
    { "transmission-mode": "C" },
  ],
  "interval-capacity": 0,
  "snir-min": 0,
  "snir-max": 0,
  "snir-avg": 0,
  "xpd-min": 0,
  "xpd-max": 0,
  "xpd-avg": 0,
  "defect-blocks-sum": 0,
  "time-period": 100
}

const parameterStruct1 = {
  "function-name": "p1RemoveOutOfRangeLevels",
  "description": "Removes out-of-range level attributes from a performance data slice",
  "is-active": true,
  "parameter": [
    {
      "parameter-name": "lowerTxLevelLimit",
      "purpose": "Lower bound of valid values of the transmit level",
      "owner": "engineering",
      "value": "10"
    },
    {
      "parameter-name": "upperTxLevelLimit",
      "purpose": "Upper bound of valid values of the transmit level",
      "owner": "engineering",
      "value": "100"
    },
    {
      "parameter-name": "lowerRxLevelLimit",
      "purpose": "Lower bound of valid values of the receive level",
      "owner": "engineering",
      "value": "1000"
    },
    {
      "parameter-name": "upperRxLevelLimit",
      "purpose": "Upper bound of valid values of the receive level",
      "owner": "engineering",
      "value": "10000"
    }
  ],
  "sub-function": []
};

const wrongParameterStruct1 = {
  "lowerTxLevelLimit": "10",
  "upperTxLevelLimit": "100",
  "upperRxLevelLimit": "10000",
}

const wrongParameterStruct2 = {
  "lowerTxLevelLimit": "dsgf",
  "upperTxLevelLimit": 100,
  "lowerRxLevelLimit": 1000,
  "upperRxLevelLimit": ":",
}

describe('Positive Tests - Happy Path @positive', () => {

  test('All levels are ok @positive', () => {
    expect(p1RemoveOutOfRangeLevels({
      "performance-data": performanceStruct1,
      "parameters": parameterStruct1
    }))
      .toMatchObject({
        "performance-data": performanceStruct1
      });
  });

  test('Remove some levels @positive', () => {
    const result = p1RemoveOutOfRangeLevels({
      "performance-data": performanceStruct2,
      "parameters": parameterStruct1
    });

    expect(result["performance-data"]["es"]).toBe(0);
    expect(result["performance-data"]["tx-level-avg"]).toBe(50);
    expect(result["performance-data"]["rx-level-min"]).toBe(1000);
    expect(result["performance-data"]["rx-level-avg"]).toBe(5000);
    expect(result["performance-data"]["interval-capacity"]).toBe(0);

    expect('tx-level-min' in result["performance-data"]).toBe(false);
    expect('tx-level-max' in result["performance-data"]).toBe(false);
    expect('rx-level-max' in result["performance-data"]).toBe(false);
  });

});

describe('Negative Tests - Error Cases @negative', () => {

  test('Missing parameters @negative', () => {
    expect(p1RemoveOutOfRangeLevels({
      "performance-data": performanceStruct2,
    }))
      .toBe(ERRORS.PARAM_NOT_PROVIDED);
  });

  test('Missing parameters (undefined) @negative', () => {
    expect(p1RemoveOutOfRangeLevels({
      "performance-data": performanceStruct2,
      "parameters": undefined
    }))
      .toBe(ERRORS.PARAM_NOT_PROVIDED);
  });

  test('Missing parameters (null) @negative', () => {
    expect(p1RemoveOutOfRangeLevels({
      "performance-data": performanceStruct2,
      "parameters": null
    }))
      .toBe(ERRORS.PARAM_NOT_PROVIDED);
  });

  test('Missing parameters (string) @negative', () => {
    expect(p1RemoveOutOfRangeLevels({
      "performance-data": performanceStruct2,
      "parameters": "ciao"
    }))
      .toBe(ERRORS.PARAM_INVALID);
  });

  test('Missing some property of parameters @negative', () => {
    expect(p1RemoveOutOfRangeLevels({
      "performance-data": performanceStruct2,
      "parameters": wrongParameterStruct1
    }))
      .toBe(ERRORS.PARAM_INVALID);
  });

  test('String on property of parameters @negative', () => {
    expect(p1RemoveOutOfRangeLevels({
      "performance-data": performanceStruct2,
      "parameters": wrongParameterStruct2
    }))
      .toBe(ERRORS.PARAM_INVALID);
  });

  test('Missing performance data @negative', () => {
    expect(p1RemoveOutOfRangeLevels({
      "parameters": parameterStruct1
    }))
      .toBe(ERRORS.PERF_NOT_PROVIDED);
  });

  test('Missing some property of performance @negative', () => {
    expect(p1RemoveOutOfRangeLevels({
      "performance-data": wrongPerformanceStruct1,
      "parameters": parameterStruct1
    }))
      .toBe(ERRORS.PERF_INVALID);
  });

});

describe('Edge Cases @edge', () => {

  test('Should NOT mutate original performance data - MUTATION BUG DETECTION @edge', () => {
    const originalPerformance = {
      "es": 0,
      "ses": 0,
      "cses": 0,
      "unavailability": 0,
      "tx-level-min": 5,
      "tx-level-max": 100,
      "tx-level-avg": 50,
      "rx-level-min": 1000,
      "rx-level-max": 10000,
      "rx-level-avg": 5000,
      "interval-capacity": 0,
      "snir-min": 0,
      "snir-max": 0,
      "snir-avg": 0,
      "xpd-min": 0,
      "xpd-max": 0,
      "xpd-avg": 0,
      "defect-blocks-sum": 0,
      "time-period": 100
    };

    p1RemoveOutOfRangeLevels({
      "performance-data": originalPerformance,
      "parameters": parameterStruct1
    });

    expect(originalPerformance["tx-level-min"]).toBe(5);
  });

  test('Should delete CORRECT property (not always tx-level-min) - WRONG PROPERTY DELETE BUG DETECTION @edge', () => {
    const inputPerformance = {
      "es": 0,
      "ses": 0,
      "cses": 0,
      "unavailability": 0,
      "tx-level-min": 50,
      "tx-level-max": 200,
      "tx-level-avg": 50,
      "rx-level-min": 1000,
      "rx-level-max": 10000,
      "rx-level-avg": 5000,
      "interval-capacity": 0,
      "snir-min": 0,
      "snir-max": 0,
      "snir-avg": 0,
      "xpd-min": 0,
      "xpd-max": 0,
      "xpd-avg": 0,
      "defect-blocks-sum": 0,
      "time-period": 100
    };

    const result = p1RemoveOutOfRangeLevels({
      "performance-data": inputPerformance,
      "parameters": parameterStruct1
    });

    expect(result["performance-data"]["tx-level-max"]).toBeUndefined();
    expect(result["performance-data"]["tx-level-min"]).toBe(50);
  });

  test('Should delete CORRECT rx-level property - WRONG PROPERTY DELETE BUG DETECTION @edge', () => {
    const inputPerformance = {
      "es": 0,
      "ses": 0,
      "cses": 0,
      "unavailability": 0,
      "tx-level-min": 50,
      "tx-level-max": 100,
      "tx-level-avg": 50,
      "rx-level-min": 500,
      "rx-level-max": 100000,
      "rx-level-avg": 5000,
      "interval-capacity": 0,
      "snir-min": 0,
      "snir-max": 0,
      "snir-avg": 0,
      "xpd-min": 0,
      "xpd-max": 0,
      "xpd-avg": 0,
      "defect-blocks-sum": 0,
      "time-period": 100
    };

    const result = p1RemoveOutOfRangeLevels({
      "performance-data": inputPerformance,
      "parameters": parameterStruct1
    });

    expect(result["performance-data"]["rx-level-max"]).toBeUndefined();
    expect(result["performance-data"]["rx-level-min"]).toBeUndefined();
  });

});
