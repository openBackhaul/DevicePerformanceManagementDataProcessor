const { validateInput } = require('../../service/individualServices/initiatePmDataUpdate/util');

describe('validateInput', () => {
  test('should return null for valid input', () => {
    const validInput = {
      'mount-names': ['CO18302', 'CO18303']
    };
    expect(validateInput(validInput)).toBeNull();
  });

  test('should return error for null input', () => {
    expect(validateInput(null)).toBe('Input is not a valid object');
  });

  test('should return error for non-object input', () => {
    expect(validateInput('string')).toBe('Input is not a valid object');
    expect(validateInput(123)).toBe('Input is not a valid object');
    expect(validateInput(['array'])).toBe('Input is not a valid object');
  });

  test('should return error when mount-names is missing', () => {
    const input = { 'other-field': 'value' };
    expect(validateInput(input)).toBe('mount-name-list not provided');
  });

  test('should return error when mount-names is not an array', () => {
    const input = { 'mount-names': 'not-an-array' };
    expect(validateInput(input)).toBe('mount-name-list must be a non-empty array of strings');
  });

  test('should return error when mount-names is empty array', () => {
    const input = { 'mount-names': [] };
    expect(validateInput(input)).toBe('mount-name-list is empty');
  });

  test('should return error when mount-names contains non-string', () => {
    const input = { 'mount-names': ['CO18302', 123] };
    expect(validateInput(input)).toBe('mount-name-list must be a non-empty array of strings');
  });

  test('should return error when mount-names contains empty string', () => {
    const input = { 'mount-names': ['CO18302', ''] };
    expect(validateInput(input)).toBe('mount-name-list must be a non-empty array of strings');
  });

  test('should return error when mount-names contains whitespace-only string', () => {
    const input = { 'mount-names': ['CO18302', '   '] };
    expect(validateInput(input)).toBe('mount-name-list must be a non-empty array of strings');
  });

  test('should return null for single mount name', () => {
    const input = { 'mount-names': ['CO18302'] };
    expect(validateInput(input)).toBeNull();
  });

  test('should return null for multiple mount names', () => {
    const input = { 'mount-names': ['CO18302', 'CO18303', 'CO18304'] };
    expect(validateInput(input)).toBeNull();
  });
});