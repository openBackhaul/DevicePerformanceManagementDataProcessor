const { validateMWDIResponse } = require('../../service/individualServices/initiatePmDataUpdate/util');

describe('validateMWDIResponse', () => {
  test('should return null for valid direct array response', () => {
    const validResponse = [
      {
        'mount-name': 'CO18302',
        'connection-status': 'connected'
      },
      {
        'mount-name': 'CO18303',
        'connection-status': 'connected'
      }
    ];
    expect(validateMWDIResponse(validResponse)).toBeNull();
  });

  test('should return null for valid wrapped response', () => {
    const validResponse = {
      'device-status-metadata': [
        {
          'mount-name': 'CO18302',
          'connection-status': 'connected'
        }
      ]
    };
    expect(validateMWDIResponse(validResponse)).toBeNull();
  });

  test('should return error for null response', () => {
    expect(validateMWDIResponse(null)).toBe('Invalid response from MWDI service');
  });

  test('should return error for non-object response', () => {
    expect(validateMWDIResponse('string')).toBe('Invalid response from MWDI service');
    expect(validateMWDIResponse(123)).toBe('Invalid response from MWDI service');
  });

  test('should return error for object without device-status-metadata', () => {
    const invalidResponse = { 'other-field': 'value' };
    expect(validateMWDIResponse(invalidResponse)).toBe('Invalid response from MWDI service');
  });

  test('should return error when device-status-metadata is not an array', () => {
    const invalidResponse = {
      'device-status-metadata': 'not-an-array'
    };
    expect(validateMWDIResponse(invalidResponse)).toBe('Invalid response from MWDI service');
  });

  test('should return error when array item is not an object', () => {
    const invalidResponse = {
      'device-status-metadata': [
        'not-an-object'
      ]
    };
    expect(validateMWDIResponse(invalidResponse)).toBe('Invalid response from MWDI service');
  });

  test('should return error when mount-name is missing', () => {
    const invalidResponse = {
      'device-status-metadata': [
        {
          'connection-status': 'connected'
        }
      ]
    };
    expect(validateMWDIResponse(invalidResponse)).toBe('Invalid response from MWDI service');
  });

  test('should return error when connection-status is missing', () => {
    const invalidResponse = {
      'device-status-metadata': [
        {
          'mount-name': 'CO18302'
        }
      ]
    };
    expect(validateMWDIResponse(invalidResponse)).toBe('Invalid response from MWDI service');
  });

  test('should return null for empty array', () => {
    const validResponse = [];
    expect(validateMWDIResponse(validResponse)).toBeNull();
  });

  test('should return null for empty wrapped array', () => {
    const validResponse = {
      'device-status-metadata': []
    };
    expect(validateMWDIResponse(validResponse)).toBeNull();
  });
});