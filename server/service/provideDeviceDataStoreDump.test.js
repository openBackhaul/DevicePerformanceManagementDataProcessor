jest.mock('../genericFunctions/p1LoadParameters/P1LoadParameters', () => ({
  run: jest.fn()
}));
jest.mock('../genericFunctions/p1ResolveEsAddress/P1ResolveEsAddress', () => ({
  run: jest.fn()
}));
jest.mock('../genericFunctions/p1ReadDataStoreDeviceData/P1ReadDataStoreDeviceData', () => jest.fn());

const p1LoadParameters = require('../genericFunctions/p1LoadParameters/P1LoadParameters');
const p1ResolveEsAddress = require('../genericFunctions/p1ResolveEsAddress/P1ResolveEsAddress');
const p1ReadDataStoreDeviceData = require('../genericFunctions/p1ReadDataStoreDeviceData/P1ReadDataStoreDeviceData');
const service = require('./IndividualServicesService');

describe('provideDeviceDataStoreDump', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    p1LoadParameters.run.mockResolvedValue({
      parameters: {
        'function-name': 'provideDeviceDataStoreDump',
        'sub-function': [{
          'function-name': 'p1ResolveEsAddress',
          parameter: [{ 'parameter-name': 'dataStoreEsClient', value: 'es-ltp' }]
        }]
      },
      configFile: { config: true }
    });
    p1ResolveEsAddress.run.mockResolvedValue({
      esAddress: { url: 'http://data-store:9200', 'index-alias': 'data-store' }
    });
    p1ReadDataStoreDeviceData.mockResolvedValue({
      'device-pm-data': [{ 'batch-timestamp': '2026-09-01T10:00:00Z' }]
    });
  });

  test('loads parameters, resolves DataStore and returns the device dump', async () => {
    const result = await service.provideDeviceDataStoreDump({ 'mount-name': ' device-1 ' });

    expect(p1LoadParameters.run).toHaveBeenCalledWith({
      functionName: 'provideDeviceDataStoreDump'
    });
    expect(p1ResolveEsAddress.run).toHaveBeenCalledWith(expect.objectContaining({
      esName: 'dataStoreEsClient',
      configFile: { config: true }
    }));
    expect(p1ReadDataStoreDeviceData).toHaveBeenCalledWith({
      'data-store-es-client': { url: 'http://data-store:9200', 'index-alias': 'data-store' },
      'mount-name': 'device-1'
    });
    expect(result['device-pm-data']).toHaveLength(1);
  });

  test.each([
    [undefined, 'request body invalid'],
    [{}, 'mountName not provided'],
    [{ 'mount-name': '   ' }, 'mountName invalid']
  ])('rejects invalid input %#', async (body, message) => {
    await expect(service.provideDeviceDataStoreDump(body)).rejects.toMatchObject({
      code: 400,
      message
    });
    expect(p1LoadParameters.run).not.toHaveBeenCalled();
  });

  test('propagates the vendor function error as a service failure', async () => {
    p1ReadDataStoreDeviceData.mockResolvedValue('mountName not found in DataStore');

    await expect(
      service.provideDeviceDataStoreDump({ 'mount-name': 'unknown' })
    ).rejects.toMatchObject({
      code: 500,
      message: 'mountName not found in DataStore'
    });
  });
});
