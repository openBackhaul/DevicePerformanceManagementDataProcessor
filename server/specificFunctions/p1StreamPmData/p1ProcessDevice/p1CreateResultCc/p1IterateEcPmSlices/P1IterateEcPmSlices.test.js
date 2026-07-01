const p1IterateEcPmSlices = require('./P1IterateEcPmSlices');
const ERRORS = require('./ErrorsEnum');
const fs = require('fs');

const GRANU_PERIOD_15M = "ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN";
const GRANU_PERIOD_24H = "ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS";

describe('p1IterateEcPmSlices', () => {
  // TODO
});

describe('p1IterateEcPmSlices - Validate Errors messages', () => {

  let historicalData;
  let parameters;
  let resCC;
  beforeEach(() => {
    let fileParsed = fs.readFileSync(__dirname + '/datasets/parametersEc.json', 'utf8');
    parameters = JSON.parse(fileParsed);
  });

  test('Null input, shoud return General Error', () => {
    const result = p1IterateEcPmSlices(null);
    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.GENERAL_ERROR);
  });

  test('Undefined input, shoud return General Error', () => {
    const result = p1IterateEcPmSlices(undefined);
    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.GENERAL_ERROR);
  });

  test('Empty object as input, shoud return General Error', () => {
    const result = p1IterateEcPmSlices({});
    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.GENERAL_ERROR);
  });

  test('Empty object as input, shoud return General Error', () => {
    const input = {
      'parameters': {},
      'aggregation-group': {},
      'result-cc': {},
      'historical-performance-data-list': []
    };

    const result = p1IterateEcPmSlices({});
    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.GENERAL_ERROR);
  });

  test('Should return Parameters invalid', () => {
    const input = {
      'parameters': {},
      'aggregation-group': {},
      'result-cc': {},
      'historical-performance-data-list': []
    };

    const result = p1IterateEcPmSlices(input);

    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.PARAMETERS_INVALID);
  });

  test('Undefined as Parameters, Should return Parameters not provided', () => {
    const input = {
      'parameters': undefined,
      'aggregation-group': {},
      'result-cc': {},
      'historical-performance-data-list': []
    };

    const result = p1IterateEcPmSlices(input);

    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.PARAMETERS_NOT_PROVIDED);
  });

  test('Array as parameter, Should return Parameters invalid', () => {
    const input = {
      'parameters': [],
      'aggregation-group': {},
      'result-cc': {},
      'historical-performance-data-list': []
    };

    const result = p1IterateEcPmSlices(input);

    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.PARAMETERS_INVALID);
  });


  test('Historical Performance list empty, Should return Historical invalid', () => {
    const input = {
      'parameters': parameters,
      'aggregation-group': {},
      'result-cc': {},
      'historical-performance-data-list': []
      // 'historical-performance-data-list': [
      //   {
      //     'granularity-period':
      //       'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
      //     'period-end-time': '2026-01-01T10:00:00Z',
      //     'performance-data': {}
      //   }
      // ]
    };

    const result = p1IterateEcPmSlices(input);

    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.HISTORICAL_DATA_LIST_INVALID);
  });

  test('Historical Performance list = undefined, Should return historical not provided', () => {
    const input = {
      'parameters': parameters,
      'aggregation-group': {},
      'result-cc': {},
      'historical-performance-data-list': undefined
    };

    const result = p1IterateEcPmSlices(input);

    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.HISTORICAL_DATA_LIST_NOT_PROVIDED);
  });

  test('Historical Performance list not provided, Should return historical PM not provided', () => {
    const input = {
      'parameters': parameters,
      'aggregation-group': {},
      'result-cc': {}
    };

    const result = p1IterateEcPmSlices(input);

    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.HISTORICAL_DATA_LIST_NOT_PROVIDED);
  });

  test('Parameters does not contain default value for function, Should return Default values could not be removed', () => {
    const input = {
      'parameters': {
        "function-name": "p1IterateEcPmSlices",
        "description": "Iterates through all EthernetContainer historical performance data slices and calls the processing Functions",
        "is-active": true,
        "parameter": [],
        "sub-function": [
          {
            "function-name": "p1CalculateEthernetKpis",
            "description": "Adds Ethernet KPIs to the historicalPerformanceData set",
            "is-active": true,
            "parameter": [],
            "sub-function": []
          },
        ]
      },
      'aggregation-group': {},
      'result-cc': {},
      'historical-performance-data-list': [
        {
          'granularity-period': 'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
          'period-end-time': '2026-01-01T10:00:00Z',
          'performance-data': {
            "total-frames-input": "-1",
            "jabber-frames-ingress": -1,
            "multicast-frames-output": 1213,
            "oversized-frames-ingress": -1,
            "broadcast-frames-output": 2459,
            "total-bytes-input": "166574378219",
            "total-bytes-output": "167000040898",
            "total-frames-output": "-1",
            "unicast-frames-input": "109163734",
            "errored-frames-input": 0,
            "multicast-frames-input": 227,
            "fragmented-frames-input": -1,
            "unknown-protocol-frames-input": -1,
            "dropped-frames-output": 0,
            "dropped-frames-input": 0,
            "forwarded-frames-output": "-1",
            "max-bytes-per-second-output": 190912000,
            "unicast-frames-output": "109444263",
            "broadcast-frames-input": 0,
            "errored-frames-output": 0,
            "time-period": 900,
            "undersized-frames-ingress": -1,
            "forwarded-frames-input": "-1"
          }
        }
      ]
    };

    const result = p1IterateEcPmSlices(input);

    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.DEFAULT_VALUES_REMOVAL_FAILED);
  });

  test('Result CC not provided, Should return Utilization could not be calculated', () => {
    const input = {
      'parameters': parameters,
      'aggregation-group': {},
      'result-cc': {},
      'historical-performance-data-list': [
        {
          'granularity-period': 'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
          'period-end-time': '2026-01-01T10:00:00Z',
          'performance-data': {
            "total-frames-input": "-1",
            "jabber-frames-ingress": -1,
            "multicast-frames-output": 1213,
            "oversized-frames-ingress": -1,
            "broadcast-frames-output": 2459,
            "total-bytes-input": "166574378219",
            "total-bytes-output": "167000040898",
            "total-frames-output": "-1",
            "unicast-frames-input": "109163734",
            "errored-frames-input": 0,
            "multicast-frames-input": 227,
            "fragmented-frames-input": -1,
            "unknown-protocol-frames-input": -1,
            "dropped-frames-output": 0,
            "dropped-frames-input": 0,
            "forwarded-frames-output": "-1",
            "max-bytes-per-second-output": 190912000,
            "unicast-frames-output": "109444263",
            "broadcast-frames-input": 0,
            "errored-frames-output": 0,
            "time-period": 900,
            "undersized-frames-ingress": -1,
            "forwarded-frames-input": "-1"
          }
        }
      ]
    };

    const result = p1IterateEcPmSlices(input);

    expect(result).toBeDefined();
    expect(result).toBe(ERRORS.UTILIZATION_CALCULATION_FAILED);
  });
});
