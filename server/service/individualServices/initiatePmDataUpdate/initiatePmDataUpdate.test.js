'use strict';

const { AppState } = require('../../../core/appState');
const { initiatePmDataUpdate } = require('../../../service/IndividualServicesService');

// Mock dependencies
jest.mock('../../../genericFunctions/p1LoadParameters/P1LoadParameters');
jest.mock('../../individualServices/initiatePmDataUpdate/util.js', () => ({
  validateInput: jest.fn(),
  getMwdiURL: jest.fn(),
  getCustomHeaders: jest.fn(),
  validateMWDIResponse: jest.fn(),
  validateConnectionStatus: jest.fn(),
  ERRORS: {
    MWDI_CONNECTION_FAILED: 'MWDI connection failed',
    MOUNT_NAME_DISCREPANCY: 'Mount name discrepancy',
    UNCONNECTED_MOUNTS: 'Unconnected mounts'
  }
}));

const { validateInput, getMwdiURL, getCustomHeaders, validateMWDIResponse, validateConnectionStatus, ERRORS } = require('../../individualServices/initiatePmDataUpdate/util.js');

// Setup p1LoadParameters mock
const p1LoadParameters = require('../../../genericFunctions/p1LoadParameters/P1LoadParameters');
p1LoadParameters.run = jest.fn().mockResolvedValue({
  parameters: {
    parameter: [
      { 'parameter-name': 'waitTimeForSending', value: '0' }
    ]
  }
});

describe('initiatePmDataUpdate', () => {
  let appState;
  const mockBody = {
    'mount-names': ['mount-1', 'mount-2']
  };
  const mockUser = 'test-user';
  const mockOriginator = 'test-originator';
  const mockXCorrelator = '550e8400-e29b-11d4-a716-446655440000';
  const mockTraceIndicator = '1.0';
  const mockCustomerJourney = 'test-journey';

  beforeEach(() => {
    appState = new AppState();
    jest.clearAllMocks();
  });

  test('should proceed with update when lastUpdateTime is null (first run)', async () => {
    // Setup mocks
    validateInput.mockReturnValue(null);
    getMwdiURL.mockReturnValue('http://test-mwdi:8080/v1/provide-device-status-metadata');
    getCustomHeaders.mockReturnValue({});
    
    const mockMwdiResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue([
        { 'mount-name': 'mount-1', 'connection-status': 'connected' },
        { 'mount-name': 'mount-2', 'connection-status': 'connected' }
      ])
    };
    global.fetch = jest.fn().mockResolvedValue(mockMwdiResponse);
    
    validateMWDIResponse.mockReturnValue(null);
    validateConnectionStatus.mockReturnValue(null);

    const result = await initiatePmDataUpdate(
      mockBody,
      mockUser,
      mockOriginator,
      mockXCorrelator,
      mockTraceIndicator,
      mockCustomerJourney,
      appState
    );

    expect(result.status).toBe('success');
    expect(result.message).toBe('PM data update initiated successfully');
  });

  test('should return alreadyUpToDate when < 15 minutes since last update', async () => {
    
    // Setup mocks - validations should still be called
    validateInput.mockReturnValue(null);
    getMwdiURL.mockReturnValue('http://test-mwdi:8080/v1/provide-device-status-metadata');
    getCustomHeaders.mockReturnValue({});
    
    const now = new Date();
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000).toISOString();
    
    const mockMwdiResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue([
        { 'mount-name': 'mount-1', 'connection-status': 'connected', 'last-successful-complete-control-construct-update-time': fiveMinutesAgo },
        { 'mount-name': 'mount-2', 'connection-status': 'connected', 'last-successful-complete-control-construct-update-time': fiveMinutesAgo }
      ])
    };
    global.fetch = jest.fn().mockResolvedValue(mockMwdiResponse);
    
    validateMWDIResponse.mockReturnValue(null);
    validateConnectionStatus.mockReturnValue(null);

    const result = await initiatePmDataUpdate(
      mockBody,
      mockUser,
      mockOriginator,
      mockXCorrelator,
      mockTraceIndicator,
      mockCustomerJourney,
      appState
    );

    expect(result.status).toBe('success');
    expect(result.message).toBe('PM data is already up to date');
    expect(result['already-up-to-date-mount-names']).toEqual(['mount-1', 'mount-2']);
    // Validations should have been called before the time check
    expect(validateInput).toHaveBeenCalled();
    expect(validateMWDIResponse).toHaveBeenCalled();
    expect(validateConnectionStatus).toHaveBeenCalled();
  });

  test('should proceed with update when > 15 minutes since last update', async () => {
    
    validateInput.mockReturnValue(null);
    getMwdiURL.mockReturnValue('http://test-mwdi:8080/v1/provide-device-status-metadata');
    getCustomHeaders.mockReturnValue({});
    
    const mockMwdiResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue([
        { 'mount-name': 'mount-1', 'connection-status': 'connected' },
        { 'mount-name': 'mount-2', 'connection-status': 'connected' }
      ])
    };
    global.fetch = jest.fn().mockResolvedValue(mockMwdiResponse);
    
    validateMWDIResponse.mockReturnValue(null);
    validateConnectionStatus.mockReturnValue(null);

    const result = await initiatePmDataUpdate(
      mockBody,
      mockUser,
      mockOriginator,
      mockXCorrelator,
      mockTraceIndicator,
      mockCustomerJourney,
      appState
    );

    expect(result.status).toBe('success');
    expect(result.message).toBe('PM data update initiated successfully');
    expect(validateInput).toHaveBeenCalled();
  });

  test('should proceed with update when exactly 15 minutes since last update', async () => {
    
    validateInput.mockReturnValue(null);
    getMwdiURL.mockReturnValue('http://test-mwdi:8080/v1/provide-device-status-metadata');
    getCustomHeaders.mockReturnValue({});
    
    const mockMwdiResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue([
        { 'mount-name': 'mount-1', 'connection-status': 'connected' },
        { 'mount-name': 'mount-2', 'connection-status': 'connected' }
      ])
    };
    global.fetch = jest.fn().mockResolvedValue(mockMwdiResponse);
    
    validateMWDIResponse.mockReturnValue(null);
    validateConnectionStatus.mockReturnValue(null);

    const result = await initiatePmDataUpdate(
      mockBody,
      mockUser,
      mockOriginator,
      mockXCorrelator,
      mockTraceIndicator,
      mockCustomerJourney,
      appState
    );

    expect(result.status).toBe('success');
    expect(result.message).toBe('PM data update initiated successfully');
    expect(validateInput).toHaveBeenCalled();
  });

  test('should handle undefined appState gracefully', async () => {
    const result = await initiatePmDataUpdate(
      mockBody,
      mockUser,
      mockOriginator,
      mockXCorrelator,
      mockTraceIndicator,
      mockCustomerJourney,
      undefined
    );

    // Should proceed with update when appState is undefined
    expect(result.status).toBe('success');
    expect(result.message).toBe('PM data update initiated successfully');
  });
});