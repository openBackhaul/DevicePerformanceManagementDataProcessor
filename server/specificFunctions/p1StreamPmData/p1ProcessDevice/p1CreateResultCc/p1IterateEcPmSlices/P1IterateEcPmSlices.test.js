const p1IterateEcPmSlices = require('./P1IterateEcPmSlices');
const Errors = require('./ErrorsEnum');
const fs = require('fs');

describe('p1IterateEcPmSlices', () => {
  // let service;
  // let mocks;

  // beforeEach(() => {
  //   mocks = {
  //     kpiService: { calculate: jest.fn() },
  //     removeDefaultService: { clean: jest.fn() },
  //     utilizationService: { calculate: jest.fn() }
  //   };

  //   service = createService(mocks);
  // });

  let historicalData;
  let parameters;
  beforeEach(() => {
    let fileParsed = fs.readFileSync(__dirname + '/datasets/historicalPerfEth1.json', 'utf8');
    historicalData = JSON.parse(fileParsed);
    fileParsed = fs.readFileSync(__dirname + '/datasets/parametersEc.json', 'utf8');
    parameters =  JSON.parse(fileParsed);
  });


  test('Internal Test', () => {


    const input = {
      'parameters': parameters,
      'aggregation-group': {},
      'result-cc': {},
      'historical-performance-data-list': historicalData['ethernet-container-historical-performances']['historical-performance-data-list']
    };

    let res = p1IterateEcPmSlices(input);
    
  });

  // test('should process slices successfully', () => {
  //   const input = {
  //     parameters: {},
  //     'aggregation-group': {},
  //     'result-cc': {},
  //     'historical-performance-data-list': [
  //       {
  //         'granularity-period':
  //           'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
  //         'period-end-time': '2026-01-01T10:00:00Z',
  //         'performance-data': {}
  //       }
  //     ]
  //   };

  //   mocks.kpiService.calculate.mockReturnValue({});
  //   mocks.removeDefaultService.clean.mockReturnValue({});
  //   mocks.utilizationService.calculate.mockReturnValue({});

  //   const result = p1IterateEcPmSlices.execute(input);

  //   expect(result).toBeDefined();
  //   expect(result['historical-performance-data-list']).toHaveLength(1);
  //   expect(result['most-recent-period-end-time']).toBe(
  //     '2026-01-01T10:00:00Z'
  //   );
  // });

  // test('should process 15min slice before 24h slice', () => {
  //   const input = {
  //     parameters: {},
  //     'aggregation-group': {},
  //     'result-cc': {},
  //     'historical-performance-data-list': [
  //       {
  //         'granularity-period':
  //           'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS',
  //         'period-end-time': '2026-01-02T00:00:00Z',
  //         'performance-data': {}
  //       },
  //       {
  //         'granularity-period':
  //           'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
  //         'period-end-time': '2026-01-01T10:00:00Z',
  //         'performance-data': {}
  //       }
  //     ]
  //   };

  //   mocks.kpiService.calculate.mockImplementation((d) => d);
  //   mocks.removeDefaultService.clean.mockImplementation((p, d) => d);
  //   mocks.utilizationService.calculate.mockImplementation((d) => d);

  //   const result = p1IterateEcPmSlices.execute(input);

  //   const list = result['historical-performance-data-list'];

  //   expect(list[0]['granularity-period']).toContain('15-MIN');
  // });

  // test('should throw error when input is null', () => {
  //   expect(() => p1IterateEcPmSlices.execute(null)).toThrow(
  //     Errors.PARAMETERS_NOT_PROVIDED
  //   );
  // });

  // test('should throw error when parameters missing', () => {
  //   expect(() =>
  //     service.execute({
  //       'historical-performance-data-list': []
  //     })
  //   ).toThrow(Errors.PARAMETERS_INVALID);
  // });

  // test('should throw error when historical data list missing', () => {
  //   expect(() =>
  //     service.execute({
  //       parameters: {}
  //     })
  //   ).toThrow(Errors.HISTORICAL_DATA_LIST_NOT_PROVIDED);
  // });

  // test('should throw KPI error', () => {
  //   const input = {
  //     parameters: {},
  //     'aggregation-group': {},
  //     'result-cc': {},
  //     'historical-performance-data-list': [
  //       {
  //         'granularity-period': GRANULARITY_15,
  //         'period-end-time': '2026-01-01T10:00:00Z',
  //         'performance-data': {}
  //       }
  //     ]
  //   };

  //   mocks.kpiService.calculate.mockImplementation(() => {
  //     throw new Error();
  //   });

  //   expect(() => p1IterateEcPmSlices.execute(input)).toThrow(
  //     Errors.KPI_CALCULATION_FAILED
  //   );
  // });

  // test('should throw utilization error', () => {
  //   const input = {
  //     parameters: {},
  //     'aggregation-group': {},
  //     'result-cc': {},
  //     'historical-performance-data-list': [
  //       {
  //         'granularity-period': GRANULARITY_15,
  //         'period-end-time': '2026-01-01T10:00:00Z',
  //         'performance-data': {}
  //       }
  //     ]
  //   };

  //   mocks.kpiService.calculate.mockReturnValue({});
  //   mocks.removeDefaultService.clean.mockReturnValue({});
  //   mocks.utilizationService.calculate.mockImplementation(() => {
  //     throw new Error();
  //   });

  //   expect(() => p1IterateEcPmSlices.execute(input)).toThrow(
  //     Errors.UTILIZATION_CALCULATION_FAILED
  //   );
  // });
});