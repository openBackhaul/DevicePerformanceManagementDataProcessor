const ERRORS = require('./ErrorsEnum');
const fs = require('fs');

const p1ReadDataStoreDeviceData = require('./P1ReadDataStoreDeviceData');

const input = {
  "data-store-es-client": {
    "url": "http://localhost:9200",
    get: async url => [
      {
        "batch-timestamp": "2026-07-07T10:00:00.000Z",
        "result-cc": {
          "control-construct": [
            {
              "uuid": "air-interface-1",
              "historical-performance-data-list": []
            }
          ]
        }
      }
    ]
  },
  "mount-name": "100250001"
};

describe("p1ReadDataStoreDeviceData", () => {
  test("should return device PM data", async () => {
    const input = {
      "data-store-es-client": {
        "url": "http://localhost:9200",
        get: async () => [
          {
            "batch-timestamp": "2026-07-07T10:00:00.000Z",
            "result-cc": {
              "control-construct": []
            }
          }
        ]
      },
      "mount-name": "100250001"
    };

    const result = await p1ReadDataStoreDeviceData(input);

    expect(result).toBeDefined();
    expect(result["device-pm-data"]).toHaveLength(1);
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
    const input = {
      "data-store-es-client": {
        "url": "http://localhost:9200",
        get: async () => []
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
        get: async () => {
          throw new Error("connection failed");
        }
      },
      "mount-name": "100250001"
    };

    const result = await p1ReadDataStoreDeviceData(input);
    expect(result).toBe(ERRORS.ELK_READ_ERROR);
  });
});