const p1RemoveOutOfRangeTemperature = require('./P1RemoveOutOfRangeTemperature');

const equipmentDataSIAE = [
  {
    "uuid": "AGS-20 IDU",
    "is-field-replaceable": false,
    "local-id": "AGS-20 Dual-IF 16xE1 XG",
    "lifecycle-state": "core-model-1-4:LIFECYCLE_STATE_INSTALLED",
    "operational-state": "core-model-1-4:OPERATIONAL_STATE_ENABLED",
    "actual-equipment": {
      "local-id": "513250006+",
      "lifecycle-state": "core-model-1-4:LIFECYCLE_STATE_INSTALLED",
      "operational-state": "core-model-1-4:OPERATIONAL_STATE_ENABLED",
      "physical-properties": {
        "temperature": "32"
      },
    },
  },
  {
    "uuid": "LAN-1 SFP",
    "is-field-replaceable": true,
    "local-id": "LAN-1 SFP",
    "lifecycle-state": "core-model-1-4:LIFECYCLE_STATE_INSTALLED",
    "operational-state": "core-model-1-4:OPERATIONAL_STATE_ENABLED",
    "actual-equipment": {
      "local-id": "513250006+",
      "lifecycle-state": "core-model-1-4:LIFECYCLE_STATE_INSTALLED",
      "operational-state": "core-model-1-4:OPERATIONAL_STATE_ENABLED",
      "physical-properties": {
        "temperature": "38"
      },
    }
  },
];

// Paramenters Struct
const parameterStruct1 = {
  "lower-temperature-limit": 10,
  "upper-temperature-limit": 100,
}

const wrongParameterStruct1 = {
  "lower-temperature-limit": 10,
  // "upper-temperature-limit": 100,
}

const wrongParameterStruct2 = {
  // "lower-temperature-limit": 10,
  "upper-temperature-limit": 100,
}

const wrongParameterStruct3 = {
  "lower-temperature-limit": "xyz",
  "upper-temperature-limit": 100,
}

const wrongParameterStruct4 = {
  "lower-temperature-limit": 10,
  "upper-temperature-limit": "100",
}

describe('p1RemoveOutOfRangeTemperature', () => {

  // test('All levels are ok', () => {
  //   expect(p1RemoveOutOfRangeTemperature({
  //       "equipment": equipmentDataSIAE,
  //       "parameters": parameterStruct1
  //   }))
  //   .toMatchObject({
  //     "performance-data": equipmentDataSIAE
  //     });
  // });

  // test('Remove some levels', () => {
  //   expect(p1RemoveOutOfRangeTemperature({
  //     "performance-data": performanceStruct2,
  //     "parameters": parameterStruct1
  //   }))
  //   .toMatchObject({
  //     "performance-data": {
  //       "es": 0,
  //       "ses": 0,
  //       "cses": 0,
  //       "unavailability": 0,
  //       // "tx-level-min": 5,
  //       "tx-level-max": 200,
  //       "tx-level-avg": 50,
  //       "rx-level-min": 1000,
  //     //   "rx-level-max": 100000,
  //       "rx-level-avg": 5000,
  //       "time-xstates-list": [
  //         {"transmission-mode": "A"},
  //         {"transmission-mode": "B"},
  //         {"transmission-mode": "C"},
  //       ],
  //       "interval-capacity": 0,
  //       "snir-min": 0,
  //       "snir-max": 0,
  //       "snir-avg": 0,
  //       "xpd-min": 0,
  //       "xpd-max": 0,
  //       "xpd-avg": 0,
  //       "defect-blocks-sum": 0,
  //       "time-period": 100
  //     }
  //   });
  // });


  test('Missing parameters', () => {
    expect(p1RemoveOutOfRangeTemperature({
      "equipment": equipmentDataSIAE,
    }))
    .toBe("parameters not provided");
  });

  test('Missing some property of parameters', () => {
    expect(p1RemoveOutOfRangeTemperature({
      "performance-data": equipmentDataSIAE,
      "parameters": wrongParameterStruct1
    }))
    .toBe("parameters invalid");
  });

  test('Missing some property of parameters', () => {
    expect(p1RemoveOutOfRangeTemperature({
      "performance-data": equipmentDataSIAE,
      "parameters": wrongParameterStruct2
    }))
    .toBe("parameters invalid");
  });

  test('String on property of parameters', () => {
    expect(p1RemoveOutOfRangeTemperature({
      "performance-data": equipmentDataSIAE,
      "parameters": wrongParameterStruct3
    }))
    .toBe("parameters invalid");
  });

  test('String on property of parameters 2', () => {
    expect(p1RemoveOutOfRangeTemperature({
      "performance-data": equipmentDataSIAE,
      "parameters": wrongParameterStruct4
    }))
    .toBe("parameters invalid");
  });

  //  test('Missing performance data', () => {
  //   expect(p1RemoveOutOfRangeLevels({
  //     "parameters": parameterStruct1
  //   }))
  //   .toBe("performanceData not provided");
  // });


  // test('Missing some property of performance', () => {
  //   expect(p1RemoveOutOfRangeLevels({
  //     "equipment": wrongPerformanceStruct1,
  //     "parameters": parameterStruct1
  //   }))
  //   .toBe("performanceData invalid");
  // });
// Test end
});



