const p1RemoveOutOfRangeLevels = require('./P1RemoveOutOfRangeLevels');
const ERRORS = require ('./ErrorsEnum');

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
    {"transmission-mode": "A"},
    {"transmission-mode": "B"},
    {"transmission-mode": "C"},
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
    {"transmission-mode": "A"},
    {"transmission-mode": "B"},
    {"transmission-mode": "C"},
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
  // "tx-level-max": 200,
  "tx-level-avg": 50,
  "rx-level-min": 1000,
  "rx-level-max": 100000,
  "rx-level-avg": 5000,
  "time-xstates-list": [
    {"transmission-mode": "A"},
    {"transmission-mode": "B"},
    {"transmission-mode": "C"},
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
  "lower-tx-level-limit": 10,   // Lower bound of valid values of the transmit level
  "upper-tx-level-limit": 100,   // Upper bound of valid values of the transmit level
  "lower-rx-level-limit": 1000,   // Lower bound of valid values of the receive level
  "upper-rx-level-limit": 10000,   // Upper bound of valid values of the receive level
}

const wrongParameterStruct1 = {
  "lower-tx-level-limit": 10,   // Lower bound of valid values of the transmit level
  "upper-tx-level-limit": 100,   // Upper bound of valid values of the transmit level
  // "lower-rx-level-limit": 1000,   // Lower bound of valid values of the receive level
  "upper-rx-level-limit": 10000,   // Upper bound of valid values of the receive level
}

const wrongParameterStruct2 = {
  "lower-tx-level-limit": "dsgf",   // Lower bound of valid values of the transmit level
  "upper-tx-level-limit": 100,   // Upper bound of valid values of the transmit level
  "lower-rx-level-limit": 1000,   // Lower bound of valid values of the receive level
  "upper-rx-level-limit": ":",   // Upper bound of valid values of the receive level
}

describe('p1RemoveOutOfRangeLevels', () => {

  test('All levels are ok', () => {
    expect(p1RemoveOutOfRangeLevels({
        "performance-data": performanceStruct1,
        "parameters": parameterStruct1
    }))
    .toMatchObject({
      "performance-data": performanceStruct1
      });
  });

  test('Remove some levels', () => {
    expect(p1RemoveOutOfRangeLevels({
      "performance-data": performanceStruct2,
      "parameters": parameterStruct1
    }))
    .toMatchObject({
      "performance-data": {
        "es": 0,
        "ses": 0,
        "cses": 0,
        "unavailability": 0,
        // "tx-level-min": 5,
        "tx-level-max": 200,
        "tx-level-avg": 50,
        "rx-level-min": 1000,
      //   "rx-level-max": 100000,
        "rx-level-avg": 5000,
        "time-xstates-list": [
          {"transmission-mode": "A"},
          {"transmission-mode": "B"},
          {"transmission-mode": "C"},
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
    });
  });

  test('Missing parameters', () => {
    expect(p1RemoveOutOfRangeLevels({
      "performance-data": performanceStruct2,
    }))
    .toBe(ERRORS.PARAM_NOT_PROVIDED);
  });

  test('Missing parameters (undefined)', () => {
    expect(p1RemoveOutOfRangeLevels({
      "performance-data": performanceStruct2,
      "parameters": undefined
    }))
    .toBe(ERRORS.PARAM_NOT_PROVIDED);
  });

  test('Missing parameters (null)', () => {
    expect(p1RemoveOutOfRangeLevels({
      "performance-data": performanceStruct2,
      "parameters": null
    }))
    .toBe(ERRORS.PARAM_NOT_PROVIDED);
  });

  test('Missing parameters (string)', () => {
    expect(p1RemoveOutOfRangeLevels({
      "performance-data": performanceStruct2,
      "parameters": "ciao"
    }))
    .toBe(ERRORS.PARAM_INVALID);
  });

  test('Missing some property of parameters', () => {
    expect(p1RemoveOutOfRangeLevels({
      "performance-data": performanceStruct2,
      "parameters": wrongParameterStruct1
    }))
    .toBe(ERRORS.PARAM_INVALID);
  });

  test('String on property of parameters', () => {
    expect(p1RemoveOutOfRangeLevels({
      "performance-data": performanceStruct2,
      "parameters": wrongParameterStruct2
    }))
    .toBe(ERRORS.PARAM_INVALID);
  });


   test('Missing performance data', () => {
    expect(p1RemoveOutOfRangeLevels({
      "parameters": parameterStruct1
    }))
    .toBe(ERRORS.PERF_NOT_PROVIDED);
  });


  test('Missing some property of performance', () => {
    expect(p1RemoveOutOfRangeLevels({
      "performance-data": wrongPerformanceStruct1,
      "parameters": parameterStruct1
    }))
    .toBe(ERRORS.PERF_INVALID);
  });

  test('Should NOT mutate original performance data - MUTATION BUG DETECTION', () => {
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

  test('Should delete CORRECT property (not always tx-level-min) - WRONG PROPERTY DELETE BUG DETECTION', () => {
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

  test('Should delete CORRECT rx-level property - WRONG PROPERTY DELETE BUG DETECTION', () => {
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
    expect(result["performance-data"]["rx-level-min"]).toBeUndefined()
  });

// Test end
});



