const { validateMountName, ERRORS } = require('../../utils/mountNameValidation');

describe('validateMountName', () => {
  test('should return null for valid mount-name', () => {
    expect(validateMountName({ 'mount-name': 'CO18302' })).toBeNull();
  });

  test('should return MOUNTNAME_NOT_PROVIDED when body is null or undefined', () => {
    expect(validateMountName(null)).toBe(ERRORS.MOUNTNAME_NOT_PROVIDED);
    expect(validateMountName(undefined)).toBe(ERRORS.MOUNTNAME_NOT_PROVIDED);
  });

  test('should return MOUNTNAME_NOT_PROVIDED when mount-name is missing', () => {
    expect(validateMountName({})).toBe(ERRORS.MOUNTNAME_NOT_PROVIDED);
    expect(validateMountName({ 'other-field': 'value' })).toBe(ERRORS.MOUNTNAME_NOT_PROVIDED);
  });

  test('should return MOUNTNAME_NOT_PROVIDED when mount-name is null', () => {
    expect(validateMountName({ 'mount-name': null })).toBe(ERRORS.MOUNTNAME_NOT_PROVIDED);
  });

  test('should return MOUNTNAME_NOT_PROVIDED when mount-name is empty string', () => {
    expect(validateMountName({ 'mount-name': '' })).toBe(ERRORS.MOUNTNAME_NOT_PROVIDED);
  });

  test('should return MOUNTNAME_INVALID when mount-name is not a string', () => {
    expect(validateMountName({ 'mount-name': 123 })).toBe(ERRORS.MOUNTNAME_INVALID);
    expect(validateMountName({ 'mount-name': ['array'] })).toBe(ERRORS.MOUNTNAME_INVALID);
    expect(validateMountName({ 'mount-name': { name: 'obj' } })).toBe(ERRORS.MOUNTNAME_INVALID);
  });

  test('should return null for non-empty string mount-name', () => {
    expect(validateMountName({ 'mount-name': 'CO18302' })).toBeNull();
  });
});