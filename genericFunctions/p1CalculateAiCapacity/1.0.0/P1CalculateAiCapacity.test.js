const p1CalculateAiCapacity = require('./P1CalculateAiCapacity');
const ERRORS = require('./ErrorsEnum.js');

describe('p1CalculateAiCapacity', () => {
  
  test('should return error if input is missing', () => {
    expect(p1CalculateAiCapacity(null))
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

});