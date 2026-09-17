const {
  validateInput,
  mapReadDataStoreDeviceDataError,
  buildSuccessResponse,
  ERRORS
} = require('../../service/individualServices/provideDeviceDataStoreDump/util');

describe('provideDeviceDataStoreDump util', () => {
  describe('validateInput', () => {
    test('should return null for a valid mount-name', () => {
      expect(validateInput({ 'mount-name': 'CO18302' })).toBeNull();
    });

    test('should return MOUNTNAME_NOT_PROVIDED for null or undefined body', () => {
      expect(validateInput(null)).toBe(ERRORS.MOUNTNAME_NOT_PROVIDED);
      expect(validateInput(undefined)).toBe(ERRORS.MOUNTNAME_NOT_PROVIDED);
    });

    test('should return MOUNTNAME_NOT_PROVIDED for non-object body', () => {
      expect(validateInput('string')).toBe(ERRORS.MOUNTNAME_NOT_PROVIDED);
      expect(validateInput(123)).toBe(ERRORS.MOUNTNAME_NOT_PROVIDED);
      expect(validateInput(['array'])).toBe(ERRORS.MOUNTNAME_NOT_PROVIDED);
    });

    test('should return MOUNTNAME_NOT_PROVIDED when mount-name is missing', () => {
      expect(validateInput({})).toBe(ERRORS.MOUNTNAME_NOT_PROVIDED);
      expect(validateInput({ 'other-field': 'value' })).toBe(ERRORS.MOUNTNAME_NOT_PROVIDED);
    });

    test('should return MOUNTNAME_NOT_PROVIDED when mount-name is empty', () => {
      expect(validateInput({ 'mount-name': '' })).toBe(ERRORS.MOUNTNAME_NOT_PROVIDED);
    });

    test('should return MOUNTNAME_INVALID when mount-name is not a string', () => {
      expect(validateInput({ 'mount-name': 123 })).toBe(ERRORS.MOUNTNAME_INVALID);
      expect(validateInput({ 'mount-name': ['array'] })).toBe(ERRORS.MOUNTNAME_INVALID);
    });
  });

  describe('mapReadDataStoreDeviceDataError', () => {
    test('should map MOUNTNAME_NOT_FOUND to 404', () => {
      expect(mapReadDataStoreDeviceDataError(ERRORS.MOUNTNAME_NOT_FOUND)).toEqual({
        code: 404,
        message: ERRORS.MOUNTNAME_NOT_FOUND
      });
    });

    test('should map invalid input errors to 400', () => {
      expect(mapReadDataStoreDeviceDataError(ERRORS.MOUNTNAME_NOT_PROVIDED)).toEqual({
        code: 400,
        message: ERRORS.MOUNTNAME_NOT_PROVIDED
      });
      expect(mapReadDataStoreDeviceDataError(ERRORS.MOUNTNAME_INVALID)).toEqual({
        code: 400,
        message: ERRORS.MOUNTNAME_INVALID
      });
      expect(mapReadDataStoreDeviceDataError(ERRORS.DATA_STORE_NOT_PROVIDED)).toEqual({
        code: 400,
        message: ERRORS.DATA_STORE_NOT_PROVIDED
      });
      expect(mapReadDataStoreDeviceDataError(ERRORS.DATA_STORE_INVALID)).toEqual({
        code: 400,
        message: ERRORS.DATA_STORE_INVALID
      });
    });

    test('should map unknown errors to 500', () => {
      expect(mapReadDataStoreDeviceDataError('boom')).toEqual({
        code: 500,
        message: 'boom'
      });
      expect(mapReadDataStoreDeviceDataError(ERRORS.ELK_READ_ERROR)).toEqual({
        code: 500,
        message: ERRORS.ELK_READ_ERROR
      });
    });
  });

  describe('buildSuccessResponse', () => {
    test('should build the success response with the device-pm-data array', () => {
      const devicePmData = [{ 'batch-timestamp': '2026-07-07T10:00:00.000Z' }];
      expect(buildSuccessResponse({ 'device-pm-data': devicePmData })).toEqual({
        'device-pm-data': devicePmData
      });
    });

    test('should throw when device-pm-data is not an array', () => {
      expect(() => buildSuccessResponse({})).toThrow('Invalid p1ReadDataStoreDeviceData result');
      expect(() => buildSuccessResponse(null)).toThrow('Invalid p1ReadDataStoreDeviceData result');
    });
  });
});