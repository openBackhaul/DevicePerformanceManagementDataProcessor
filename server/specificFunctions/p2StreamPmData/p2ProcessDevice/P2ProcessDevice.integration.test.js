const p2ProcessDevice = require('./P2ProcessDevice');

describe('P2ProcessDevice vendor-function integration', () => {
  test('uses the production p1LoadOffsetsAndStatusData implementation by default', async () => {
    const dataStoreClient = {
      get: jest.fn().mockResolvedValue({
        _source: {
          offsets: [{ value: 7 }],
          'status-data': [{ status: 'ok' }]
        }
      })
    };
    const p2LoadRawCc = jest.fn().mockResolvedValue({
      'raw-cc': { uuid: 'device-1' },
      offsets: [{ value: 8 }],
      'device-pm-data-quality': { 'mount-name': 'device-1' }
    });
    const p2CreateResultCc = jest.fn().mockResolvedValue({
      'result-cc': { uuid: 'device-1' },
      'status-data': [{ status: 'updated' }]
    });

    const result = await p2ProcessDevice.run({
      parameters: {},
      configFile: {},
      mountName: 'device-1',
      mwdiReplicaEsClient: {},
      dataStoreEsClient: {
        url: 'http://data-store:9200',
        client: dataStoreClient
      },
      dependencies: {
        p2LoadRawCc,
        p2CreateResultCc,
        p1FormattingOutputApt: jest.fn().mockResolvedValue({}),
        p2FormattingOutputOnf: jest.fn().mockResolvedValue({
          'onf-output-format': [{
            'format-name': 'onf-output-format',
            'output-format': { uuid: 'device-1' }
          }]
        }),
        p1TransmittingKafka: jest.fn().mockResolvedValue({}),
        p2Storing: jest.fn().mockResolvedValue({})
      }
    });

    expect(dataStoreClient.get).toHaveBeenCalledWith({
      index: 'data-store',
      id: 'device=device-1/processing-data'
    });
    expect(p2LoadRawCc).toHaveBeenCalledWith(expect.objectContaining({
      offsets: [{ value: 7 }]
    }));
    expect(p2CreateResultCc).toHaveBeenCalledWith(expect.objectContaining({
      'status-data': [{ status: 'ok' }]
    }));
    expect(result).toEqual({
      'device-pm-data-quality': { 'mount-name': 'device-1' }
    });
  });
});
