
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

  // Time stamp not more required
  // test('should not aggregate if period-end-time does not match', () => {
  //   const input = {
  //     'historical-performance-data': createValidHistoricalData(),
  //     'aggregation-group': createValidAggGroup(['LTP-1']),
  //     'result-cc': createValidResultCC('LTP-1', 1000, 'WRONG-TIME')
  //   };
  //   const result = p1CalculateUtilization(input);
  //   expect(result).toBe(ERRORS.UTILIZATION_COULDNT_ADD);
  // });

  // TODO @latta-siae to be verified
  // test('should return 0 capacity if no LTP matches', () => {
  //   const input = {
  //     'historical-performance-data': createValidHistoricalData(),
  //     'aggregation-group': createValidAggGroup(['UUID-X']),
  //     'result-cc': createValidResultCC('UUID-Y', 1000)
  //   };
  //   const result = p1CalculateUtilization(input);
  //   expect(result['historical-performance-data']['performance-data']['total-air-interface-interval-capacity']).toBe(0);
  // });

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
      expect(result['historical-performance-data']['performance-data']['utilization']).toBeCloseTo(0.89, 1);
    });
  });

  describe('Timestamp Format Matching Tests', () => {
    test('should match period-end-time with Z suffix format', () => {
      const input = {
        'historical-performance-data': {
          'granularity-period': 'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
          'period-end-time': '2026-04-01T06:00:00Z',
          'performance-data': { 'total-bytes-output': '900000', 'time-period': 900 }
        },
        'aggregation-group': createValidAggGroup(['LTP-1']),
        'result-cc': createValidResultCC('LTP-1', 1000, '2026-04-01T06:00:00Z')
      };

      const result = p1CalculateUtilization(input);
      expect(result['historical-performance-data']['performance-data']['total-air-interface-interval-capacity']).toBe(1000);
      expect(result['historical-performance-data']['performance-data']['utilization']).toBe(0.8);
    });

    test('should match period-end-time with +00:00 timezone format', () => {
      const input = {
        'historical-performance-data': {
          'granularity-period': 'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
          'period-end-time': '2026-04-01T06:00:00.0+00:00',
          'performance-data': { 'total-bytes-output': '900000', 'time-period': 900 }
        },
        'aggregation-group': createValidAggGroup(['LTP-1']),
        'result-cc': createValidResultCC('LTP-1', 1000, '2026-04-01T06:00:00.0+00:00')
      };

      const result = p1CalculateUtilization(input);
      expect(result['historical-performance-data']['performance-data']['total-air-interface-interval-capacity']).toBe(1000);
      expect(result['historical-performance-data']['performance-data']['utilization']).toBe(0.8);
    });

    // test('should NOT match when timestamps are semantically equal but format differs', () => {
    //   const input = {
    //     'historical-performance-data': {
    //       'granularity-period': 'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
    //       'period-end-time': '2026-04-01T06:00:00.0+00:00',
    //       'performance-data': { 'total-bytes-output': '900000', 'time-period': 900 }
    //     },
    //     'aggregation-group': createValidAggGroup(['LTP-1']),
    //     'result-cc': createValidResultCC('LTP-1', 1000, '2026-04-01T06:00:00Z')
    //   };

    //   const result = p1CalculateUtilization(input);
    //   // TODO @latta-siae check the result
    //   expect(result['historical-performance-data']['performance-data']['total-air-interface-interval-capacity']).toBe(0);
    // });

    // TO be review
  //   test('should use real dataset timestamps correctly', () => {
  //     const histFile = fs.readFileSync(__dirname + '/datasets/ethHistoricalPerf.json', 'utf8');
  //     const perfData = JSON.parse(histFile);
  //     const ccFile = fs.readFileSync(__dirname + '/datasets/resultCC2.json', 'utf8');
  //     const resCC = JSON.parse(ccFile);

  //     const inputStruct = {
  //       'historical-performance-data': perfData,
  //       'aggregation-group': {
  //         'physical-server-ltp-list': ['LTP-MWPS-TTP-ODU-B']
  //       },
  //       'result-cc': resCC
  //     };

  //     const result = p1CalculateUtilization(inputStruct);
  //     expect(result['historical-performance-data']['performance-data']['total-air-interface-interval-capacity']).toBe(1000);
  //   });
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


describe('optional aggregation group and single-server topology', () => {
  const dataset = require('./datasets/singleServerInput.json');
  let input;
  beforeEach(() => { input = JSON.parse(JSON.stringify(dataset)); });

  test.each([undefined, null])('resolves physical servers when group is %p', group => {
    if (group !== undefined) input['aggregation-group'] = group;
    const original = JSON.parse(JSON.stringify(input));
    const result = p1CalculateUtilization(input);
    expect(result['historical-performance-data']['performance-data']).toMatchObject({
      'total-air-interface-interval-capacity': 10000, utilization: 10
    });
    expect(input).toEqual(original);
  });

  test('uses the first physical server of each serving structure', () => {
    const ltps = input['result-cc']['logical-termination-point'];
    ltps[0]['server-ltp'].push('STRUCTURE-2');
    ltps[1]['server-ltp'].push('IGNORED');
    ltps.push({ ...ltps[1], uuid: 'STRUCTURE-2', 'server-ltp': ['AIR-2'] });
    const air2 = JSON.parse(JSON.stringify(ltps[2]));
    air2.uuid = 'AIR-2';
    ltps.push(air2);
    expect(p1CalculateUtilization(input)['historical-performance-data']['performance-data'])
      .toMatchObject({ 'total-air-interface-interval-capacity': 20000, utilization: 5 });
  });

  test('explicit aggregation group takes precedence and does not require UUID', () => {
    input['aggregation-group'] = { 'physical-server-ltp-list': ['AIR-1'] };
    delete input['uuid-of-ethernet-container'];
    delete input['result-cc']['logical-termination-point'][0]['server-ltp'];
    expect(p1CalculateUtilization(input)['historical-performance-data']['performance-data'].utilization).toBe(10);
  });

  test.each([{}, [], false, 1, 'group',
    { 'physical-server-ltp-list': [] }, { 'physical-server-ltp-list': 'AIR-1' },
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

  test.each(['missing-structure', 'empty-structure-list', 'invalid-structure-list',
    'empty-server-list', 'invalid-server-list', 'missing-physical-server'])('rejects incomplete topology: %s', failure => {
    const ltps = input['result-cc']['logical-termination-point'];
    if (failure === 'missing-structure') ltps[0]['server-ltp'] = ['missing'];
    if (failure === 'empty-structure-list') ltps[0]['server-ltp'] = [];
    if (failure === 'invalid-structure-list') ltps[0]['server-ltp'] = 'STRUCTURE-1';
    if (failure === 'empty-server-list') ltps[1]['server-ltp'] = [];
    if (failure === 'invalid-server-list') ltps[1]['server-ltp'] = 'AIR-1';
    if (failure === 'missing-physical-server') ltps[1]['server-ltp'] = ['missing'];
    const original = JSON.parse(JSON.stringify(input));
    expect(p1CalculateUtilization(input)).toBe(ERRORS.UTILIZATION_COULDNT_ADD);
    expect(input).toEqual(original);
  });

  test.each(['24-HOURS', 'UNKNOWN', 'NOT_YET_DEFINED'])('preserves %s passthrough without a group', period => {
    input['historical-performance-data']['granularity-period'] =
      'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-' + period;
    expect(p1CalculateUtilization(input)['historical-performance-data'])
      .toEqual(input['historical-performance-data']);
  });

  test.each([undefined, null, {}])('validates result CC %p without a group', resultCc => {
    input['result-cc'] = resultCc;
    expect(p1CalculateUtilization(input)).toBe(resultCc == null ? ERRORS.RESULT_CC_NOT_PROVIDED : ERRORS.RESULT_CC_INVALID);
  });
});
