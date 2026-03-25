const p1RemoveOutOfRangeTemperature = require('./P1RemoveOutOfRangeTemperature');
const ERRORS = require('./ErrorsEnum');

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
        "temperature": "70"
      },
    }
  },
];

const wrongEquipmentDataSIAE = [
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
        "temperature": 2
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

  test('All levels are ok', () => {
    expect(p1RemoveOutOfRangeTemperature({
        "equipment": equipmentDataSIAE,
        "parameters": parameterStruct1
    }))
    .toMatchObject({
      "equipment": equipmentDataSIAE
    });
  });

  test('Equipment not provided', () => {
    expect(p1RemoveOutOfRangeTemperature({
        // "equipment": wrongEquipmentDataSIAE,
        "parameters": parameterStruct1
    }))
    .toBe(ERRORS.EQUIP_NOT_PROVIDED);
  });

  test('Equipment not provided2', () => {
    expect(p1RemoveOutOfRangeTemperature({
        "equipment": undefined,
        "parameters": parameterStruct1
    }))
    .toBe(ERRORS.EQUIP_NOT_PROVIDED);
  });

  test('Equipment not provided3', () => {
    expect(p1RemoveOutOfRangeTemperature({
        "equipment": null,
        "parameters": parameterStruct1
    }))
    .toBe(ERRORS.EQUIP_NOT_PROVIDED);
  });

  test('Eqp KO', () => {
    expect(p1RemoveOutOfRangeTemperature({
        "equipment": wrongEquipmentDataSIAE,
        "parameters": parameterStruct1
    }))
    .toBe(ERRORS.EQUIP_INVALID);
  });

  test('Missing parameters', () => {
    expect(p1RemoveOutOfRangeTemperature({
      "equipment": equipmentDataSIAE,
    }))
    .toBe(ERRORS.PARAM_NOT_PROVIDED);
  });

  test('Missing parameters2', () => {
    expect(p1RemoveOutOfRangeTemperature({
      "equipment": equipmentDataSIAE,
      "parameters": null
    }))
    .toBe(ERRORS.PARAM_NOT_PROVIDED);
  });

  test('Missing parameters3', () => {
    expect(p1RemoveOutOfRangeTemperature({
      "equipment": equipmentDataSIAE,
      "parameters": undefined
    }))
    .toBe(ERRORS.PARAM_NOT_PROVIDED);
  });

  test('Missing some property of parameters', () => {
    expect(p1RemoveOutOfRangeTemperature({
      "performance-data": equipmentDataSIAE,
      "parameters": wrongParameterStruct1
    }))
    .toBe(ERRORS.PARAM_INVALID);
  });

  test('Missing some property of parameters', () => {
    expect(p1RemoveOutOfRangeTemperature({
      "performance-data": equipmentDataSIAE,
      "parameters": wrongParameterStruct2
    }))
    .toBe(ERRORS.PARAM_INVALID);
  });

  test('String on property of parameters', () => {
    expect(p1RemoveOutOfRangeTemperature({
      "performance-data": equipmentDataSIAE,
      "parameters": wrongParameterStruct3
    }))
    .toBe(ERRORS.PARAM_INVALID);
  });

  test('String on property of parameters 2', () => {
    expect(p1RemoveOutOfRangeTemperature({
      "performance-data": equipmentDataSIAE,
      "parameters": wrongParameterStruct4
    }))
    .toBe(ERRORS.PARAM_INVALID);
  });

// Test end
});



