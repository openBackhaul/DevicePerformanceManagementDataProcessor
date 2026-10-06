'use strict';

const iterate = require('./P2IterateEcPmSlices');
const ERRORS = require('./ErrorsEnum');
const inputDataset = require('./datasets/input.json');
const pmRecords = require('./datasets/pmRecords.json');

const clone = value => JSON.parse(JSON.stringify(value));

describe('Input validation and processing with real helpers', () => {

  test.each([undefined, null, [], 'invalid'])('rejects invalid input %p', value => {
    expect(iterate(value)).toBe(ERRORS.GENERAL_ERROR);
  });

  test.each([
    ['parameters', 'PARAMETERS'],
    ['historical-performance-data-list', 'HISTORICAL_DATA_LIST'],
    ['result-cc', 'RESULT_CC'],
    ['interface-status', 'INTERFACE_STATUS']
  ])('validates missing and invalid %s', (field, errorPrefix) => {
    const data = clone(inputDataset);
    delete data[field];
    expect(iterate(data)).toBe(ERRORS[`${errorPrefix}_NOT_PROVIDED`]);
    for (const value of [null, 1, 'invalid']) {
      data[field] = value;
      expect(iterate(data)).toBe(ERRORS[`${errorPrefix}_INVALID`]);
    }
  });

  test.each([
    [undefined, undefined], [undefined, null], [null, undefined], [null, null]
  ])('returns missing-group error when group %p and UUID %p are absent', (group, uuid) => {
    const data = clone(inputDataset);
    if (group === undefined) delete data['aggregation-group'];
    else data['aggregation-group'] = group;
    if (uuid === undefined) delete data['uuid-of-ethernet-container'];
    else data['uuid-of-ethernet-container'] = uuid;
    expect(iterate(data)).toBe(ERRORS.AGGREGATION_GROUP_NOT_PROVIDED);
  });

  test.each([undefined, null, '', ' ', 42])('rejects invalid Ethernet UUID %p', uuid => {
    expect(iterate({ ...clone(inputDataset), 'uuid-of-ethernet-container': uuid })).toBe(ERRORS.GENERAL_ERROR);
  });

  test.each([null, {}, { ...clone(inputDataset['historical-performance-data-list'][0]), 'period-end-time': 'invalid' },
    { ...clone(inputDataset['historical-performance-data-list'][0]), 'period-end-time': null }, { ...clone(inputDataset['historical-performance-data-list'][0]), 'performance-data': [] },
    { ...clone(inputDataset['historical-performance-data-list'][0]), 'granularity-period': 42 }])('rejects malformed slice %p', record => {
    expect(iterate({ ...clone(inputDataset), 'historical-performance-data-list': [record] }))
      .toBe(ERRORS.HISTORICAL_DATA_LIST_INVALID);
  });

  test('accepts an empty batch and returns independent state', () => {
    const data = { ...clone(inputDataset), 'historical-performance-data-list': [] };
    const result = iterate(data);
    expect(result).toEqual({ 'historical-performance-data-list': [], 'interface-status': data['interface-status'] });
    expect(result['interface-status']).not.toBe(data['interface-status']);
  });

  test.each([undefined, null, { 'physical-server-ltp-list': ['AIR-1'] }])(
    'processes real helpers for aggregation group %p without mutating input', group => {
      const data = { ...clone(inputDataset), 'aggregation-group': group };
      const original = structuredClone(data);
      const result = iterate(data);
      expect(Object.keys(result).sort()).toEqual(['historical-performance-data-list', 'interface-status']);
      expect(result['historical-performance-data-list'][0]).toMatchObject({
        'suspect-interval-flag': false,
        'performance-data': {
          'transmit-traffic': 1, 'receive-traffic': 1,
          'frame-loss-input': 5, 'frame-loss-output': 9,
          'total-air-interface-interval-capacity': 10000, utilization: 10
        }
      });
      expect(result['historical-performance-data-list'][0]['performance-data'])
        .not.toHaveProperty('unknown-protocol-frames-input');
      expect(result['interface-status']['15-minute-values-by-day'][0]['15-minute-values-by-hour'][6]['15-minute-values'])
        .toHaveLength(1);
      expect(data).toEqual(original);
    }
  );

  test('rejects a non-object aggregation group', () => {
    expect(iterate({ ...clone(inputDataset), 'aggregation-group': [] })).toBe(ERRORS.AGGREGATION_GROUP_INVALID);
  });

  test.each([true, false])('orders mixed slices and carries state across batches (aggregated: %p)', aggregated => {
    const first = clone(inputDataset);
    if (!aggregated) delete first['aggregation-group'];
    first['historical-performance-data-list'] = clone(pmRecords.firstBatch);
    const firstResult = iterate(first);
    const second = clone(inputDataset);
    if (!aggregated) delete second['aggregation-group'];
    second['interface-status'] = firstResult['interface-status'];
    second['historical-performance-data-list'] = clone(pmRecords.secondBatch);
    const original = clone(second);
    const result = iterate(second);
    const records = result['historical-performance-data-list'];
    expect(records.map(record => record['period-end-time'])).toEqual([
      '2026-04-01T06:30:00Z', '2026-04-01T06:45:00Z', '2026-04-01T23:59:00Z'
    ]);
    expect(records[2]['performance-data']['busy-hour']).toMatchObject({
      throughput: 1000, capacity: 10000, utilization: 10,
      'errored-frames': 8, 'dropped-frames': 12, 'suspicious-result-flag': false,
      'period-end-time-list': [
        '2026-04-01T08:00:00+02:00', '2026-04-01T06:15:00Z',
        '2026-04-01T06:30:00Z', '2026-04-01T06:45:00Z'
      ]
    });
    expect(second).toEqual(original);
  });

  test('retains the newest two days across a month boundary', () => {
    const data = clone(inputDataset);
    data['historical-performance-data-list'] = clone(pmRecords.monthBoundary);
    const result = iterate(data);
    expect(result['interface-status']['15-minute-values-by-day'].map(day => day.day)).toEqual([31, 1]);
  });

  test.each(pmRecords.unknown)('does not update status for unknown period %p', record => {
    const data = clone(inputDataset);
    data['historical-performance-data-list'] = [clone(record)];
    const result = iterate(data);
    expect(result['interface-status']).toEqual(data['interface-status']);
    expect(result['historical-performance-data-list'][0]['performance-data']).not.toHaveProperty('busy-hour');
  });

  test('leaves input intact when a later daily slice has no matching status', () => {
    const data = clone(inputDataset);
    data['historical-performance-data-list'].push(clone(pmRecords.missingStatusDay));
    const original = clone(data);
    expect(iterate(data)).toBe(ERRORS.BUSY_HOUR_CALCULATION_FAILED);
    expect(data).toEqual(original);
  });


  test.each([undefined, null])('resolves topology when aggregation group is absent (%p)', group => {
    const data = clone(inputDataset);
    if (group === undefined) delete data['aggregation-group'];
    else data['aggregation-group'] = group;
    const original = clone(data);
    expect(iterate(data)['historical-performance-data-list'][0]['performance-data'])
      .toMatchObject({ 'total-air-interface-interval-capacity': 10000, utilization: 10 });
    expect(data).toEqual(original);
  });

  test('deepClone JSON fallback also preserves caller input', () => {
    const originalStructuredClone = global.structuredClone;
    try {
      global.structuredClone = undefined;
      const data = clone(inputDataset);
      expect(iterate(data)['historical-performance-data-list']).toHaveLength(1);
      expect(data).toEqual(inputDataset);
    } finally {
      global.structuredClone = originalStructuredClone;
    }
  });

});

describe('Helper call order, payloads, and error handling', () => {
  const helperPaths = {
    kpis: '../../../../../genericFunctions/p1CalculateEthernetKpis/P1CalculateEthernetKpis',
    defaults: '../../../../../genericFunctions/p1RemoveDefaultValues/P1RemoveDefaultValues',
    utilization: '../../../../../genericFunctions/p1CalculateUtilization/P1CalculateUtilization',
    categorize: '../../../../../genericFunctions/p1CategorizeDataVolume/P1CategorizeDataVolume',
    busyHour: '../../../../../genericFunctions/p1CalculateBusyHourPerformanceIndicators/P1CalculateBusyHourPerformanceIndicators'
  };
  const kpis = jest.fn();
  const defaults = jest.fn();
  const utilization = jest.fn();
  const categorize = jest.fn();
  const busyHour = jest.fn();
  let iterate;
  beforeEach(() => {
    jest.resetModules();
    for (const [name, helper] of Object.entries({ kpis, defaults, utilization, categorize, busyHour })) {
      jest.doMock(helperPaths[name], () => helper);
    }
    iterate = require('./P2IterateEcPmSlices');
  });
  afterEach(() => {
    for (const path of Object.values(helperPaths)) jest.dontMock(path);
    jest.resetModules();
  });
  let calls;
  beforeEach(() => {
    jest.resetAllMocks();
    calls = [];
    kpis.mockImplementation(data => {
      calls.push('kpis');
      return { 'historical-performance-data': { ...data['historical-performance-data'], kpi: true } };
    });
    defaults.mockImplementation(data => {
      calls.push('defaults');
      return { 'cleaned-object': { ...data['input-object'], cleaned: true } };
    });
    utilization.mockImplementation(data => {
      calls.push('utilization');
      return { 'historical-performance-data': { ...data['historical-performance-data'], utilized: true } };
    });
    categorize.mockImplementation(data => {
      calls.push('categorize');
      return { 'interface-status': { ...data['interface-status'], count: (data['interface-status'].count || 0) + 1 } };
    });
    busyHour.mockImplementation(data => {
      calls.push('busyHour');
      return { 'historical-performance-data': { ...data['historical-performance-data'], busy: true } };
    });
  });

  test('returns output error if categorization corrupts a processed record', () => {
    const data = clone(inputDataset);
    const original = clone(data);
    categorize.mockImplementation(payload => {
      delete payload['historical-performance-data']['performance-data'];
      return { 'interface-status': payload['interface-status'] };
    });
    expect(iterate(data)).toBe(ERRORS.HISTORICAL_DATA_LIST_PROVIDE_FAILED);
    expect(data).toEqual(original);
  });

  test('returns output error if a later helper corrupts an earlier record', () => {
    const data = clone(inputDataset);
    data['historical-performance-data-list'] = clone(pmRecords.firstBatch);
    let previousRecord;
    categorize.mockImplementation(payload => {
      if (previousRecord) previousRecord['period-end-time'] = null;
      previousRecord = payload['historical-performance-data'];
      return { 'interface-status': payload['interface-status'] };
    });
    expect(iterate(data)).toBe(ERRORS.HISTORICAL_DATA_LIST_PROVIDE_FAILED);
  });

  test('honors payload boundaries, helper replacements, parameters, and accumulated status', () => {
    const data = clone(inputDataset);
    data['aggregation-group'] = { 'physical-server-ltp-list': ['AIR-1'] };
    data['historical-performance-data-list'] = clone(pmRecords.mixed);
    const result = iterate(data);
    expect(calls).toEqual([
      'kpis', 'defaults', 'utilization', 'categorize',
      'kpis', 'defaults', 'utilization', 'categorize',
      'kpis', 'defaults', 'utilization', 'busyHour'
    ]);
    expect(kpis.mock.calls[0][0]).toEqual({
      'historical-performance-data': data['historical-performance-data-list'][2]['performance-data']
    });
    expect(defaults.mock.calls[0][0]).toEqual({
      parameters: data.parameters['sub-function'][0],
      'input-object': { ...data['historical-performance-data-list'][2]['performance-data'], kpi: true }
    });
    expect(utilization.mock.calls[0][0]).toMatchObject({
      'uuid-of-ethernet-container': 'EC-1', 'result-cc': data['result-cc'],
      'aggregation-group': data['aggregation-group'],
      'historical-performance-data': { 'performance-data': { kpi: true, cleaned: true } }
    });
    expect(categorize.mock.calls[1][0]['interface-status'].count).toBe(1);
    expect(busyHour.mock.calls[0][0]).toMatchObject({
      'historical-performance-data': { utilized: true }, 'interface-status': { count: 2 }
    });
    expect(result['historical-performance-data-list'][2]).toMatchObject({ utilized: true, busy: true });
    expect(result['interface-status'].count).toBe(2);
  });

  const steps = [
    [kpis, ERRORS.KPI_CALCULATION_FAILED],
    [defaults, ERRORS.DEFAULT_VALUES_REMOVAL_FAILED],
    [utilization, ERRORS.UTILIZATION_CALCULATION_FAILED],
    [categorize, ERRORS.DATA_VOLUME_CATEGORIZATION_FAILED],
    [busyHour, ERRORS.BUSY_HOUR_CALCULATION_FAILED]
  ];
  for (const [helper, error] of steps) {
    describe(error, () => {
      const invalidResponses = ['helper error', null, undefined, {}, []];
      if (helper !== kpis) invalidResponses.push({ 'historical-performance-data': {} });
      test.each(invalidResponses)(
        'maps malformed/failed response %p and stops the pipeline', response => {
          const data = clone(inputDataset);
          if (helper === busyHour) data['historical-performance-data-list'] = [clone(pmRecords.daily)];
          helper.mockReturnValue(response);
          expect(iterate(data)).toBe(error);
          const later = steps.slice(steps.findIndex(([fn]) => fn === helper) + 1);
          for (const [fn] of later) expect(fn).not.toHaveBeenCalled();
        }
      );
      test('maps exceptions and isolates helper mutations', () => {
        const data = clone(inputDataset);
        if (helper === busyHour) data['historical-performance-data-list'] = [clone(pmRecords.daily)];
        const original = structuredClone(data);
        helper.mockImplementation(payload => {
          Object.values(payload).forEach(value => {
            if (value && typeof value === 'object') value.mutated = true;
          });
          throw new Error('failure');
        });
        expect(iterate(data)).toBe(error);
        expect(data).toEqual(original);
      });
    });
  }

  test.each([undefined, null])('accepts optional group %p and forwards UUID to utilization', group => {
    const data = clone(inputDataset);
    if (group === undefined) delete data['aggregation-group'];
    else data['aggregation-group'] = group;
    const result = iterate(data);
    expect(result['historical-performance-data-list']).toHaveLength(1);
    expect(utilization.mock.calls[0][0]).toMatchObject({
      'aggregation-group': null,
      'uuid-of-ethernet-container': 'EC-1'
    });
  });

});
