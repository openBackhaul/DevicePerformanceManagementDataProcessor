
const p1CalculateUtilization = require('./P1CalculateUtilization');
const ERRORS = require('./ErrorsEnum.js');
const fs = require('fs');

describe('p1CalculateUtilization', () => {

  const createValidHistoricalData = (granularity = 'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN') => ({
    'granularity-period': granularity,
    'period-end-time': '2026-04-01T06:00:00.0+00:00',
    'performance-data': {
      'total-bytes-output': '9000000',
      'time-period': 900
    }
  });

  const createValidAggGroup = (uuids = ['LTP-1']) => ({
    'physical-server-ltp-list': uuids
  });

  const createValidResultCC = (uuid = 'LTP-1', capacity = 1000, time = '2026-04-01T06:00:00.0+00:00') => ({
    'logical-termination-point': [{
      'uuid': uuid,
      'layer-protocol': [{
        'local-id': 'LP-1',
        'layer-protocol-name': 'air-interface-2-0:LAYER_PROTOCOL_NAME_TYPE_AIR_LAYER',
        'air-interface-2-0:air-interface-pac': {
          'air-interface-historical-performances': {
            'historical-performance-data-list': [{
              'period-end-time': time,
              'granularity-period': 'air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
              'performance-data': {
                'interval-capacity': capacity
              }
            }]
          }
        }
      }]
    }]
  });

  test('should return "General Error" if input is null', () => {
    expect(p1CalculateUtilization(null))
      .toBe(ERRORS.GENERAL_ERROR);
  });

  test('read from real dataset', () => {
    let histFile = fs.readFileSync(__dirname + '/datasets/ethHistoricalPerf.json', 'utf8');
    let perfData = JSON.parse(histFile);
    let ccFile = fs.readFileSync(__dirname + '/datasets/resultCC2.json', 'utf8');
    let resCC = JSON.parse(ccFile);
    let inputStruct = {
      'historical-performance-data': perfData,
      'aggregation-group': {
        'physical-server-ltp-list': [
          'LTP-MWPS-TTP-ODU-B',
          'LTP-MWPS-TTP-ODU-A',
        ]
      },
      'result-cc': resCC
    };
    let result = p1CalculateUtilization(inputStruct);
    expect(result).toBeDefined();
  });

  test('read from real dataset 2', () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/ethHistoricalPerf2.json', 'utf8');
    let perfData = JSON.parse(dataFile);
    let inputStruct = {
      'historical-performance-data': perfData,
      'aggregation-group': {
        'physical-server-ltp-list': [
          'XXXXX',
          'YYYYY',
          'ZZZZZ'
        ]
      },
      'result-cc': {
        'logical-termination-point': undefined
      }
    };
    let result = p1CalculateUtilization(inputStruct);
    expect(result).toBeDefined();
  });

  test('should return HIST_PERF_DATA_NOT_PROVIDED if missing', () => {
    const input = { 'aggregation-group': {}, 'result-cc': {} };
    expect(p1CalculateUtilization(input)).toBe(ERRORS.HIST_PERF_DATA_NOT_PROVIDED);
  });

  test('should return HIST_PERF_DATA_INVALID if data structure is incomplete', () => {
    const input = {
      'historical-performance-data': { 'granularity-period': '15min' },
      'aggregation-group': {},
      'result-cc': {}
    };
    expect(p1CalculateUtilization(input)).toBe(ERRORS.HIST_PERF_DATA_INVALID);
  });

  test('should return AGG_GROUP_NOT_PROVIDED when both group and UUID are omitted', () => {
    const input = { 'historical-performance-data': createValidHistoricalData(), 'result-cc': {} };
    expect(p1CalculateUtilization(input)).toBe(ERRORS.AGG_GROUP_NOT_PROVIDED);
  });

  test('should return AGG_GROUP_INVALID if physical-server-ltp-list is missing', () => {
    const input = {
      'historical-performance-data': createValidHistoricalData(),
      'aggregation-group': {},
      'result-cc': {}
    };
    expect(p1CalculateUtilization(input)).toBe(ERRORS.AGG_GROUP_INVALID);
  });

  test('should return RESULT_CC_NOT_PROVIDED if missing', () => {
    const input = {
      'historical-performance-data': createValidHistoricalData(),
      'aggregation-group': createValidAggGroup()
    };
    expect(p1CalculateUtilization(input)).toBe(ERRORS.RESULT_CC_NOT_PROVIDED);
  });

  test('should return RESULT_CC_INVALID if result-cc structure is wrong', () => {
    const input = {
      'historical-performance-data': createValidHistoricalData(),
      'aggregation-group': createValidAggGroup(),
      'result-cc': { 'logical-termination-point': 'not-an-array' }
    };
    expect(p1CalculateUtilization(input)).toBe(ERRORS.RESULT_CC_INVALID);
  });

  test('should return input unchanged for 24-HOURS granularity', () => {
    const histData = createValidHistoricalData('ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS');
    const input = {
      'historical-performance-data': histData,
      'aggregation-group': createValidAggGroup(),
      'result-cc': createValidResultCC()
    };
    const result = p1CalculateUtilization(input);
    expect(result['historical-performance-data']).toEqual(histData);
    expect(result['historical-performance-data']['performance-data']['utilization']).toBeUndefined();
  });

  test('should return input unchanged for UNKNOWN granularity', () => {
    const histData = createValidHistoricalData('ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-UNKNOWN');
    const input = {
      'historical-performance-data': histData,
      'aggregation-group': createValidAggGroup(),
      'result-cc': createValidResultCC()
    };
    const result = p1CalculateUtilization(input);
    expect(result['historical-performance-data']).toEqual(histData);
  });

  test('should only sum capacity for LTPs in the physical-server-ltp-list', () => {
    const ltp1 = createValidResultCC('MATCH-1', 500)['logical-termination-point'][0];
    const ltp2 = createValidResultCC('NO-MATCH', 1000)['logical-termination-point'][0];
    const input = {
      'historical-performance-data': createValidHistoricalData(),
      'aggregation-group': createValidAggGroup(['MATCH-1']),
      'result-cc': {
        'logical-termination-point': [ltp1, ltp2]
      }
    };
    const result = p1CalculateUtilization(input);
    expect(result['historical-performance-data']['performance-data']['total-air-interface-interval-capacity']).toBe(500);
    expect(result['historical-performance-data']['performance-data']['utilization']).toBe(16);
  });

  test.each(['WRONG-TIME', '2026-04-01T05:45:00.0+00:00'])('should not aggregate if period-end-time does not match (%p)', time => {
    const input = {
      'historical-performance-data': createValidHistoricalData(),
      'aggregation-group': createValidAggGroup(['LTP-1']),
      'result-cc': createValidResultCC('LTP-1', 1000, time)
    };
    const result = p1CalculateUtilization(input);
    expect(result).toBe(ERRORS.UTILIZATION_COULDNT_ADD);
  });

  test('should not provide a capacity if no LTP matches', () => {
    const input = {
      'historical-performance-data': createValidHistoricalData(),
      'aggregation-group': createValidAggGroup(['UUID-X']),
      'result-cc': createValidResultCC('UUID-Y', 1000)
    };
    const result = p1CalculateUtilization(input);
    expect(result).toBe(ERRORS.UTILIZATION_COULDNT_ADD);
  });

  test('Happy Path Calculation', () => {
    const input = {
      'historical-performance-data': {
        'granularity-period': 'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
        'period-end-time': '2026-04-01T06:00:00Z',
        'performance-data': { 'total-bytes-output': '1125000', 'time-period': 900 }
      },
      'aggregation-group': createValidAggGroup(['LTP-1']),
      'result-cc': createValidResultCC('LTP-1', 1000, '2026-04-01T06:00:00Z')
    };
    const result = p1CalculateUtilization(input);
    expect(result['historical-performance-data']['performance-data']['utilization']).toBe(1);
  });

  test('Division by Zero (Zero Capacity), Error return: Utilization could not be added', () => {
    const input = {
      'historical-performance-data': createValidHistoricalData(),
      'aggregation-group': createValidAggGroup(['LTP-1']),
      'result-cc': createValidResultCC('LTP-1', 0)
    };
    const result = p1CalculateUtilization(input);
    expect(result).toBe(ERRORS.UTILIZATION_COULDNT_ADD);
  });

  test('Large Data Values (String to Number)', () => {
    const input = {
      'historical-performance-data': {
        'granularity-period': 'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
        'period-end-time': '2026-04-01T06:00:00Z',
        'performance-data': { 'total-bytes-output': '900000000', 'time-period': 900 }
      },
      'aggregation-group': createValidAggGroup(['LTP-1']),
      'result-cc': createValidResultCC('LTP-1', 1000, '2026-04-01T06:00:00Z')
    };
    const result = p1CalculateUtilization(input);
    expect(result['historical-performance-data']['performance-data']['utilization']).toBe(800);
  });

  test('should not mutate the original input object (Deep Copy Check)', () => {
    const input = {
      'historical-performance-data': createValidHistoricalData(),
      'aggregation-group': createValidAggGroup(['LTP-1']),
      'result-cc': createValidResultCC('LTP-1', 1000)
    };
    const inputCopy = JSON.parse(JSON.stringify(input));
    p1CalculateUtilization(input);
    expect(input).toEqual(inputCopy);
    expect(input['historical-performance-data']['performance-data']['utilization']).toBeUndefined();
  });

  describe('Multi-LTP Aggregation Tests', () => {
    test('should aggregate capacity from multiple LTPs in dataset', () => {
      const histFile = fs.readFileSync(__dirname + '/datasets/ethHistoricalPerf_multiLtp.json', 'utf8');
      const perfData = JSON.parse(histFile);
      const ccFile = fs.readFileSync(__dirname + '/datasets/resultCC_multiLtp.json', 'utf8');
      const resCC = JSON.parse(ccFile);

      const inputStruct = {
        'historical-performance-data': perfData,
        'aggregation-group': {
          'physical-server-ltp-list': ['LTP-AIR-1', 'LTP-AIR-2', 'LTP-AIR-3']
        },
        'result-cc': resCC
      };

      const result = p1CalculateUtilization(inputStruct);
      expect(result['historical-performance-data']['performance-data']['total-air-interface-interval-capacity']).toBe(1500);
    });

    test('should exclude LTPs not in physical-server-ltp-list', () => {
      const histFile = fs.readFileSync(__dirname + '/datasets/ethHistoricalPerf_multiLtp.json', 'utf8');
      const perfData = JSON.parse(histFile);
      const ccFile = fs.readFileSync(__dirname + '/datasets/resultCC_multiLtp.json', 'utf8');
      const resCC = JSON.parse(ccFile);

      const inputStruct = {
        'historical-performance-data': perfData,
        'aggregation-group': {
          'physical-server-ltp-list': ['LTP-AIR-1', 'LTP-AIR-2']
        },
        'result-cc': resCC
      };

      const result = p1CalculateUtilization(inputStruct);
      expect(result['historical-performance-data']['performance-data']['total-air-interface-interval-capacity']).toBe(1100);
      // 1125000 * 8 / (1100 * 1000 * 900) * 100 = 0.909
      expect(result['historical-performance-data']['performance-data']['utilization']).toBe(0);
    });
  });

  describe('Timestamp Format Matching Tests', () => {
    test('should match period-end-time with Z suffix format', () => {
      const input = {
        'historical-performance-data': {
          'granularity-period': 'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
          'period-end-time': '2026-04-01T06:00:00Z',
          'performance-data': { 'total-bytes-output': '9000000', 'time-period': 900 }
        },
        'aggregation-group': createValidAggGroup(['LTP-1']),
        'result-cc': createValidResultCC('LTP-1', 1000, '2026-04-01T06:00:00Z')
      };

      const result = p1CalculateUtilization(input);
      expect(result['historical-performance-data']['performance-data']['total-air-interface-interval-capacity']).toBe(1000);
      expect(result['historical-performance-data']['performance-data']['utilization']).toBe(8);
    });

    test('should match period-end-time with +00:00 timezone format', () => {
      const input = {
        'historical-performance-data': {
          'granularity-period': 'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
          'period-end-time': '2026-04-01T06:00:00.0+00:00',
          'performance-data': { 'total-bytes-output': '9000000', 'time-period': 900 }
        },
        'aggregation-group': createValidAggGroup(['LTP-1']),
        'result-cc': createValidResultCC('LTP-1', 1000, '2026-04-01T06:00:00.0+00:00')
      };

      const result = p1CalculateUtilization(input);
      expect(result['historical-performance-data']['performance-data']['total-air-interface-interval-capacity']).toBe(1000);
      expect(result['historical-performance-data']['performance-data']['utilization']).toBe(8);
    });

    test.each(['2026-04-01T06:00:00Z', '2026-04-01T08:00:00+02:00'])('should match the same instant written as %p', time => {
      const input = {
        'historical-performance-data': {
          'granularity-period': 'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
          'period-end-time': '2026-04-01T06:00:00.0+00:00',
          'performance-data': { 'total-bytes-output': '9000000', 'time-period': 900 }
        },
        'aggregation-group': createValidAggGroup(['LTP-1']),
        'result-cc': createValidResultCC('LTP-1', 1000, time)
      };

      const result = p1CalculateUtilization(input);
      expect(result['historical-performance-data']['performance-data']['total-air-interface-interval-capacity']).toBe(1000);
    });

    test('should use real dataset timestamps correctly', () => {
      const histFile = fs.readFileSync(__dirname + '/datasets/ethHistoricalPerf.json', 'utf8');
      const perfData = JSON.parse(histFile);
      const ccFile = fs.readFileSync(__dirname + '/datasets/resultCC2.json', 'utf8');
      const resCC = JSON.parse(ccFile);

      const inputStruct = {
        'historical-performance-data': perfData,
        'aggregation-group': {
          'physical-server-ltp-list': ['LTP-MWPS-TTP-ODU-B']
        },
        'result-cc': resCC
      };

      const result = p1CalculateUtilization(inputStruct);
      expect(result['historical-performance-data']['performance-data']['total-air-interface-interval-capacity']).toBe(1000);
    });
  });

  describe('period-end-time selection of the AirInterface record', () => {
    const record = (time, capacity, granularity = 'air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN') => ({
      'period-end-time': time,
      'granularity-period': granularity,
      'performance-data': { 'interval-capacity': capacity }
    });

    const resultCcWithRecords = (...records) => {
      const resultCc = createValidResultCC('LTP-1');
      resultCc['logical-termination-point'][0]['layer-protocol'][0]['air-interface-2-0:air-interface-pac']
        ['air-interface-historical-performances']['historical-performance-data-list'] = records;
      return resultCc;
    };

    const capacityOf = resultCc => p1CalculateUtilization({
      'historical-performance-data': createValidHistoricalData(),
      'aggregation-group': createValidAggGroup(['LTP-1']),
      'result-cc': resultCc
    })['historical-performance-data']['performance-data']['total-air-interface-interval-capacity'];

    test('uses only the record of the slice among the stored 15-min records', () => {
      expect(capacityOf(resultCcWithRecords(
        record('2026-04-01T05:45:00.0+00:00', 100),
        record('2026-04-01T06:00:00.0+00:00', 1000),
        record('2026-04-01T06:15:00.0+00:00', 10000)
      ))).toBe(1000);
    });

    test('ignores a 24-hours record with the same period-end-time', () => {
      expect(capacityOf(resultCcWithRecords(
        record('2026-04-01T06:00:00.0+00:00', 5000, 'air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS'),
        record('2026-04-01T06:00:00.0+00:00', 1000)
      ))).toBe(1000);
    });

    test('counts the record once when the key appears in two formats', () => {
      expect(capacityOf(resultCcWithRecords(
        record('2026-04-01T06:00:00.0+00:00', 1000),
        record('2026-04-01T06:00:00Z', 1000)
      ))).toBe(1000);
    });

    test('sums the AirInterfaces of the group that hold a record for the slice', () => {
      const resultCc = createValidResultCC('LTP-1', 1000);
      resultCc['logical-termination-point'].push(
        createValidResultCC('LTP-2', 500)['logical-termination-point'][0],
        createValidResultCC('LTP-3', 700, '2026-04-01T05:45:00.0+00:00')['logical-termination-point'][0]
      );
      const result = p1CalculateUtilization({
        'historical-performance-data': createValidHistoricalData(),
        'aggregation-group': createValidAggGroup(['LTP-1', 'LTP-2', 'LTP-3']),
        'result-cc': resultCc
      });
      expect(result['historical-performance-data']['performance-data']['total-air-interface-interval-capacity']).toBe(1500);
    });

    test.each(['abc', '2026-04-01', 20260401])('rejects the slice period-end-time %p', time => {
      const input = {
        'historical-performance-data': { ...createValidHistoricalData(), 'period-end-time': time },
        'aggregation-group': createValidAggGroup(['LTP-1']),
        'result-cc': createValidResultCC('LTP-1', 1000)
      };
      expect(p1CalculateUtilization(input)).toBe(ERRORS.UTILIZATION_COULDNT_ADD);
    });

    test('rejects a slice period-end-time without offset', () => {
      const time = '2026-04-01T06:00:00';
      // The record carries the local-time reading of the value, in any time zone
      const input = {
        'historical-performance-data': { ...createValidHistoricalData(), 'period-end-time': time },
        'aggregation-group': createValidAggGroup(['LTP-1']),
        'result-cc': createValidResultCC('LTP-1', 1000, new Date(time).toISOString())
      };
      expect(p1CalculateUtilization(input)).toBe(ERRORS.UTILIZATION_COULDNT_ADD);
    });

    test('keeps a 24-hours slice unchanged whatever its period-end-time', () => {
      const histData = {
        ...createValidHistoricalData('ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS'),
        'period-end-time': 'abc'
      };
      const result = p1CalculateUtilization({
        'historical-performance-data': histData,
        'aggregation-group': createValidAggGroup(['LTP-1']),
        'result-cc': createValidResultCC('LTP-1', 1000)
      });
      expect(result['historical-performance-data']).toEqual(histData);
    });
  });



  describe('Granularity Passthrough Tests', () => {
    test('should return unchanged for 24-HOURS granularity using dataset', () => {
      const histFile = fs.readFileSync(__dirname + '/datasets/ethHistoricalPerf_24h.json', 'utf8');
      const perfData = JSON.parse(histFile);
      const ccFile = fs.readFileSync(__dirname + '/datasets/resultCC_singleLtp.json', 'utf8');
      const resCC = JSON.parse(ccFile);

      const inputStruct = {
        'historical-performance-data': perfData,
        'aggregation-group': { 'physical-server-ltp-list': ['LTP-AIR-1'] },
        'result-cc': resCC
      };

      const result = p1CalculateUtilization(inputStruct);
      expect(result['historical-performance-data']).toEqual(perfData);
      expect(result['historical-performance-data']['performance-data']['utilization']).toBeUndefined();
      expect(result['historical-performance-data']['performance-data']['total-air-interface-interval-capacity']).toBeUndefined();
    });

    test('should return unchanged for UNKNOWN granularity using dataset', () => {
      const histFile = fs.readFileSync(__dirname + '/datasets/ethHistoricalPerf_unknown.json', 'utf8');
      const perfData = JSON.parse(histFile);
      const ccFile = fs.readFileSync(__dirname + '/datasets/resultCC_singleLtp.json', 'utf8');
      const resCC = JSON.parse(ccFile);

      const inputStruct = {
        'historical-performance-data': perfData,
        'aggregation-group': { 'physical-server-ltp-list': ['LTP-AIR-1'] },
        'result-cc': resCC
      };

      const result = p1CalculateUtilization(inputStruct);
      expect(result['historical-performance-data']).toEqual(perfData);
      expect(result['historical-performance-data']['performance-data']['utilization']).toBe(50);
    });
  });

  describe('Edge Case Tests', () => {
    test('should handle zero capacity with dataset, Utilization could not be added', () => {
      const histFile = fs.readFileSync(__dirname + '/datasets/ethHistoricalPerf_edgeCase.json', 'utf8');
      const perfData = JSON.parse(histFile);
      const ccFile = fs.readFileSync(__dirname + '/datasets/resultCC_zeroCapacity.json', 'utf8');
      const resCC = JSON.parse(ccFile);

      const inputStruct = {
        'historical-performance-data': perfData,
        'aggregation-group': { 'physical-server-ltp-list': ['LTP-AIR-1'] },
        'result-cc': resCC
      };

      const result = p1CalculateUtilization(inputStruct);
      expect(result).toBe(ERRORS.UTILIZATION_COULDNT_ADD);
    });

    test('should handle very high utilization (>100%)', () => {
      const input = {
        'historical-performance-data': {
          'granularity-period': 'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
          'period-end-time': '2026-04-01T06:00:00.0+00:00',
          'performance-data': { 'total-bytes-output': '900000000', 'time-period': 900 }
        },
        'aggregation-group': createValidAggGroup(['LTP-1']),
        'result-cc': createValidResultCC('LTP-1', 1000, '2026-04-01T06:00:00.0+00:00')
      };

      const result = p1CalculateUtilization(input);
      expect(result['historical-performance-data']['performance-data']['utilization']).toBe(800);
      expect(result['historical-performance-data']['performance-data']['utilization']).toBeGreaterThan(100);
    });

    test('should handle empty physical-server-ltp-list', () => {
      const input = {
        'historical-performance-data': createValidHistoricalData(),
        'aggregation-group': { 'physical-server-ltp-list': [] },
        'result-cc': createValidResultCC()
      };

      const result = p1CalculateUtilization(input);
      expect(result).toBe(ERRORS.AGG_GROUP_INVALID);
    });

    test('should handle null layer-protocol array in LTP', () => {
      const input = {
        'historical-performance-data': createValidHistoricalData(),
        'aggregation-group': createValidAggGroup(['LTP-1']),
        'result-cc': {
          'logical-termination-point': [{
            'uuid': 'LTP-1',
            'layer-protocol': null
          }]
        }
      };

      const result = p1CalculateUtilization(input);
      expect(result).toBe(ERRORS.RESULT_CC_INVALID);
    });
  });

});


describe('single-server EthernetContainer (datasets/singleServerEc_fixture.json)', () => {
  // Pre-production data, document 121252295. Stored LTP uuids carry the
  // mount-name prefix ("121252295+LTP-...") while client-ltp / server-ltp
  // references do not ("LTP-..."). The serving structure of the fixture is
  // synthetic: the stored v1.0 ResultCC does not contain it.
  const fixture = require('./datasets/singleServerEc_fixture.json');
  const extract = require('./datasets/singleServerEc_preprodExtract.json');
  const EXPECTED = fixture['expected-output'];

  const EC_UUID = '121252295+LTP-ETC-TTP-PORT-A';
  const STRUCTURE_UUID = '121252295+LTP-MWS-RADIO-1A';
  const STRUCTURE_REF = 'LTP-MWS-RADIO-1A';
  const AIR_UUID = '121252295+LTP-MWPS-TTP-RADIO-1A';
  const AIR_REF = 'LTP-MWPS-TTP-RADIO-1A';
  const AIR_CAPACITY = 350609;
  const TOTAL_BYTES_OUTPUT = 3453552994;

  const utilizationFor = capacity => Math.floor(TOTAL_BYTES_OUTPUT * 8 / (capacity * 1000 * 900) * 100);
  const clone = value => JSON.parse(JSON.stringify(value));

  let input;
  beforeEach(() => { input = clone(fixture.input); });

  const ltps = () => input['result-cc']['logical-termination-point'];
  const ltp = uuid => ltps().find(item => item.uuid === uuid);
  const performanceData = result => result['historical-performance-data']['performance-data'];

  function removeSyntheticStructure() {
    input['result-cc']['logical-termination-point'] = ltps().filter(item => item.uuid !== STRUCTURE_UUID);
  }

  // Second serving structure "1B" with its own AirInterface (same capacity)
  function addSecondServingStructure({ structurePresent }) {
    ltp(EC_UUID)['server-ltp'].push('LTP-MWS-RADIO-1B');
    if (structurePresent) {
      ltps().push({
        uuid: '121252295+LTP-MWS-RADIO-1B',
        'server-ltp': ['LTP-MWPS-TTP-RADIO-1B'],
        'layer-protocol': []
      });
    }
    const airInterface = clone(ltp(AIR_UUID));
    airInterface.uuid = '121252295+LTP-MWPS-TTP-RADIO-1B';
    airInterface['client-ltp'] = ['LTP-MWS-RADIO-1B'];
    ltps().push(airInterface);
  }

  test('the fixture describes the expected calculation', () => {
    expect(ltp(EC_UUID)['server-ltp']).toEqual([STRUCTURE_REF]);
    expect(ltp(STRUCTURE_UUID)['server-ltp']).toEqual([AIR_REF]);
    expect(ltp(AIR_UUID)['client-ltp']).toEqual([STRUCTURE_REF]);
    expect(performanceData(EXPECTED)).toMatchObject({
      'total-air-interface-interval-capacity': AIR_CAPACITY,
      utilization: utilizationFor(AIR_CAPACITY)
    });
  });

  describe('serving structure present in result-cc', () => {
    test.each([undefined, null])('resolves the physical server when group is %p', group => {
      if (group !== undefined) input['aggregation-group'] = group;
      const original = clone(input);
      expect(p1CalculateUtilization(input)).toEqual(EXPECTED);
      expect(input).toEqual(original);
    });

    test('uses the first physical server of each serving structure', () => {
      addSecondServingStructure({ structurePresent: true });
      ltp('121252295+LTP-MWS-RADIO-1B')['server-ltp'].push('IGNORED');
      expect(performanceData(p1CalculateUtilization(input))).toMatchObject({
        'total-air-interface-interval-capacity': 2 * AIR_CAPACITY,
        utilization: utilizationFor(2 * AIR_CAPACITY)
      });
    });

    test('uses only server-ltp[0] when a structure lists several servers', () => {
      const standby = clone(ltp(AIR_UUID));
      standby.uuid = '121252295+LTP-MWPS-TTP-RADIO-1A-STANDBY';
      ltps().push(standby);
      ltp(STRUCTURE_UUID)['server-ltp'].push('LTP-MWPS-TTP-RADIO-1A-STANDBY');
      expect(p1CalculateUtilization(input)).toEqual(EXPECTED);
    });

    test('an LTP without layer protocols does not invalidate result-cc', () => {
      expect(ltp(STRUCTURE_UUID)['layer-protocol']).toEqual([]);
      input['aggregation-group'] = { 'physical-server-ltp-list': [AIR_UUID] };
      expect(p1CalculateUtilization(input)).toEqual(EXPECTED);
    });

    test.each(['missing-structure', 'empty-structure-list', 'invalid-structure-list',
      'empty-server-list', 'invalid-server-list', 'missing-physical-server'])('rejects incomplete topology: %s', failure => {
      if (failure === 'missing-structure') ltp(EC_UUID)['server-ltp'] = ['missing'];
      if (failure === 'empty-structure-list') ltp(EC_UUID)['server-ltp'] = [];
      if (failure === 'invalid-structure-list') ltp(EC_UUID)['server-ltp'] = STRUCTURE_REF;
      if (failure === 'empty-server-list') ltp(STRUCTURE_UUID)['server-ltp'] = [];
      if (failure === 'invalid-server-list') ltp(STRUCTURE_UUID)['server-ltp'] = AIR_REF;
      if (failure === 'missing-physical-server') ltp(STRUCTURE_UUID)['server-ltp'] = ['missing'];
      const original = clone(input);
      expect(p1CalculateUtilization(input)).toBe(ERRORS.UTILIZATION_COULDNT_ADD);
      expect(input).toEqual(original);
    });
  });

  describe('serving structure removed by p1FieldsFilter (stored v1.0 ResultCC shape)', () => {
    beforeEach(() => { removeSyntheticStructure(); });

    test.each([undefined, null])('resolves the AirInterface through its client-ltp when group is %p', group => {
      if (group !== undefined) input['aggregation-group'] = group;
      const original = clone(input);
      expect(p1CalculateUtilization(input)).toEqual(EXPECTED);
      expect(input).toEqual(original);
    });

    test('result agrees with the pre-production extract', () => {
      const result = performanceData(p1CalculateUtilization(input));
      expect(result['total-air-interface-interval-capacity']).toBe(extract.expected['total-air-interface-interval-capacity']);
      // utilization is an integer percentage (interface.yaml), rounded down
      expect(result.utilization).toBe(Math.floor(extract.expected['utilization-percent']));
      const extractEc = extract['result-cc-extract']['logical-termination-point'][0];
      expect(ltp(EC_UUID).uuid).toBe(extract['uuid-of-ethernet-container']);
      expect(ltp(EC_UUID)['server-ltp']).toEqual(extractEc['server-ltp']);
    });

    test('accepts a scalar client-ltp reference', () => {
      ltp(AIR_UUID)['client-ltp'] = STRUCTURE_REF;
      expect(p1CalculateUtilization(input)).toEqual(EXPECTED);
    });

    test('aggregates one AirInterface per filtered structure', () => {
      addSecondServingStructure({ structurePresent: false });
      expect(performanceData(p1CalculateUtilization(input))).toMatchObject({
        'total-air-interface-interval-capacity': 2 * AIR_CAPACITY,
        utilization: utilizationFor(2 * AIR_CAPACITY)
      });
    });

    test('mixes present and filtered structures', () => {
      addSecondServingStructure({ structurePresent: true });
      expect(performanceData(p1CalculateUtilization(input))).toMatchObject({
        'total-air-interface-interval-capacity': 2 * AIR_CAPACITY,
        utilization: utilizationFor(2 * AIR_CAPACITY)
      });
    });

    test('ignores AirInterfaces serving other structures', () => {
      const other = clone(ltp(AIR_UUID));
      other.uuid = '121252295+LTP-MWPS-TTP-RADIO-2A';
      other['client-ltp'] = ['LTP-MWS-RADIO-2A'];
      ltps().push(other);
      expect(p1CalculateUtilization(input)).toEqual(EXPECTED);
    });

    test('counts one physical server per serving structure (1+1 protection)', () => {
      // A serving structure lists several servers only where one is active at a
      // time; the spec takes server-ltp[0], so the pair must not be summed.
      const standby = clone(ltp(AIR_UUID));
      standby.uuid = '121252295+LTP-MWPS-TTP-RADIO-1A-STANDBY';
      ltps().push(standby);
      expect(p1CalculateUtilization(input)).toEqual(EXPECTED);
    });

    test('does not count the same AirInterface twice', () => {
      ltp(EC_UUID)['server-ltp'].push('LTP-MWS-RADIO-1B');
      ltp(AIR_UUID)['client-ltp'].push('LTP-MWS-RADIO-1B');
      expect(p1CalculateUtilization(input)).toEqual(EXPECTED);
    });

    test('fails predictably when no LTP references the filtered structure', () => {
      ltp(AIR_UUID)['client-ltp'] = ['LTP-MWS-RADIO-1B'];
      const original = clone(input);
      expect(p1CalculateUtilization(input)).toBe(ERRORS.UTILIZATION_COULDNT_ADD);
      expect(input).toEqual(original);
    });

    test.each(['24-HOURS', 'UNKNOWN', 'NOT_YET_DEFINED'])('preserves %s passthrough without a group', period => {
      input['historical-performance-data']['granularity-period'] =
        'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-' + period;
      expect(p1CalculateUtilization(input)['historical-performance-data'])
        .toEqual(input['historical-performance-data']);
    });
  });

  describe('mount-name prefix', () => {
    beforeEach(() => { removeSyntheticStructure(); });

    test('accepts the EthernetContainer UUID without prefix', () => {
      input['uuid-of-ethernet-container'] = 'LTP-ETC-TTP-PORT-A';
      expect(p1CalculateUtilization(input)).toEqual(EXPECTED);
    });

    test('tolerates a prefixed reference', () => {
      ltp(EC_UUID)['server-ltp'] = [STRUCTURE_UUID];
      expect(p1CalculateUtilization(input)).toEqual(EXPECTED);
    });

    test.each([[AIR_REF], [AIR_UUID]])('matches an aggregation group physical-server-ltp-list %p', reference => {
      // createAggregationGroupList builds the list from server-ltp references (no prefix)
      input['aggregation-group'] = { 'physical-server-ltp-list': [reference] };
      expect(p1CalculateUtilization(input)).toEqual(EXPECTED);
    });
  });

  describe('input validation without a group', () => {
    test('explicit aggregation group takes precedence and does not require UUID', () => {
      input['aggregation-group'] = { 'physical-server-ltp-list': [AIR_UUID] };
      delete input['uuid-of-ethernet-container'];
      delete ltp(EC_UUID)['server-ltp'];
      expect(p1CalculateUtilization(input)).toEqual(EXPECTED);
    });

    test.each([{}, [], false, 1, 'group',
      { 'physical-server-ltp-list': [] }, { 'physical-server-ltp-list': AIR_UUID },
      { 'physical-server-ltp-list': [null] }, { 'physical-server-ltp-list': [''] },
      { 'physical-server-ltp-list': [' '] }, { 'physical-server-ltp-list': [123] }
    ])('rejects malformed supplied group %p even with valid fallback topology', group => {
      input['aggregation-group'] = group;
      expect(p1CalculateUtilization(input)).toBe(ERRORS.AGG_GROUP_INVALID);
    });

    test.each([
      [undefined, undefined], [undefined, null], [null, undefined], [null, null]
    ])('returns missing-group error when group %p and UUID %p are absent', (group, uuid) => {
      if (group !== undefined) input['aggregation-group'] = group;
      if (uuid === undefined) delete input['uuid-of-ethernet-container'];
      else input['uuid-of-ethernet-container'] = uuid;
      expect(p1CalculateUtilization(input)).toBe(ERRORS.AGG_GROUP_NOT_PROVIDED);
    });

    test.each(['', ' ', 42, 'missing'])('fails predictably for UUID %p without a group', uuid => {
      input['uuid-of-ethernet-container'] = uuid;
      expect(p1CalculateUtilization(input)).toBe(ERRORS.UTILIZATION_COULDNT_ADD);
    });

    test.each([undefined, null, {}])('validates result CC %p without a group', resultCc => {
      input['result-cc'] = resultCc;
      expect(p1CalculateUtilization(input)).toBe(resultCc == null ? ERRORS.RESULT_CC_NOT_PROVIDED : ERRORS.RESULT_CC_INVALID);
    });
  });
});

describe('real device control construct through the raw-cc fields filter', () => {
  const { applyFieldsFilter } = require('../../utils/fieldsFilter');
  // Same string as the "raw-cc" fieldsFilter StringProfile in server/database/config.json
  const RAW_CC_FIELDS_FILTER =
    'equipment-augment-1-0:control-construct-pac(external-label;device-model-name);' +
    'equipment(uuid;actual-equipment(local-id;physical-properties;structure));' +
    'core-model-1-4:profile-collection(profile(uuid;profile-name;layer-1-aggregation-profile-1-0:layer-1-aggregation-profile-pac(layer-1-aggregation-profile-configuration(client-ltp;server-ltp-list))));' +
    'logical-termination-point(uuid;client-ltp;server-ltp;ltp-augment-1-0:ltp-augment-pac(external-label;original-ltp-name);' +
    'layer-protocol(local-id;layer-protocol-name;' +
    'air-interface-2-0:air-interface-pac(air-interface-configuration(transmission-mode-min;transmission-mode-max;tx-power;atpc-is-on;atpc-thresh-upper;atpc-thresh-lower);air-interface-capability(transmission-mode-list);air-interface-current-performance(current-performance-data-list(granularity-period;timestamp));air-interface-historical-performances);' +
    'ethernet-container-2-0:ethernet-container-pac(ethernet-container-historical-performances)))';

  const ethernetContainerOnRadio = 'LTP-ETC-TTP-ODU-A';
  const airInterfaces = ['LTP-MWPS-TTP-ODU-A', 'LTP-MWPS-TTP-ODU-B'];

  function loadFilteredResultCc() {
    const rawCc = JSON.parse(fs.readFileSync(__dirname + '/datasets/resultCC1.json', 'utf8'));
    const resultCc = applyFieldsFilter(rawCc, RAW_CC_FIELDS_FILTER);
    // In the real flow the AirInterfaces are iterated first and every 15-min
    // slice gets its interval-capacity; a few raw records of this dump lack it
    // and would make result-cc invalid for p1CalculateUtilization.
    for (const ltp of resultCc['logical-termination-point']) {
      for (const layerProtocol of ltp['layer-protocol']) {
        const historicalPerformances = layerProtocol['air-interface-2-0:air-interface-pac']?.['air-interface-historical-performances'];
        if (historicalPerformances) {
          historicalPerformances['historical-performance-data-list'] = historicalPerformances['historical-performance-data-list']
            .filter(record => Object.hasOwn(record['performance-data'], 'interval-capacity'));
        }
      }
    }
    return resultCc;
  }

  // interval-capacity of the 15-min record at periodEndTime
  function airInterfaceCapacity(resultCc, uuid, periodEndTime) {
    const ltp = resultCc['logical-termination-point'].find(item => item.uuid === uuid);
    return ltp['layer-protocol']
      .flatMap(lp => lp['air-interface-2-0:air-interface-pac']['air-interface-historical-performances']['historical-performance-data-list'])
      .filter(record => record['granularity-period'].endsWith('PERIOD-15-MIN') &&
        Date.parse(record['period-end-time']) === Date.parse(periodEndTime))
      .reduce((sum, record) => sum + record['performance-data']['interval-capacity'], 0);
  }

  test('the filter removes the structure LTPs but keeps the client-ltp back-references', () => {
    const resultCc = loadFilteredResultCc();
    const uuids = resultCc['logical-termination-point'].map(ltp => ltp.uuid);
    expect(uuids).not.toContain('LTP-MWS-ODU-A');
    expect(uuids).not.toContain('LTP-MWS-ODU-B');
    expect(uuids).toEqual(expect.arrayContaining([ethernetContainerOnRadio, ...airInterfaces]));
    const ec = resultCc['logical-termination-point'].find(ltp => ltp.uuid === ethernetContainerOnRadio);
    expect(ec['server-ltp']).toEqual(['LTP-MWS-ODU-A', 'LTP-MWS-ODU-B']);
  });

  test('resolves the transporting AirInterfaces of an EthernetContainer without aggregation group', () => {
    const resultCc = loadFilteredResultCc();
    const periodEndTime = '2026-04-01T06:00:00Z';
    const expectedCapacity = airInterfaces.reduce((sum, uuid) => sum + airInterfaceCapacity(resultCc, uuid, periodEndTime), 0);
    expect(expectedCapacity).toBe(1000);

    const result = p1CalculateUtilization({
      'historical-performance-data': {
        'granularity-period': 'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
        'period-end-time': periodEndTime,
        'performance-data': { 'total-bytes-output': '9000000', 'time-period': 900 }
      },
      'aggregation-group': null,
      'result-cc': resultCc,
      'uuid-of-ethernet-container': ethernetContainerOnRadio
    });
    expect(result['historical-performance-data']['performance-data']['total-air-interface-interval-capacity']).toBe(expectedCapacity);
    // 9000000 * 8 / (1000 * 1000 * 900) * 100
    expect(result['historical-performance-data']['performance-data'].utilization).toBe(8);
  });

  test('an EthernetContainer transported by wire interfaces only cannot get a utilization', () => {
    const resultCc = loadFilteredResultCc();
    const result = p1CalculateUtilization({
      'historical-performance-data': {
        'granularity-period': 'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
        'period-end-time': '2026-04-01T06:00:00Z',
        'performance-data': { 'total-bytes-output': '900000', 'time-period': 900 }
      },
      'aggregation-group': null,
      'result-cc': resultCc,
      'uuid-of-ethernet-container': 'LTP-ETC-TTP-LAN-1-XG-SFP'
    });
    expect(result).toBe(ERRORS.UTILIZATION_COULDNT_ADD);
  });
});


describe('utilization inputs and AirInterface records', () => {
  const PERIOD_END_TIME = '2026-04-01T06:00:00.0+00:00';

  const record = (capacity, time = PERIOD_END_TIME) => ({
    'period-end-time': time,
    'granularity-period': 'air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
    'performance-data': { 'interval-capacity': capacity }
  });
  const airInterface = (uuid, records) => ({
    uuid,
    'layer-protocol': [{
      'local-id': 'LP-1',
      'layer-protocol-name': 'air-interface-2-0:LAYER_PROTOCOL_NAME_TYPE_AIR_LAYER',
      'air-interface-2-0:air-interface-pac': {
        'air-interface-historical-performances': { 'historical-performance-data-list': records }
      }
    }]
  });
  const input = ({ performanceData = {}, ltps = [airInterface('LTP-1', [record(1000)])], servers = ['LTP-1'] } = {}) => ({
    'historical-performance-data': {
      'granularity-period': 'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
      'period-end-time': PERIOD_END_TIME,
      'performance-data': { 'total-bytes-output': '9000000', 'time-period': 900, ...performanceData }
    },
    'aggregation-group': { 'physical-server-ltp-list': servers },
    'result-cc': { 'logical-termination-point': ltps }
  });
  const performanceData = result => result['historical-performance-data']['performance-data'];

  test('utilization is an integer percentage, rounded down', () => {
    expect(performanceData(p1CalculateUtilization(input())).utilization).toBe(8);
    // 8.7557 %
    expect(performanceData(p1CalculateUtilization(input({
      performanceData: { 'total-bytes-output': '3453552994' },
      ltps: [airInterface('LTP-1', [record(350609)])]
    }))).utilization).toBe(8);
  });

  test.each(['abc', '', ' ', ' 123', '-5', '-1', '12.5', '1e6', '0x10', '9223372036854775808',
    -1, 12.5, true, {}, []])('rejects total-bytes-output %p', value => {
    expect(p1CalculateUtilization(input({ performanceData: { 'total-bytes-output': value } })))
      .toBe(ERRORS.UTILIZATION_COULDNT_ADD);
  });

  test.each([['0', 0], ['9000000', 8], [9000000, 8], ['9223372036854775807', 8198552921648]])(
    'accepts total-bytes-output %p', (value, utilization) => {
      expect(performanceData(p1CalculateUtilization(input({ performanceData: { 'total-bytes-output': value } }))).utilization)
        .toBe(utilization);
    });

  test.each(['900', '', 0, -900, 900.5, true, {}])('rejects time-period %p', value => {
    expect(p1CalculateUtilization(input({ performanceData: { 'time-period': value } })))
      .toBe(ERRORS.UTILIZATION_COULDNT_ADD);
  });

  test('accepts a partial measurement interval', () => {
    expect(performanceData(p1CalculateUtilization(input({ performanceData: { 'time-period': 352 } }))).utilization).toBe(20);
  });

  test.each([['32625000', 29], ['64125000', 57], ['65250000', 58], ['112500000', 100]])(
    'exact percentage %p is not rounded down by float arithmetic', (value, utilization) => {
      expect(performanceData(p1CalculateUtilization(input({ performanceData: { 'total-bytes-output': value } }))).utilization)
        .toBe(utilization);
    });

  test.each(['1000', '', -1000, 1000.5, null, true, {}])('rejects interval-capacity %p of a matching record', value => {
    // LTP-2 alone would give a capacity: the invalid record must not be skipped
    const ltps = [airInterface('LTP-1', [record(value)]), airInterface('LTP-2', [record(500)])];
    expect(p1CalculateUtilization(input({ ltps, servers: ['LTP-1', 'LTP-2'] })))
      .toBe(ERRORS.UTILIZATION_COULDNT_ADD);
  });

  test('accepts interval-capacity 0 of an AirInterface in the group', () => {
    const ltps = [airInterface('LTP-1', [record(0)]), airInterface('LTP-2', [record(500)])];
    const result = performanceData(p1CalculateUtilization(input({ ltps, servers: ['LTP-1', 'LTP-2'] })));
    expect(result['total-air-interface-interval-capacity']).toBe(500);
    expect(result.utilization).toBe(16);
  });

  test('ignores invalid records at other times', () => {
    const ltps = [airInterface('LTP-1', [record('abc', '2026-04-01T05:45:00.0+00:00'), record(1000)])];
    expect(performanceData(p1CalculateUtilization(input({ ltps })))['total-air-interface-interval-capacity']).toBe(1000);
  });

  test('an AirInterface without historical-performance-data-list has no record', () => {
    const noList = airInterface('LTP-2', []);
    delete noList['layer-protocol'][0]['air-interface-2-0:air-interface-pac']['air-interface-historical-performances']['historical-performance-data-list'];
    const ltps = [airInterface('LTP-1', [record(1000)]), noList];
    expect(performanceData(p1CalculateUtilization(input({ ltps, servers: ['LTP-1', 'LTP-2'] })))['total-air-interface-interval-capacity'])
      .toBe(1000);
  });

  test.each(['2026-13-01T06:00:00Z', '2026-04-01T06:00:00+0000'])('rejects period-end-time %p', time => {
    const data = input();
    data['historical-performance-data']['period-end-time'] = time;
    expect(p1CalculateUtilization(data)).toBe(ERRORS.UTILIZATION_COULDNT_ADD);
  });

  test('invalid values do not touch the input', () => {
    const data = input({ performanceData: { 'total-bytes-output': 'abc' } });
    const original = JSON.parse(JSON.stringify(data));
    expect(p1CalculateUtilization(data)).toBe(ERRORS.UTILIZATION_COULDNT_ADD);
    expect(data).toEqual(original);
  });
});
