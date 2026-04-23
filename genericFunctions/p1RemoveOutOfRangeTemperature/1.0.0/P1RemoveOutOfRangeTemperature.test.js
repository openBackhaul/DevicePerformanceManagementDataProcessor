const p1RemoveOutOfRangeTemperature = require('./P1RemoveOutOfRangeTemperature');
const ERRORS = require('./ErrorsEnum');
const fs = require('fs');

// Paramenters Struct
const parameterStruct1 = {
  "lower-temperature-limit": "10",
  "upper-temperature-limit": "100",
}

const wrongParameterStruct1 = {
  "lower-temperature-limit": "10",
  // "upper-temperature-limit": "100",
}

const wrongParameterStruct2 = {
  // "lower-temperature-limit": "10",
  "upper-temperature-limit": "100",
}

const wrongParameterStruct3 = {
  "lower-temperature-limit": "xyz",
  "upper-temperature-limit": "100",
}

const wrongParameterStruct4 = {
  "lower-temperature-limit": 10,
  "upper-temperature-limit": 100,
}

const parameterStructWithLowUpperLimit = {
  "lower-temperature-limit": "10",
  "upper-temperature-limit": "50",
}

const parameterStructWithSameValue = {
  "lower-temperature-limit": "70",
  "upper-temperature-limit": "70",
}

describe('p1RemoveOutOfRangeTemperature', () => {
  let dataFile = fs.readFileSync(__dirname + '/datasets/equipmentDataSIAE.json', 'utf8');
  let equipmentData = JSON.parse(dataFile);

  let dataWrongFile = fs.readFileSync(__dirname + '/datasets/equipmentDataSIAEwrong.json', 'utf8');
  let equipmentWrongData = JSON.parse(dataWrongFile);

  describe('Positive Tests @positive', () => {
    test('All levels are ok', () => {
      expect(p1RemoveOutOfRangeTemperature({
          "equipment": equipmentData,
          "parameters": parameterStruct1
      }))
      .toMatchObject({
        "equipment": equipmentData
      });
    });

    test('Should remove out of range temperature (upper limit exceeded)', () => {
      const inputEquipment = [
        {
          "uuid": "LAN-1 SFP",
          "local-id": "LAN-1 SFP",
          "actual-equipment": {
            "local-id": "513250006+",
            "physical-properties": {
              "temperature": "70"
            },
          },
        },
      ];

      const result = p1RemoveOutOfRangeTemperature({
        "equipment": inputEquipment,
        "parameters": parameterStructWithLowUpperLimit
      });

      expect(result["equipment"][0]["actual-equipment"]["physical-properties"]["temperature"]).toBeUndefined();
    });

    test('Keep Temperature structure, Min and Max has the same value', () => {
      const inputEquipment = [
        {
          "uuid": "LAN-1 SFP",
          "local-id": "LAN-1 SFP",
          "actual-equipment": {
            "local-id": "513250006+",
            "physical-properties": {
              "temperature": "70"
            },
          },
        },
      ];

      const result = p1RemoveOutOfRangeTemperature({
        "equipment": inputEquipment,
        "parameters": parameterStructWithSameValue
      });

      expect(result["equipment"][0]["actual-equipment"]["physical-properties"]["temperature"]).toBe("70");
    });

    test('Discard temperature value because is out of range, Min and Max has the same value', () => {
      const inputEquipment = [
        {
          "uuid": "LAN-1 SFP",
          "local-id": "LAN-1 SFP",
          "actual-equipment": {
            "local-id": "513250006+",
            "physical-properties": {
              "temperature": "71"
            },
          },
        },
      ];

      const result = p1RemoveOutOfRangeTemperature({
        "equipment": inputEquipment,
        "parameters": parameterStructWithSameValue
      });

      expect(result["equipment"][0]["actual-equipment"]["physical-properties"]["temperature"]).toBeUndefined();
    });
  });

  describe('Negative Tests @negative', () => {
    test('Equipment not provided', () => {
      expect(p1RemoveOutOfRangeTemperature({
          // "equipment": nothing,
          "parameters": parameterStruct1
      }))
      .toBe(ERRORS.EQUIP_NOT_PROVIDED);
    });

    test('Equipment not provided (undefined)', () => {
      expect(p1RemoveOutOfRangeTemperature({
          "equipment": undefined,
          "parameters": parameterStruct1
      }))
      .toBe(ERRORS.EQUIP_NOT_PROVIDED);
    });

    test('Equipment not provided (null)', () => {
      expect(p1RemoveOutOfRangeTemperature({
          "equipment": null,
          "parameters": parameterStruct1
      }))
      .toBe(ERRORS.EQUIP_NOT_PROVIDED);
    });

    test('Eqp KO', () => {
      expect(p1RemoveOutOfRangeTemperature({
          "equipment": equipmentWrongData,
          "parameters": parameterStruct1
      }))
      .toBe(ERRORS.EQUIP_INVALID);
    });

    test('Missing parameters', () => {
      expect(p1RemoveOutOfRangeTemperature({
        "equipment": equipmentData,
      }))
      .toBe(ERRORS.PARAM_NOT_PROVIDED);
    });

    test('Missing parameters (null)', () => {
      expect(p1RemoveOutOfRangeTemperature({
        "equipment": equipmentData,
        "parameters": null
      }))
      .toBe(ERRORS.PARAM_NOT_PROVIDED);
    });

    test('Missing parameters (undefined)', () => {
      expect(p1RemoveOutOfRangeTemperature({
        "equipment": equipmentData,
        "parameters": undefined
      }))
      .toBe(ERRORS.PARAM_NOT_PROVIDED);
    });

    test('Missing some property of parameters', () => {
      expect(p1RemoveOutOfRangeTemperature({
        "performance-data": equipmentData,
        "parameters": wrongParameterStruct1
      }))
      .toBe(ERRORS.PARAM_INVALID);
    });

    test('Missing some property of parameters (missing lower limit)', () => {
      expect(p1RemoveOutOfRangeTemperature({
        "performance-data": equipmentData,
        "parameters": wrongParameterStruct2
      }))
      .toBe(ERRORS.PARAM_INVALID);
    });

    test('String on property of parameters', () => {
      expect(p1RemoveOutOfRangeTemperature({
        "performance-data": equipmentData,
        "parameters": wrongParameterStruct3
      }))
      .toBe(ERRORS.PARAM_INVALID);
    });

    test('String on property of parameters (numeric values)', () => {
      expect(p1RemoveOutOfRangeTemperature({
        "performance-data": equipmentData,
        "parameters": wrongParameterStruct4
      }))
      .toBe(ERRORS.PARAM_INVALID);
    });
  });

  describe('Edge Cases @edge', () => {
    test('Should NOT mutate original equipment array - MUTATION BUG DETECTION', () => {
      const originalEquipment = [
        {
          "uuid": "LAN-1 SFP",
          "local-id": "LAN-1 SFP",
          "actual-equipment": {
            "local-id": "513250006+",
            "physical-properties": {
              "temperature": "70"
            },
          },
        },
      ];

      p1RemoveOutOfRangeTemperature({
        "equipment": originalEquipment,
        "parameters": parameterStructWithLowUpperLimit
      });

      expect(originalEquipment[0]["actual-equipment"]["physical-properties"]["temperature"]).toBe("70");
    });

    test('Should NOT mutate original equipment when no removal needed - MUTATION BUG DETECTION', () => {
      const originalEquipment = [
        {
          "uuid": "AGS-20 IDU",
          "local-id": "AGS-20 Dual-IF 16xE1 XG",
          "actual-equipment": {
            "local-id": "513250006+",
            "physical-properties": {
              "temperature": "32"
            },
          },
        },
      ];

      p1RemoveOutOfRangeTemperature({
        "equipment": originalEquipment,
        "parameters": parameterStruct1
      });

      expect(originalEquipment[0]["actual-equipment"]["physical-properties"]["temperature"]).toBe("32");
    });
  });
});
