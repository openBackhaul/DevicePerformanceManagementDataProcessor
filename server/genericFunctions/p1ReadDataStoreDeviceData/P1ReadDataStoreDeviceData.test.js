const ERRORS = require('./ErrorsEnum');
const fs = require('fs');

const p1ReadDataStoreDeviceData = require('./P1ReadDataStoreDeviceData');

describe("p1ReadDataStoreDeviceData", () => {

  let elasticsearchClient;
  let elasticsearchClientWrong;
  let inputMock;

  const input = {
    "data-store-es-client": {
      "uuid": "dpmdp-1-1-0-es-c-es-1-0-0-007",
      "url": "http://127.0.0.1:9200",
      "index-alias": "7",
      "api-key": "API key not yet defined.",
      "operational-state": "elasticsearch-client-interface-1-0:OPERATIONAL_STATE_TYPE_NOT_YET_DEFINED",
      "life-cycle-state": "elasticsearch-client-interface-1-0:LIFE_CYCLE_STATE_TYPE_NOT_YET_DEFINED",
    },
    "mount-name": "513250011"
  };

  beforeEach(() => {
    elasticsearchClient = {
      get: jest.fn()
    };

    elasticsearchClientWrong = {
      get: jest.fn().mockRejectedValueOnce(new Error("connection failed"))
    };

    inputMock = {
      'data-store-es-client': {
        'url': 'http://localhost:9200',
        'index-alias': 'data-store',
        'client': elasticsearchClient
      },
      'mount-name': '100250001'
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should return error when there in any elk active", async () => {
    const result = await p1ReadDataStoreDeviceData(input);

    expect(result).toBeDefined();
  });

  test("should return device PM data", async () => {

    elasticsearchClient.get.mockResolvedValue({
      '_index': 'data-store',
      '_id': 'device=100250001/processing-data',
      'found': true,
      '_source': 
        [
          {
            "batch-timestamp": "2026-07-07T10:00:00.000Z",
            "result-cc": {
              "control-construct": [
                { "uuid": "air-interface-1", "historical-performance-data-list": [] }
              ]
            }
          },
          {
            "batch-timestamp": "2026-07-07T10:30:00.000Z",
            "result-cc": {
              "control-construct": [
                { "uuid": "air-interface-1", "historical-performance-data-list": [] }
              ]
            }
          }
        ]
      
    });

    const result = await p1ReadDataStoreDeviceData(inputMock);

    expect(result).toBeDefined();
    expect(result["device-pm-data"]).toHaveLength(2);
    expect(result["device-pm-data"][0]["batch-timestamp"]).toBe(
      "2026-07-07T10:00:00.000Z"
    );
  });

  test("should return dataStoreUrl not provided", async () => {
    const input = {
      "data-store-es-client": {},
      "mount-name": "100250001"
    };

    const result = await p1ReadDataStoreDeviceData(input);

    expect(result).toBe(ERRORS.DATA_STORE_NOT_PROVIDED);
  });

  test("should return dataStoreUrl invalid", async () => {
    const input = {
      "data-store-es-client": {
        "url": "invalid-url"
      },
      "mount-name": "100250001"
    };

    const result = await p1ReadDataStoreDeviceData(input);
    expect(result).toBe(ERRORS.DATA_STORE_INVALID);
  });

  test("should return mountName not provided", async () => {
    const input = {
      "data-store-es-client": {
        "url": "http://localhost:9200"
      }
    };

    const result = await p1ReadDataStoreDeviceData(input);
    expect(result).toBe(ERRORS.MOUNTNAME_NOT_PROVIDED);
  });

  test("should return mountName invalid", async () => {
    const input = {
      "data-store-es-client": {
        "url": "http://localhost:9200"
      },
      "mount-name": 100250001
    };

    const result = await p1ReadDataStoreDeviceData(input);
    expect(result).toBe(ERRORS.MOUNTNAME_INVALID);
  });

  test("should return mountName not found in DataStore", async () => {
    elasticsearchClient.get.mockResolvedValue({
      '_index': 'data-store',
      '_id': 'device=100250001/processing-data',
      'found': false,
      '_source': []
    });

    const input = {
      "data-store-es-client": {
        "url": "http://localhost:9200",
        "client": elasticsearchClient
      },
      "mount-name": "unknown-device"
    };

    const result = await p1ReadDataStoreDeviceData(input);
    expect(result).toBe(ERRORS.MOUNTNAME_NOT_FOUND);
  });

  test("should return ElasticSearch read error", async () => {
    const input = {
      "data-store-es-client": {
        "url": "http://localhost:9200",
        "client": elasticsearchClientWrong
      },
      "mount-name": "100250001"
    };

    const result = await p1ReadDataStoreDeviceData(input);
    expect(result).toBe(ERRORS.ELK_READ_ERROR);
  });
});