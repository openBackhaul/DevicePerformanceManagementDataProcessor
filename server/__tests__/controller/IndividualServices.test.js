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
describe('IndividualServices Controller - provideDeviceDataStoreDump', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup request mock
    mockReq = {
      body: {
        'mount-name': '100250001'
      }
    };

    // Setup response mock
    mockRes = {
      writeHead: jest.fn(),
      end: jest.fn()
    };

    // Setup service mock
    IndividualServicesService.provideDeviceDataStoreDump = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('should return 200 with device-pm-data and headers on success', async () => {
    const mockResponse = {
      'device-pm-data': [
        {
          'batch-timestamp': '2026-07-07T10:00:00.000Z',
          'result-cc': {
            'control-construct': []
          }
        }
      ]
    };

    IndividualServicesService.provideDeviceDataStoreDump.mockResolvedValue(mockResponse);

    await IndividualServices.provideDeviceDataStoreDump(
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
      'life-cycle-state': 'EXPERIMENTAL',
      'exec-time': expect.any(Number),
      'backend-time': expect.any(Number)
    });

    // Verify the response body contains device-pm-data
    const responseBody = JSON.parse(mockRes.end.mock.calls[0][0]);
    expect(responseBody['device-pm-data']).toHaveLength(1);
  });

  test('should return 400 with headers when the service reports a bad request', async () => {
    const mockError = {
      code: 400,
      message: 'mountName not provided'
    };

    IndividualServicesService.provideDeviceDataStoreDump.mockRejectedValue(mockError);

    await IndividualServices.provideDeviceDataStoreDump(
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

    const writeHeadCall = mockRes.writeHead.mock.calls[0];
    expect(writeHeadCall[0]).toBe(400);
    expect(writeHeadCall[1]).toMatchObject({
      'x-correlator': 'x-correlator-123',
      'life-cycle-state': 'EXPERIMENTAL'
    });

    const responseBody = JSON.parse(mockRes.end.mock.calls[0][0]);
    expect(responseBody.code).toBe(400);
    expect(responseBody.message).toBe('mountName not provided');
  });
test('should return 404 with headers when the mount name is not found in the DataStore', async () => {
    const mockError = {
      code: 404,
      message: 'mountName not found in DataStore'
    };

    IndividualServicesService.provideDeviceDataStoreDump.mockRejectedValue(mockError);

    await IndividualServices.provideDeviceDataStoreDump(
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

    const writeHeadCall = mockRes.writeHead.mock.calls[0];
    expect(writeHeadCall[0]).toBe(404);
    expect(writeHeadCall[1]).toMatchObject({
      'x-correlator': 'x-correlator-123',
      'life-cycle-state': 'EXPERIMENTAL'
    });

    const responseBody = JSON.parse(mockRes.end.mock.calls[0][0]);
    expect(responseBody.code).toBe(404);
    expect(responseBody.message).toBe('mountName not found in DataStore');
  });

  test('should return 500 with headers when reading from ElasticSearch fails', async () => {
    const mockError = {
      code: 500,
      message: 'ElasticSearch read error'
    };

    IndividualServicesService.provideDeviceDataStoreDump.mockRejectedValue(mockError);

    await IndividualServices.provideDeviceDataStoreDump(
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

    const writeHeadCall = mockRes.writeHead.mock.calls[0];
    expect(writeHeadCall[0]).toBe(500);
    expect(writeHeadCall[1]).toMatchObject({
      'x-correlator': 'x-correlator-123',
      'life-cycle-state': 'EXPERIMENTAL'
    });

    const responseBody = JSON.parse(mockRes.end.mock.calls[0][0]);
    expect(responseBody.code).toBe(500);
    expect(responseBody.message).toBe('ElasticSearch read error');
  });

  test('should return 500 when the service rejects without a valid code', async () => {
    const mockError = {
      error: 'Something went wrong'
    };

    IndividualServicesService.provideDeviceDataStoreDump.mockRejectedValue(mockError);

    await IndividualServices.provideDeviceDataStoreDump(
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

    const writeHeadCall = mockRes.writeHead.mock.calls[0];
    expect(writeHeadCall[0]).toBe(500);
    expect(writeHeadCall[1]).toMatchObject({
      'x-correlator': 'x-correlator-123',
      'life-cycle-state': 'EXPERIMENTAL'
    });
  });

  test('should calculate exec-time correctly on success', async () => {
    const mockResponse = {
      'device-pm-data': []
    };

    IndividualServicesService.provideDeviceDataStoreDump.mockResolvedValue(mockResponse);

    await IndividualServices.provideDeviceDataStoreDump(
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

    const writeHeadCall = mockRes.writeHead.mock.calls[0];
    const execTime = writeHeadCall[1]['exec-time'];
    expect(typeof execTime).toBe('number');
    expect(execTime).toBeGreaterThanOrEqual(0);
  });
});