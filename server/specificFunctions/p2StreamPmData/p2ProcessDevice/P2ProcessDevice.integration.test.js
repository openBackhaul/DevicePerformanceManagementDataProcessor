const mockP2LoadRawCcRun = jest.fn();
const mockP2CreateResultCcRun = jest.fn();
const mockP1FormattingOutputApt = jest.fn();
const mockP2FormattingOutputOnf = jest.fn();
const mockQueueKafkaOutboundRun = jest.fn();
const mockP2StoringRun = jest.fn();

jest.mock('./p2LoadRawCc/P2LoadRawCc', () => ({ run: mockP2LoadRawCcRun }));
jest.mock('./p2CreateResultCc/P2CreateResultCc', () => ({ run: mockP2CreateResultCcRun }));
jest.mock(
  '../../p1StreamPmData/p1ProcessDevice/p1FormattingOutputApt/P1FormattingOutputApt',
  () => mockP1FormattingOutputApt
);
jest.mock('./p2FormattingOutputOnf/P2FormattingOutputOnf', () => mockP2FormattingOutputOnf);
jest.mock('../../../infra/kafka/queueKafkaOutbound', () => ({
  run: mockQueueKafkaOutboundRun
}));
jest.mock('./p2Storing/P2Storing', () => ({ run: mockP2StoringRun }));

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
    mockP2LoadRawCcRun.mockResolvedValue({
      'raw-cc': { uuid: 'device-1' },
      offsets: [{ value: 8 }],
      'device-pm-data-quality': { 'mount-name': 'device-1' }
    });
    mockP2CreateResultCcRun.mockResolvedValue({
      'result-cc': { uuid: 'device-1' },
      'status-data': [{ status: 'updated' }]
    });
    mockQueueKafkaOutboundRun.mockResolvedValue({
      queuedResultList: [{ status: 'QUEUED' }]
    });
    mockP1FormattingOutputApt.mockResolvedValue({
      'format-name': 'apt-output-format',
      'output-format': { format: 'apt', uuid: 'device-1' }
    });
    mockP2FormattingOutputOnf.mockResolvedValue({
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
    });
    mockP2StoringRun.mockResolvedValue({});
    const dataStoreEsClient = {
      url: 'http://data-store:9200',
      client: dataStoreClient
    };

    const result = await p2ProcessDevice.run({
      parameters: {},
      configFile: {},
      mountName: 'device-1',
      mwdiReplicaEsClient: {
        uuid: 'replica-client',
        'index-alias': 'mwdi-replica'
      },
      dataStoreEsClient,
      kafkaConsumerTypes: 'APT,MYCOM,NETEXPLORER,IVERITAS,DATAQUALITYPROVIDER'
    });

    expect(dataStoreClient.get).toHaveBeenCalledWith({
      index: 'data-store',
      id: 'device-1'
    });
    expect(mockP2LoadRawCcRun).toHaveBeenCalledWith(expect.objectContaining({
      offsets: [{ value: 7 }]
    }));
    expect(mockP2CreateResultCcRun).toHaveBeenCalledWith(expect.objectContaining({
      'status-data': [{ status: 'ok' }]
    }));
    expect(mockQueueKafkaOutboundRun).toHaveBeenCalledWith({
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
    expect(result).toEqual({
      'device-pm-data-quality': { 'mount-name': 'device-1' }
    });
  });

});
