const IndividualServices = require('../../service/IndividualServicesService');

// Mock dependencies
jest.mock('../../genericFunctions/p1LoadParameters/P1LoadParameters');
jest.mock('../../utils/functionTree');

describe('IndividualServicesService - initiatePmDataUpdate', () => {
  let mockAppState;
  let mockFetch;
  let mockP1LoadParameters;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup appState mock
    mockAppState = {};

    // Setup fetch mock
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Setup p1LoadParameters mock
    mockP1LoadParameters = require('../../genericFunctions/p1LoadParameters/P1LoadParameters');
    mockP1LoadParameters.run = jest.fn().mockResolvedValue({
      parameters: {
        parameter: [
          { 'parameter-name': 'waitTimeForSending', value: '0' }
        ]
      }
    });

    // Setup functionTree mocks
    const functionTree = require('../../utils/functionTree');
    functionTree.getParamFromFunction = jest.fn().mockReturnValue(0);
    functionTree.findFunctionNode = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('all devices outdated -> should return 204', async () => {
    const body = {
      'mount-names': ['CO18302', 'CO18303']
    };

    const mwdiResponse = [
      {
        'mount-name': 'CO18302',
        'connection-status': 'connected',
        'last-successful-complete-control-construct-update-time': '2026-08-06T08:00:00.000Z' // 2 hours ago
      },
      {
        'mount-name': 'CO18303',
        'connection-status': 'connected',
        'last-successful-complete-control-construct-update-time': '2026-08-06T08:30:00.000Z' // 1.5 hours ago
      }
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mwdiResponse
    });

    const result = await IndividualServices.initiatePmDataUpdate(
      body,
      'user',
      'originator',
      'x-correlator',
      'trace-indicator',
      'customer-journey'
    );

    expect(result).toHaveProperty('status', 'success');
    expect(result).not.toHaveProperty('already-up-to-date-mount-names');
  });

  test('one device up-to-date -> should return 200 with already-up-to-date-mount-names', async () => {
    const body = {
      'mount-names': ['CO18302', 'CO18303']
    };

    const now = new Date();
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000).toISOString();
    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();

    const mwdiResponse = [
      {
        'mount-name': 'CO18302',
        'connection-status': 'connected',
        'last-successful-complete-control-construct-update-time': fiveMinutesAgo // up-to-date
      },
      {
        'mount-name': 'CO18303',
        'connection-status': 'connected',
        'last-successful-complete-control-construct-update-time': twoHoursAgo // outdated
      }
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mwdiResponse
    });

    const result = await IndividualServices.initiatePmDataUpdate(
      body,
      'user',
      'originator',
      'x-correlator',
      'trace-indicator',
      'customer-journey'
    );

    expect(result).toHaveProperty('already-up-to-date-mount-names');
    expect(result['already-up-to-date-mount-names']).toEqual(['CO18302']);
    expect(result).toHaveProperty('status', 'success');
  });

  test('all devices up-to-date -> should return 200 with all mount names', async () => {
    const body = {
      'mount-names': ['CO18302', 'CO18303']
    };

    const now = new Date();
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000).toISOString();

    const mwdiResponse = [
      {
        'mount-name': 'CO18302',
        'connection-status': 'connected',
        'last-successful-complete-control-construct-update-time': fiveMinutesAgo
      },
      {
        'mount-name': 'CO18303',
        'connection-status': 'connected',
        'last-successful-complete-control-construct-update-time': fiveMinutesAgo
      }
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mwdiResponse
    });

    const result = await IndividualServices.initiatePmDataUpdate(
      body,
      'user',
      'originator',
      'x-correlator',
      'trace-indicator',
      'customer-journey'
    );

    expect(result).toHaveProperty('already-up-to-date-mount-names');
    expect(result['already-up-to-date-mount-names']).toHaveLength(2);
    expect(result['already-up-to-date-mount-names']).toContain('CO18302');
    expect(result['already-up-to-date-mount-names']).toContain('CO18303');
  });

  test('missing device -> should throw error 533', async () => {
    const body = {
      'mount-names': ['CO18302', 'CO18303']
    };

    const mwdiResponse = [
      {
        'mount-name': 'CO18302',
        'connection-status': 'connected'
      }
      // CO18303 is missing
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mwdiResponse
    });

    await expect(
      IndividualServices.initiatePmDataUpdate(
        body,
        'user',
        'originator',
        'x-correlator',
        'trace-indicator',
        'customer-journey'
      )
    ).rejects.toMatchObject({
      code: 533,
      'missing-mount-names': ['CO18303']
    });
  });

  test('disconnected device -> should throw error 532', async () => {
    const body = {
      'mount-names': ['CO18302', 'CO18303']
    };

    const mwdiResponse = [
      {
        'mount-name': 'CO18302',
        'connection-status': 'connected'
      },
      {
        'mount-name': 'CO18303',
        'connection-status': 'disconnected'
      }
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mwdiResponse
    });

    await expect(
      IndividualServices.initiatePmDataUpdate(
        body,
        'user',
        'originator',
        'x-correlator',
        'trace-indicator',
        'customer-journey'
      )
    ).rejects.toMatchObject({
      code: 532,
      'unconnected-mount-names': ['CO18303']
    });
  });

  test('devices with no previous update time -> should be considered outdated', async () => {
    const body = {
      'mount-names': ['CO18302']
    };

    const mwdiResponse = [
      {
        'mount-name': 'CO18302',
        'connection-status': 'connected',
        'last-successful-complete-control-construct-update-time': null
      }
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mwdiResponse
    });

    const result = await IndividualServices.initiatePmDataUpdate(
      body,
      'user',
      'originator',
      'x-correlator',
      'trace-indicator',
      'customer-journey'
    );

    expect(result).toHaveProperty('status', 'success');
    expect(result).not.toHaveProperty('already-up-to-date-mount-names');
  });
});
