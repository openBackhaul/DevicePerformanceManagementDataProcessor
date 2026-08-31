const IndividualServices = require('../../controllers/IndividualServices');
const IndividualServicesService = require('../../service/IndividualServicesService');

// Mock the service only
jest.mock('../../service/IndividualServicesService');

describe('IndividualServices Controller - initiatePmDataUpdate', () => {
  let mockReq;
  let mockRes;
  let mockAppState;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup request mock
    mockReq = {
      body: {
        'mount-names': ['CO18302', 'CO18303']
      }
    };

    // Setup response mock
    mockRes = {
      writeHead: jest.fn(),
      end: jest.fn()
    };

    // Setup appState mock
    mockAppState = {};

    // Setup service mock
    IndividualServicesService.initiatePmDataUpdate = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('should return 204 with headers on success', async () => {
    const mockResponse = {
      status: 'success',
      message: 'PM data update initiated successfully'
    };

    IndividualServicesService.initiatePmDataUpdate.mockResolvedValue(mockResponse);

    await IndividualServices.initiatePmDataUpdate(
      mockReq,
      mockRes,
      jest.fn(),
      mockReq.body,
      'user',
      'originator',
      'x-correlator-123',
      '1.3.1',
      'customer-journey'
    );

    await new Promise(resolve => setImmediate(resolve));

    // Verify response was written (writeJson internally calls writeHead and end)
    // Since writeJson is not mocked, we verify the actual response object methods were called
    expect(mockRes.writeHead).toHaveBeenCalled();
    expect(mockRes.end).toHaveBeenCalled();
    
    // Verify the status code and headers from writeHead call
    const writeHeadCall = mockRes.writeHead.mock.calls[0];
    expect(writeHeadCall[0]).toBe(204);
    expect(writeHeadCall[1]).toMatchObject({
      'x-correlator': 'x-correlator-123',
      'life-cycle-state': 'OPERATIONAL'
    });
  });

  test('should return 200 with already-up-to-date-mount-names when throttle is active', async () => {
    const mockResponse = {
      status: 'success',
      'already-up-to-date-mount-names': ['CO18302']
    };

    IndividualServicesService.initiatePmDataUpdate.mockResolvedValue(mockResponse);

    await IndividualServices.initiatePmDataUpdate(
      mockReq,
      mockRes,
      jest.fn(),
      mockReq.body,
      'user',
      'originator',
      'x-correlator-123',
      '1.3.1',
      'customer-journey'
    );

    await new Promise(resolve => setImmediate(resolve));

    // Verify response was written
    expect(mockRes.writeHead).toHaveBeenCalled();
    expect(mockRes.end).toHaveBeenCalled();
    
    // Verify the status code and headers
    const writeHeadCall = mockRes.writeHead.mock.calls[0];
    expect(writeHeadCall[0]).toBe(200);
    expect(writeHeadCall[1]).toMatchObject({
      'x-correlator': 'x-correlator-123',
      'life-cycle-state': 'OPERATIONAL'
    });
  });

  test('should return 533 with headers on mount name discrepancy', async () => {
    const mockError = {
      code: 533,
      message: 'Resource unknown. The resource for the connected device does not exist',
      'missing-mount-names': ['CO18303']
    };

    IndividualServicesService.initiatePmDataUpdate.mockRejectedValue(mockError);

    await IndividualServices.initiatePmDataUpdate(
      mockReq,
      mockRes,
      jest.fn(),
      mockReq.body,
      'user',
      'originator',
      'x-correlator-123',
      '1.3.1',
      'customer-journey'
    );

    await new Promise(resolve => setImmediate(resolve));

    // Verify response was written with error status
    expect(mockRes.writeHead).toHaveBeenCalled();
    expect(mockRes.end).toHaveBeenCalled();
    
    // Verify the status code is 533
    const writeHeadCall = mockRes.writeHead.mock.calls[0];
    expect(writeHeadCall[0]).toBe(533);
    expect(writeHeadCall[1]).toMatchObject({
      'x-correlator': 'x-correlator-123',
      'life-cycle-state': 'OPERATIONAL'
    });
  });

  test('should return 532 with headers on unconnected mounts', async () => {
    const mockError = {
      code: 532,
      message: 'Unconnected mounts detected',
      'unconnected-mount-names': ['CO18303']
    };

    IndividualServicesService.initiatePmDataUpdate.mockRejectedValue(mockError);

    await IndividualServices.initiatePmDataUpdate(
      mockReq,
      mockRes,
      jest.fn(),
      mockReq.body,
      'user',
      'originator',
      'x-correlator-123',
      '1.3.1',
      'customer-journey'
    );

    await new Promise(resolve => setImmediate(resolve));

    // Verify response was written with error status
    expect(mockRes.writeHead).toHaveBeenCalled();
    expect(mockRes.end).toHaveBeenCalled();
    
    // Verify the status code is 532
    const writeHeadCall = mockRes.writeHead.mock.calls[0];
    expect(writeHeadCall[0]).toBe(532);
    expect(writeHeadCall[1]).toMatchObject({
      'x-correlator': 'x-correlator-123',
      'life-cycle-state': 'OPERATIONAL'
    });
  });

  test('should return 500 with headers on generic error', async () => {
    const mockError = {
      error: 'Something went wrong'
    };

    IndividualServicesService.initiatePmDataUpdate.mockRejectedValue(mockError);

    await IndividualServices.initiatePmDataUpdate(
      mockReq,
      mockRes,
      jest.fn(),
      mockReq.body,
      'user',
      'originator',
      'x-correlator-123',
      '1.3.1',
      'customer-journey'
    );

    await new Promise(resolve => setImmediate(resolve));

    // Verify response was written with error status
    expect(mockRes.writeHead).toHaveBeenCalled();
    expect(mockRes.end).toHaveBeenCalled();
    
    // Verify the status code is 500
    const writeHeadCall = mockRes.writeHead.mock.calls[0];
    expect(writeHeadCall[0]).toBe(500);
    expect(writeHeadCall[1]).toMatchObject({
      'x-correlator': 'x-correlator-123',
      'life-cycle-state': 'OPERATIONAL'
    });
  });

  test('should include x-correlator from request in response headers', async () => {
    const mockResponse = {
      status: 'success'
    };

    IndividualServicesService.initiatePmDataUpdate.mockResolvedValue(mockResponse);

    const testCorrelator = 'test-correlator-456';
    await IndividualServices.initiatePmDataUpdate(
      mockReq,
      mockRes,
      jest.fn(),
      mockReq.body,
      'user',
      'originator',
      testCorrelator,
      '1.3.1',
      'customer-journey'
    );

    await new Promise(resolve => setImmediate(resolve));

    // Verify x-correlator header matches the one from the request
    const writeHeadCall = mockRes.writeHead.mock.calls[0];
    expect(writeHeadCall[1]['x-correlator']).toBe(testCorrelator);
  });

  test('should calculate exec-time correctly', async () => {
    const mockResponse = {
      status: 'success'
    };

    IndividualServicesService.initiatePmDataUpdate.mockResolvedValue(mockResponse);

    await IndividualServices.initiatePmDataUpdate(
      mockReq,
      mockRes,
      jest.fn(),
      mockReq.body,
      'user',
      'originator',
      'x-correlator-123',
      '1.3.1',
      'customer-journey'
    );

    await new Promise(resolve => setImmediate(resolve));

    // Verify exec-time is a number (time in ms)
    const writeHeadCall = mockRes.writeHead.mock.calls[0];
    const execTime = writeHeadCall[1]['exec-time'];
    expect(typeof execTime).toBe('number');
    expect(execTime).toBeGreaterThanOrEqual(0);
  });
});