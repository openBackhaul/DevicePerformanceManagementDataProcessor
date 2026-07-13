const PREPARE_TX_MODES_PATH = "./p1PrepareTxModes/P1PrepareTxModes.js";
const ITERATE_AI_PM_SLICES_PATH = "./p1IterateAiPmSlices/P1IterateAiPmSlices.js";
const ITERATE_EC_PM_SLICES_PATH = "./p1IterateEcPmSlices/P1IterateEcPmSlices.js";
const REMOVE_TEMPERATURE_PATH = "../../../../genericFunctions/p1RemoveOutOfRangeTemperature/P1RemoveOutOfRangeTemperature";

function mockRemoveOutOfRangeTemperature() {
  const removeTemperatureMock = jest.fn(({ equipment }) => ({ equipment }));
  jest.doMock(REMOVE_TEMPERATURE_PATH, () => removeTemperatureMock);
  return removeTemperatureMock;
}

describe("P1CreateResultCc EthernetContainer iteration", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.dontMock(PREPARE_TX_MODES_PATH);
    jest.dontMock(ITERATE_AI_PM_SLICES_PATH);
    jest.dontMock(ITERATE_EC_PM_SLICES_PATH);
    jest.dontMock(REMOVE_TEMPERATURE_PATH);
  });

  it("adds AirInterface metadata and derived LTP fields after successful AirInterface iteration", async () => {
    const preparedHistoricalPerformanceDataList = [
      {
        "granularity-period": "air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
        "period-end-time": "2026-07-02T10:00:00.000Z",
        "performance-data": {
          "time-xstates-list": [
            {
              "transmission-mode": "MODE-A",
              time: 900
            }
          ]
        }
      }
    ];

    const preparedTransmissionModeList = [
      {
        "transmission-mode-name": "MODE-A",
        capacity: 1000
      }
    ];

    const iteratedHistoricalPerformanceDataList = [
      {
        ...preparedHistoricalPerformanceDataList[0],
        "performance-data": {
          ...preparedHistoricalPerformanceDataList[0]["performance-data"],
          "interval-capacity": 1000
        }
      }
    ];

    const prepareTxModesMock = jest.fn(() => ({
      "historical-performance-data-list": preparedHistoricalPerformanceDataList,
      "transmission-mode-list": preparedTransmissionModeList
    }));

    const iterateAiMock = jest.fn(() => ({
      "historical-performance-data-list": iteratedHistoricalPerformanceDataList,
      "most-recent-period-end-time": "2026-07-02T10:15:00.000Z",
      "most-recent-period-end-time-24": "2026-07-02T00:00:00.000Z"
    }));

    jest.doMock(PREPARE_TX_MODES_PATH, () => prepareTxModesMock);
    jest.doMock(ITERATE_AI_PM_SLICES_PATH, () => ({
      p1IterateAiPmSlices: iterateAiMock
    }));
    mockRemoveOutOfRangeTemperature();

    const p1CreateResultCc = require("./P1CreateResultCc");

    const response = await p1CreateResultCc.run({
      mountName: "test-device",
      parameters: {
        "function-name": "p1CreateResultCc",
        "sub-function": [
          {
            "function-name": "p1IterateAiPmSlices",
            parameter: []
          },
          {
            "function-name": "p1RemoveOutOfRangeTemperature",
            parameter: []
          }
        ]
      },
      "raw-cc": {
        equipment: [],
        "profile-collection": {
          profile: [
            {
              uuid: "aggregation-profile-1",
              "profile-name": "layer-1-aggregation-profile",
              "layer-1-aggregation-profile-1-0:layer-1-aggregation-profile-pac": {
                "layer-1-aggregation-profile-configuration": {
                  "client-ltp": "client-ltp-1",
                  "server-ltp-list": [
                    "structure-ltp-1"
                  ]
                }
              }
            }
          ]
        },
        "logical-termination-point": [
          {
            uuid: "air-ltp-1",
            "ltp-augment-1-0:ltp-augment-pac": {
              "external-label": "123456789A"
            },
            "layer-protocol": [
              {
                "layer-protocol-name": "air-interface-2-0:LAYER_PROTOCOL_NAME_TYPE_AIR_LAYER",
                "air-interface-2-0:air-interface-pac": {
                  "air-interface-historical-performances": {
                    "historical-performance-data-list": []
                  },
                  "air-interface-capability": {
                    "transmission-mode-list": []
                  }
                }
              }
            ]
          },
          {
            uuid: "structure-ltp-1",
            "server-ltp": [
              "air-ltp-1",
              "wire-ltp-1"
            ],
            "layer-protocol": []
          },
          {
            uuid: "wire-ltp-1",
            "layer-protocol": [
              {
                "layer-protocol-name": "wire-interface-2-0:LAYER_PROTOCOL_NAME_TYPE_WIRE_LAYER"
              }
            ]
          }
        ]
      }
    });

    const airLtp = response.resultCc["logical-termination-point"].find(
      (ltp) => ltp.uuid === "air-ltp-1"
    );
    const airPac = airLtp["layer-protocol"][0]["air-interface-2-0:air-interface-pac"];

    expect(prepareTxModesMock).toHaveBeenCalledTimes(1);
    expect(iterateAiMock).toHaveBeenCalledTimes(1);
    expect(airPac["air-interface-capability"]["transmission-mode-list"]).toEqual(
      preparedTransmissionModeList
    );
    expect(
      airPac["air-interface-historical-performances"]["historical-performance-data-list"]
    ).toEqual(iteratedHistoricalPerformanceDataList);
    expect(airLtp["ltp-augment-1-0:ltp-augment-pac"]["link-id"]).toBe("123456789");
    expect(airLtp["parallel-ltp"]).toEqual(["wire-ltp-1"]);
    expect(response.interfaceMetadataList).toEqual([
      expect.objectContaining({
        uuid: "air-ltp-1",
        "layer-protocol-name": "air-interface-2-0:LAYER_PROTOCOL_NAME_TYPE_AIR_LAYER",
        "most-recent-period-end-time": "2026-07-02T10:15:00.000Z",
        "most-recent-period-end-time-24": "2026-07-02T00:00:00.000Z"
      })
    ]);
    expect(response.interfaceMetadataList[0]).not.toHaveProperty("ltp-uuid");
    expect(response.interfaceMetadataList[0]).not.toHaveProperty("link-id");
    expect(response.interfaceMetadataList[0]).not.toHaveProperty("link-endpoint-id");
    expect(response.interfaceMetadataList[0]).not.toHaveProperty("parallel-physical-ltp-list");
    expect(response.interfaceMetadataList[0]).not.toHaveProperty("mostRecentPeriodEndTime");
    expect(response.interfaceMetadataList[0]).not.toHaveProperty("mostRecentPeriodEndTime24");

    const serializedResponse = JSON.parse(JSON.stringify(response));
    expect(serializedResponse.resultCc).toBeUndefined();
    expect(serializedResponse.interfaceMetadataList).toBeUndefined();
    expect(serializedResponse.aggregationGroupList).toBeUndefined();
    expect(serializedResponse["result-cc"]).toEqual(response.resultCc);
    expect(serializedResponse["interface-metadata-list"]).toEqual(response.interfaceMetadataList);
    expect(serializedResponse["aggregation-group-list"]).toEqual(response.aggregationGroupList);
  });

  it("adds EthernetContainer layer protocol name to interface metadata", async () => {
    const iteratedHistoricalPerformanceDataList = [
      {
        "granularity-period": "ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
        "period-end-time": "2026-07-02T10:00:00.000Z",
        "performance-data": {
          utilization: 50
        }
      }
    ];

    const iterateEcMock = jest.fn(() => ({
      "historical-performance-data-list": iteratedHistoricalPerformanceDataList,
      "most-recent-period-end-time": "2026-07-02T10:15:00.000Z",
      "most-recent-period-end-time-24": "2026-07-02T00:00:00.000Z"
    }));

    jest.doMock(ITERATE_EC_PM_SLICES_PATH, () => iterateEcMock);
    mockRemoveOutOfRangeTemperature();

    const p1CreateResultCc = require("./P1CreateResultCc");

    const response = await p1CreateResultCc.run({
      mountName: "test-device",
      parameters: {
        "function-name": "p1CreateResultCc",
        "sub-function": [
          {
            "function-name": "p1IterateEcPmSlices",
            parameter: []
          },
          {
            "function-name": "p1RemoveOutOfRangeTemperature",
            parameter: []
          }
        ]
      },
      "raw-cc": {
        equipment: [],
        "logical-termination-point": [
          {
            uuid: "eth-ltp-1",
            "layer-protocol": [
              {
                "layer-protocol-name": "ethernet-container-2-0:LAYER_PROTOCOL_NAME_TYPE_ETHERNET_CONTAINER_LAYER",
                "ethernet-container-2-0:ethernet-container-pac": {
                  "ethernet-container-historical-performances": {
                    "historical-performance-data-list": []
                  }
                }
              }
            ]
          }
        ]
      }
    });

    expect(iterateEcMock).toHaveBeenCalledTimes(1);
    expect(response.interfaceMetadataList).toEqual([
      expect.objectContaining({
        uuid: "eth-ltp-1",
        "layer-protocol-name": "ethernet-container-2-0:LAYER_PROTOCOL_NAME_TYPE_ETHERNET_CONTAINER_LAYER",
        "most-recent-period-end-time": "2026-07-02T10:15:00.000Z",
        "most-recent-period-end-time-24": "2026-07-02T00:00:00.000Z"
      })
    ]);
    expect(response.interfaceMetadataList[0]).not.toHaveProperty("ltp-uuid");
    expect(response.interfaceMetadataList[0]).not.toHaveProperty("mostRecentPeriodEndTime");
    expect(response.interfaceMetadataList[0]).not.toHaveProperty("mostRecentPeriodEndTime24");
  });

  it("prunes failed EthernetContainer LTPs when AirInterface processing succeeds", async () => {
    const preparedHistoricalPerformanceDataList = [
      {
        "granularity-period": "air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
        "period-end-time": "2026-07-02T10:00:00.000Z",
        "performance-data": {}
      }
    ];
    const preparedTransmissionModeList = [
      {
        "transmission-mode-name": "MODE-A",
        capacity: 1000
      }
    ];
    const iterateAiMock = jest.fn(() => ({
      "historical-performance-data-list": preparedHistoricalPerformanceDataList,
      "most-recent-period-end-time": "2026-07-02T10:15:00.000Z"
    }));
    const iterateEcMock = jest.fn(() => "parameters invalid");

    jest.doMock(PREPARE_TX_MODES_PATH, () => jest.fn(() => ({
      "historical-performance-data-list": preparedHistoricalPerformanceDataList,
      "transmission-mode-list": preparedTransmissionModeList
    })));
    jest.doMock(ITERATE_AI_PM_SLICES_PATH, () => ({
      p1IterateAiPmSlices: iterateAiMock
    }));
    jest.doMock(ITERATE_EC_PM_SLICES_PATH, () => iterateEcMock);
    mockRemoveOutOfRangeTemperature();

    const p1CreateResultCc = require("./P1CreateResultCc");

    const response = await p1CreateResultCc.run({
      mountName: "test-device",
      parameters: {
        "function-name": "p1CreateResultCc",
        "sub-function": [
          {
            "function-name": "p1IterateAiPmSlices",
            parameter: []
          },
          {
            "function-name": "p1IterateEcPmSlices",
            parameter: []
          },
          {
            "function-name": "p1RemoveOutOfRangeTemperature",
            parameter: []
          }
        ]
      },
      "raw-cc": {
        equipment: [],
        "logical-termination-point": [
          {
            uuid: "air-ltp-1",
            "layer-protocol": [
              {
                "layer-protocol-name": "air-interface-2-0:LAYER_PROTOCOL_NAME_TYPE_AIR_LAYER",
                "air-interface-2-0:air-interface-pac": {
                  "air-interface-historical-performances": {
                    "historical-performance-data-list": []
                  },
                  "air-interface-capability": {
                    "transmission-mode-list": []
                  }
                }
              }
            ]
          },
          {
            uuid: "eth-ltp-1",
            "layer-protocol": [
              {
                "layer-protocol-name": "ethernet-container-2-0:LAYER_PROTOCOL_NAME_TYPE_ETHERNET_CONTAINER_LAYER",
                "ethernet-container-2-0:ethernet-container-pac": {
                  "ethernet-container-historical-performances": {
                    "historical-performance-data-list": []
                  }
                }
              }
            ]
          },
          {
            uuid: "wire-ltp-1",
            "layer-protocol": [
              {
                "layer-protocol-name": "wire-interface-2-0:LAYER_PROTOCOL_NAME_TYPE_WIRE_LAYER"
              }
            ]
          }
        ]
      }
    });

    expect(iterateAiMock).toHaveBeenCalledTimes(1);
    expect(iterateEcMock).toHaveBeenCalledTimes(1);
    expect(response.resultCc["logical-termination-point"].map((ltp) => ltp.uuid))
      .toEqual(["air-ltp-1", "wire-ltp-1"]);
    expect(response.interfaceMetadataList.map((metadata) => metadata.uuid))
      .toEqual(["air-ltp-1"]);
    expect(response.interfaceMetadataList[0]).toHaveProperty(
      "most-recent-period-end-time",
      "2026-07-02T10:15:00.000Z"
    );
    expect(response.interfaceMetadataList[0]).not.toHaveProperty("most-recent-period-end-time-24");
  });

  it("prunes failed AirInterface LTPs when EthernetContainer processing succeeds", async () => {
    const iteratedHistoricalPerformanceDataList = [
      {
        "granularity-period": "ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN",
        "period-end-time": "2026-07-02T10:00:00.000Z",
        "performance-data": {
          utilization: 50
        }
      }
    ];
    const prepareTxModesMock = jest.fn(() => "historicalPerformanceDataList could not be provided");
    const iterateEcMock = jest.fn(() => ({
      "historical-performance-data-list": iteratedHistoricalPerformanceDataList,
      "most-recent-period-end-time": "2026-07-02T10:15:00.000Z"
    }));

    jest.doMock(PREPARE_TX_MODES_PATH, () => prepareTxModesMock);
    jest.doMock(ITERATE_EC_PM_SLICES_PATH, () => iterateEcMock);
    mockRemoveOutOfRangeTemperature();

    const p1CreateResultCc = require("./P1CreateResultCc");

    const response = await p1CreateResultCc.run({
      mountName: "test-device",
      parameters: {
        "function-name": "p1CreateResultCc",
        "sub-function": [
          {
            "function-name": "p1IterateAiPmSlices",
            parameter: []
          },
          {
            "function-name": "p1IterateEcPmSlices",
            parameter: []
          },
          {
            "function-name": "p1RemoveOutOfRangeTemperature",
            parameter: []
          }
        ]
      },
      "raw-cc": {
        equipment: [],
        "logical-termination-point": [
          {
            uuid: "air-ltp-1",
            "layer-protocol": [
              {
                "layer-protocol-name": "air-interface-2-0:LAYER_PROTOCOL_NAME_TYPE_AIR_LAYER",
                "air-interface-2-0:air-interface-pac": {
                  "air-interface-historical-performances": {
                    "historical-performance-data-list": []
                  },
                  "air-interface-capability": {
                    "transmission-mode-list": []
                  }
                }
              }
            ]
          },
          {
            uuid: "eth-ltp-1",
            "layer-protocol": [
              {
                "layer-protocol-name": "ethernet-container-2-0:LAYER_PROTOCOL_NAME_TYPE_ETHERNET_CONTAINER_LAYER",
                "ethernet-container-2-0:ethernet-container-pac": {
                  "ethernet-container-historical-performances": {
                    "historical-performance-data-list": []
                  }
                }
              }
            ]
          },
          {
            uuid: "wire-ltp-1",
            "layer-protocol": [
              {
                "layer-protocol-name": "wire-interface-2-0:LAYER_PROTOCOL_NAME_TYPE_WIRE_LAYER"
              }
            ]
          }
        ]
      }
    });

    expect(prepareTxModesMock).toHaveBeenCalledTimes(1);
    expect(iterateEcMock).toHaveBeenCalledTimes(1);
    expect(response.resultCc["logical-termination-point"].map((ltp) => ltp.uuid))
      .toEqual(["eth-ltp-1", "wire-ltp-1"]);
    expect(response.interfaceMetadataList.map((metadata) => metadata.uuid))
      .toEqual(["eth-ltp-1"]);
    expect(response.interfaceMetadataList[0]).toHaveProperty(
      "most-recent-period-end-time",
      "2026-07-02T10:15:00.000Z"
    );
    expect(response.interfaceMetadataList[0]).not.toHaveProperty("most-recent-period-end-time-24");
  });

  it("stops further processing when all interface processing attempts fail", async () => {
    const prepareTxModesMock = jest.fn(() => ({
      "historical-performance-data-list": [],
      "transmission-mode-list": []
    }));
    const iterateAiMock = jest.fn(() => "parameters invalid");
    const iterateEcMock = jest.fn(() => "parameters invalid");

    jest.doMock(PREPARE_TX_MODES_PATH, () => prepareTxModesMock);
    jest.doMock(ITERATE_AI_PM_SLICES_PATH, () => ({
      p1IterateAiPmSlices: iterateAiMock
    }));
    jest.doMock(ITERATE_EC_PM_SLICES_PATH, () => iterateEcMock);
    const removeTemperatureMock = mockRemoveOutOfRangeTemperature();

    const p1CreateResultCc = require("./P1CreateResultCc");

    await expect(p1CreateResultCc.run({
      mountName: "test-device",
      parameters: {
        "function-name": "p1CreateResultCc",
        "sub-function": [
          {
            "function-name": "p1IterateAiPmSlices",
            parameter: []
          },
          {
            "function-name": "p1IterateEcPmSlices",
            parameter: []
          },
          {
            "function-name": "p1RemoveOutOfRangeTemperature",
            parameter: []
          }
        ]
      },
      "raw-cc": {
        equipment: [],
        "logical-termination-point": [
          {
            uuid: "air-ltp-1",
            "layer-protocol": [
              {
                "layer-protocol-name": "air-interface-2-0:LAYER_PROTOCOL_NAME_TYPE_AIR_LAYER",
                "air-interface-2-0:air-interface-pac": {
                  "air-interface-historical-performances": {
                    "historical-performance-data-list": []
                  },
                  "air-interface-capability": {
                    "transmission-mode-list": []
                  }
                }
              }
            ]
          },
          {
            uuid: "eth-ltp-1",
            "layer-protocol": [
              {
                "layer-protocol-name": "ethernet-container-2-0:LAYER_PROTOCOL_NAME_TYPE_ETHERNET_CONTAINER_LAYER",
                "ethernet-container-2-0:ethernet-container-pac": {
                  "ethernet-container-historical-performances": {
                    "historical-performance-data-list": []
                  }
                }
              }
            ]
          }
        ]
      }
    })).rejects.toMatchObject({
      stage: "p1CreateResultCc",
      retryable: false,
      message: "No AirInterface or EthernetContainer processing succeeded",
      details: {
        airInterface: {
          attempted: 1,
          succeeded: 0,
          failed: 1
        },
        ethernetContainer: {
          attempted: 1,
          succeeded: 0,
          failed: 1
        }
      }
    });

    expect(prepareTxModesMock).toHaveBeenCalledTimes(1);
    expect(iterateAiMock).toHaveBeenCalledTimes(1);
    expect(iterateEcMock).toHaveBeenCalledTimes(1);
    expect(removeTemperatureMock).not.toHaveBeenCalled();
  });
});
