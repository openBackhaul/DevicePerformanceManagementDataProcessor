const p1CalculateAiCapacity = require('./P1CalculateAiCapacity');
const ERRORS = require('./ErrorsEnum.js');

describe('p1CalculateAiCapacity', () => {

  test('should return "General Error" if input is null', () => {
    expect(p1CalculateAiCapacity(null))
      .toBe(ERRORS.GENERAL_ERROR);
  });

  test('should return "General Error" if input is undefined', () => {
    expect(p1CalculateAiCapacity(undefined))
      .toBe(ERRORS.GENERAL_ERROR);
  });

  test('should return "General Error" if input is empty object', () => {
    expect(p1CalculateAiCapacity({}))
      .toBe(ERRORS.GENERAL_ERROR);
  });

  test('should return error if channel-bandwidth is missing', () => {
    expect(p1CalculateAiCapacity({
      "symbol-rate-reduction-factor": 2,
      "number-of-states-in-modulation": 4,
      "code-rate": 75
    })).toBe(ERRORS.CHANNEL_BW_NOT_PROVIDED);
  });

  test('should return error if channel-bandwidth is invalid', () => {
    expect(p1CalculateAiCapacity({
      "channel-bandwidth": "wrong",
      "symbol-rate-reduction-factor": 2,
      "number-of-states-in-modulation": 4,
      "code-rate": 75
    })).toBe(ERRORS.CHANNEL_BW_INVALID);
  });

  test('should return error if symbol-rate-reduction-factor is missing', () => {
    expect(p1CalculateAiCapacity({
      "channel-bandwidth": 50000,
      "number-of-states-in-modulation": 4,
      "code-rate": 75
    })).toBe(ERRORS.SRRF_NOT_PROVIDED);
  });

  test('should return error if number-of-states-in-modulation is missing', () => {
    expect(p1CalculateAiCapacity({
      "channel-bandwidth": 50000,
      "symbol-rate-reduction-factor": 2,
      "code-rate": 75
    })).toBe(ERRORS.MODSTATES_NOT_PROVIDED);
  });

  test('should return error if code-rate is missing', () => {
    expect(p1CalculateAiCapacity({
      "channel-bandwidth": 50000,
      "symbol-rate-reduction-factor": 2,
      "number-of-states-in-modulation": 4
    })).toBe(ERRORS.CODERATE_NOT_PROVIDED);
  });

  test('should calculate AI capacity correctly', () => {

    const result = p1CalculateAiCapacity({
      "channel-bandwidth": 50000,
      "symbol-rate-reduction-factor": 2,
      "number-of-states-in-modulation": 4,
      "code-rate": 75
    });
    expect(result["air-interface-capacity"]).toBe(32609);
  });

  test('should calculate AI capacity correctly (2)', () => {

    const result = p1CalculateAiCapacity({
      "channel-bandwidth": 50000,
      "symbol-rate-reduction-factor": 1,
      "number-of-states-in-modulation": 4,
      "code-rate": 75
    });
    expect(result["air-interface-capacity"]).toBe(65217);
  });

  test('should not calculate AI capacity correctly - symbol rate must be greater than 0', () => {

    const result = p1CalculateAiCapacity({
      "channel-bandwidth": 50000,
      "symbol-rate-reduction-factor": 0,
      "number-of-states-in-modulation": 4,
      "code-rate": 75
    });
    expect(result).toBe(ERRORS.SRRF_INVALID);
  });

  test('should not calculate AI capacity correctly - properties are strings', () => {

    const result = p1CalculateAiCapacity({
      "channel-bandwidth": "50000",
      "symbol-rate-reduction-factor": "2",
      "number-of-states-in-modulation": "4",
      "code-rate": "75"
    });
    expect(result["air-interface-capacity"]).toBe(undefined);
  });

  test('should calculate AI capacity correctly - code rate 1', () => {

    const result = p1CalculateAiCapacity({
      "channel-bandwidth": 50000,
      "symbol-rate-reduction-factor": 2,
      "number-of-states-in-modulation": 4,
      "code-rate": 1
    });
    expect(result["air-interface-capacity"]).toBe(435);
  });

  test('should calculate AI capacity correctly - code rate 0', () => {

    const result = p1CalculateAiCapacity({
      "channel-bandwidth": 50000,
      "symbol-rate-reduction-factor": 2,
      "number-of-states-in-modulation": 4,
      "code-rate": 0
    });
    expect(result["air-interface-capacity"]).toBe(0);
  });

  test('should calculate AI capacity correctly - code rate 0', () => {

    const result = p1CalculateAiCapacity({
      "channel-bandwidth": 50000,
      "symbol-rate-reduction-factor": 2,
      "number-of-states-in-modulation": 4,
      "code-rate": -1
    });
    expect(result).toBe(ERRORS.CODERATE_INVALID);
  });

  test('shouldnt calculate AI capacity correctly - number of states 0', () => {

    const result = p1CalculateAiCapacity({
      "channel-bandwidth": 50000,
      "symbol-rate-reduction-factor": 2,
      "number-of-states-in-modulation": 0,
      "code-rate": 75
    });
    expect(result).toBe(ERRORS.MODSTATES_INVALID);
  });

  test('should calculate AI capacity correctly - channel bandwith 1', () => {

    const result = p1CalculateAiCapacity({
      "channel-bandwidth": 1,
      "symbol-rate-reduction-factor": 2,
      "number-of-states-in-modulation": 4,
      "code-rate": 75
    });
    expect(result["air-interface-capacity"]).toBe(1);
  });

  test('should calculate AI capacity correctly - channel bandwith 0', () => {

    const result = p1CalculateAiCapacity({
      "channel-bandwidth": 0,
      "symbol-rate-reduction-factor": 2,
      "number-of-states-in-modulation": 4,
      "code-rate": 75
    });
    expect(result["air-interface-capacity"]).toBe(0);
  });


  test('minumum values', () => {
    const result = p1CalculateAiCapacity({
      "channel-bandwidth": 1,
      "symbol-rate-reduction-factor": 1,
      "number-of-states-in-modulation": 1,
      "code-rate": 0
    });
    expect(result["air-interface-capacity"]).toBe(0);
  });

  test('Using huge values', () => {
    const result = p1CalculateAiCapacity({
      "channel-bandwidth": 90000000,
      "symbol-rate-reduction-factor": 99,
      "number-of-states-in-modulation": 1000,
      "code-rate": 99
    });
    expect(result["air-interface-capacity"]).toBe(7799309);
  })

});