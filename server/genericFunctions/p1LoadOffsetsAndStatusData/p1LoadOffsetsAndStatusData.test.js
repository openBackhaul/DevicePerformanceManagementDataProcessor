'use strict';

const p1LoadOffsetsAndStatusData = require('./P1LoadOffsetsAndStatusData');
const ERRORS = require('./ErrorsEnum');

describe('p1LoadOffsetsAndStatusData', () => {
  let elasticsearchClient;
  let validInput;

  beforeEach(() => {
    elasticsearchClient = {
      get: jest.fn()
    };

    validInput = {
      'data-store-es-client': {
        'url': 'http://localhost:9200',
        'index': 'data-store',
        'client': elasticsearchClient
      },
      'mount-name': '100250001'
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('returns offsets and status-data from Elasticsearch', async () => {
    const offsets = [
      {
        'function-name': 'p1DiscardIrrelevantPmRecords',
        'offset': 12
      },
      {
        'function-name': 'p1CalculateIntervalCapacity',
        'offset': 8
      }
    ];

    const statusData = [
      {
        'function-name': 'p1DiscardIrrelevantPmRecords',
        'status': 'completed'
      }
    ];

    elasticsearchClient.get.mockResolvedValue({
      '_index': 'data-store',
      '_id': 'device=100250001/processing-data',
      'found': true,
      '_source': {
        'offsets': offsets,
        'status-data': statusData
      }
    });

    const result = await p1LoadOffsetsAndStatusData(validInput);

    expect(result).toEqual({
      'offsets': offsets,
      'status-data': statusData
    });

    expect(elasticsearchClient.get).toHaveBeenCalledTimes(1);

    expect(elasticsearchClient.get).toHaveBeenCalledWith({
      'index': 'data-store',
      'id': 'device=100250001/processing-data'
    });
  });

  test('supports Elasticsearch responses containing body', async () => {
    elasticsearchClient.get.mockResolvedValue({
      'body': {
        '_index': 'data-store',
        '_id': 'device=100250001/processing-data',
        '_source': {
          'offsets': [
            {
              'function-name': 'function-a',
              'offset': 4
            }
          ],
          'status-data': [
            {
              'function-name': 'function-a',
              'status': 'running'
            }
          ]
        }
      }
    });

    const result = await p1LoadOffsetsAndStatusData(validInput);

    expect(result).toEqual({
      'offsets': [
        {
          'function-name': 'function-a',
          'offset': 4
        }
      ],
      'status-data': [
        {
          'function-name': 'function-a',
          'status': 'running'
        }
      ]
    });
  });

  test('uses the default data-store index when index is not provided', async () => {
    delete validInput['data-store-es-client'].index;

    elasticsearchClient.get.mockResolvedValue({
      '_source': {
        'offsets': [],
        'status-data': []
      }
    });

    await p1LoadOffsetsAndStatusData(validInput);

    expect(elasticsearchClient.get).toHaveBeenCalledWith({
      'index': 'data-store',
      'id': 'device=100250001/processing-data'
    });
  });

  test('returns empty arrays when the device does not exist', async () => {
    const notFoundError = new Error('document not found');

    notFoundError.name = 'ResponseError';
    notFoundError.meta = {
      'statusCode': 404
    };

    elasticsearchClient.get.mockRejectedValue(notFoundError);

    const result = await p1LoadOffsetsAndStatusData(validInput);

    expect(result).toEqual({
      'offsets': [],
      'status-data': []
    });
  });

  test('returns empty arrays when fields are missing from the document', async () => {
    elasticsearchClient.get.mockResolvedValue({
      '_source': {}
    });

    const result = await p1LoadOffsetsAndStatusData(validInput);

    expect(result).toEqual({
      'offsets': [],
      'status-data': []
    });
  });

  test('returns an empty offsets array when offsets is not an array', async () => {
    elasticsearchClient.get.mockResolvedValue({
      '_source': {
        'offsets': 'invalid-offsets',
        'status-data': [
          {
            'function-name': 'function-a',
            'status': 'completed'
          }
        ]
      }
    });

    const result = await p1LoadOffsetsAndStatusData(validInput);

    expect(result).toEqual({
      'offsets': [],
      'status-data': [
        {
          'function-name': 'function-a',
          'status': 'completed'
        }
      ]
    });
  });

  test('Return error dataStoreUrl not provided when client configuration is missing', async () => {
    const result = await p1LoadOffsetsAndStatusData({
      'mount-name': '100250001'
    });
    expect(result).toBe(ERRORS.DATA_STORE_URL_NOT_PROV);
    expect(elasticsearchClient.get).not.toHaveBeenCalled();
  });

  test('Return error dataStoreUrl not provided when URL is missing', async () => {
    delete validInput['data-store-es-client'].url;

    const result = await p1LoadOffsetsAndStatusData(validInput);
    expect(result).toBe(ERRORS.DATA_STORE_URL_NOT_PROV);
    expect(elasticsearchClient.get).not.toHaveBeenCalled();
  });

  test.each([
    ['not-a-url'],
    ['ftp://localhost:9200'],
    [123],
    [{}]
  ])(
    'Return error dataStoreUrl invalid for invalid URL value %p',
    async invalidUrl => {
      validInput['data-store-es-client'].url = invalidUrl;

      const result = await p1LoadOffsetsAndStatusData(validInput);
      expect(result).toBe(ERRORS.DATA_STORE_URL_INVALID);
      expect(elasticsearchClient.get).not.toHaveBeenCalled();
    }
  );

  test('Return error mountName not provided when mount-name is missing', async () => {
    delete validInput['mount-name'];

    const result = await p1LoadOffsetsAndStatusData(validInput);
    expect(result).toBe(ERRORS.MOUNT_NAME_NOT_PROVIDED);
    expect(elasticsearchClient.get).not.toHaveBeenCalled();
  });

  test('Return error mountName not provided when mount-name is empty', async () => {
    validInput['mount-name'] = '';

    const result = await p1LoadOffsetsAndStatusData(validInput);
    expect(result).toBe(ERRORS.MOUNT_NAME_NOT_PROVIDED);
    expect(elasticsearchClient.get).not.toHaveBeenCalled();
  });

  test.each([
    ['   '],
    [123],
    [{}],
    [[]]
  ])(
    'Return error mountName invalid for invalid mount-name %p',
    async invalidMountName => {
      validInput['mount-name'] = invalidMountName;

      const result = await p1LoadOffsetsAndStatusData(validInput);
      expect(result).toBe(ERRORS.MOUNT_NAME_INVALID);
      expect(elasticsearchClient.get).not.toHaveBeenCalled();
    }
  );

  test('Return error ElasticSearch read error for a connection error', async () => {
    const connectionError = new Error('connect ECONNREFUSED');

    connectionError.name = 'ConnectionError';
    connectionError.meta = {
      'statusCode': 503
    };

    elasticsearchClient.get.mockRejectedValue(connectionError);
    const result = await p1LoadOffsetsAndStatusData(validInput);
    expect(result).toBe(ERRORS.ELK_READ_ERROR);
  });

  test('Return error ElasticSearch read error when client.get is unavailable', async () => {
    validInput['data-store-es-client'].client = {};

    const result = await p1LoadOffsetsAndStatusData(validInput);
    expect(result).toBe(ERRORS.ELK_READ_ERROR);
  });

  test('Return error general processing error for an invalid Elasticsearch response', async () => {
    elasticsearchClient.get.mockResolvedValue(null);

    const result = await p1LoadOffsetsAndStatusData(validInput);
    expect(result).toBe(ERRORS.GENERAL_ERROR);
  });

  test('Return error general processing error when _source is missing', async () => {
    elasticsearchClient.get.mockResolvedValue({
      '_index': 'data-store',
      '_id': 'device=100250001/processing-data',
      'found': true
    });

    const result = await p1LoadOffsetsAndStatusData(validInput);
    expect(result).toBe(ERRORS.GENERAL_ERROR);
  });

  test('does not modify the Elasticsearch source arrays', async () => {
    const source = {
      'offsets': [
        {
          'function-name': 'function-a',
          'offset': 10
        }
      ],
      'status-data': [
        {
          'function-name': 'function-a',
          'status': 'completed'
        }
      ]
    };

    elasticsearchClient.get.mockResolvedValue({
      _source: source
    });

    const sourceBeforeExecution = JSON.parse(JSON.stringify(source));
    await p1LoadOffsetsAndStatusData(validInput);
    expect(source).toEqual(sourceBeforeExecution);
  });
});