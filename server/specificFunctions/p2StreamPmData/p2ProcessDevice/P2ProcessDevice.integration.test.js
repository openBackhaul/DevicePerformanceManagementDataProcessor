const p2ProcessDevice = require('./P2ProcessDevice');

describe('P2ProcessDevice vendor-function integration', () => {
  test('uses the production p1LoadOffsetsAndStatusData implementation by default', async () => {
    const dataStoreClient = {
      get: jest.fn().mockResolvedValue({
        _source: {
          'processing-data': {
            offsets: [{ value: 7 }],
            'status-data': [{ status: 'ok' }]
          }
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
    const queueKafkaOutbound = jest.fn().mockResolvedValue({
      queuedResultList: [{ status: 'QUEUED' }]
    });
    const p1TransmittingKafka = jest.fn().mockResolvedValue({});
    const dataStoreEsClient = {
      url: 'http://data-store:9200',
      client: dataStoreClient
    };

    const result = await p2ProcessDevice.run({
      parameters: {},
      configFile: {},
      mountName: 'device-1',
      mwdiReplicaEsClient: {},
      dataStoreEsClient,
      kafkaConsumerTypes: 'APT,MYCOM,NETEXPLORER,IVERITAS,DATAQUALITYPROVIDER',
      dependencies: {
        p2LoadRawCc,
        p2CreateResultCc,
        p1FormattingOutputApt: jest.fn().mockResolvedValue({
          'format-name': 'apt-output-format',
          'output-format': { format: 'apt', uuid: 'device-1' }
        }),
        p2FormattingOutputOnf: jest.fn().mockResolvedValue({
          'onf-output-format': [
            {
              'format-name': 'mycom-output-format',
              'output-format': { uuid: 'device-1' }
            },
            {
              'format-name': 'netexplorer-output-format',
              'output-format': { uuid: 'device-1' }
            }
          ]
        }),
        queueKafkaOutbound,
        p1TransmittingKafka,
        p2Storing: jest.fn().mockResolvedValue({})
      }
    });

    expect(dataStoreClient.get).toHaveBeenCalledWith({
      index: 'data-store',
      id: 'device-1'
    });
    expect(p2LoadRawCc).toHaveBeenCalledWith(expect.objectContaining({
      offsets: [{ value: 7 }]
    }));
    expect(p2CreateResultCc).toHaveBeenCalledWith(expect.objectContaining({
      'status-data': [{ status: 'ok' }]
    }));
    expect(queueKafkaOutbound).toHaveBeenCalledWith({
      dataStoreEsClient,
      logger: undefined,
      outputs: [
        {
          targetConsumer: 'APT',
          messageType: 'PERFORMANCE_OUTPUT',
          mountName: 'device-1',
          payloadVersion: '1.1',
          payload: { format: 'apt', uuid: 'device-1' }
        },
        {
          targetConsumer: 'MYCOM',
          messageType: 'PERFORMANCE_OUTPUT',
          mountName: 'device-1',
          payloadVersion: '1.1',
          payload: { uuid: 'device-1' }
        },
        {
          targetConsumer: 'NETEXPLORER',
          messageType: 'PERFORMANCE_OUTPUT',
          mountName: 'device-1',
          payloadVersion: '1.1',
          payload: { uuid: 'device-1' }
        }
      ]
    });
    expect(p1TransmittingKafka).not.toHaveBeenCalled();
    expect(result).toEqual({
      'device-pm-data-quality': { 'mount-name': 'device-1' }
    });
  });

});
