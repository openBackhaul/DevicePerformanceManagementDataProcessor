'use strict';

const p2IterateAiPmSlices = require('./P2IterateAiPmSlices');
const ERRORS = require('./ErrorsEnum');
const fs = require('fs');
const path = require('path');

describe('p2IterateAiPmSlices', () => {
  let validInput;

  beforeEach(() => {
    const dataPath = path.resolve(__dirname, './datasets/dataset.json');
    validInput = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  });

  describe('Input Validation', () => {
    test('returns error if input is null or undefined', async () => {
      const resNull = await p2IterateAiPmSlices(null);
      expect(resNull).toBe(ERRORS.GENERAL_ERROR);

      const resUndef = await p2IterateAiPmSlices(undefined);
      expect(resUndef).toBe(ERRORS.GENERAL_ERROR);
    });

    test('returns error if parameters is null', async () => {
      const res = await p2IterateAiPmSlices({
        'parameters': null,
        'historical-performance-data-list': null,
        'transmission-mode-list': null
      });
      expect(res).toBe(ERRORS.PARAMETERS_INVALID);
    });

    test('returns error if parameters not provided', async () => {
      delete validInput.parameters;
      const res = await p2IterateAiPmSlices(validInput);
      expect(res).toBe(ERRORS.PARAMETERS_NOT_PROVIDED);
    });

    test('returns error if parameters is not an object', async () => {
      validInput.parameters = 'invalid-parameters';
      const resString = await p2IterateAiPmSlices(validInput);
      expect(resString).toBe(ERRORS.PARAMETERS_INVALID);

      validInput.parameters = ['invalid-array'];
      const resArray = await p2IterateAiPmSlices(validInput);
      expect(resArray).toBe(ERRORS.PARAMETERS_INVALID);
    });

    test('returns error if historical-performance-data-list not provided', async () => {
      delete validInput['historical-performance-data-list'];
      const res = await p2IterateAiPmSlices(validInput);
      expect(res).toBe(ERRORS.HISTORICAL_DATA_LIST_NOT_PROVIDED);
    });

    test('returns error if historical-performance-data-list is not an array', async () => {
      validInput['historical-performance-data-list'] = {};
      const res = await p2IterateAiPmSlices(validInput);
      expect(res).toBe(ERRORS.HISTORICAL_DATA_LIST_INVALID);
    });

    test('returns error if transmission-mode-list not provided', async () => {
      delete validInput['transmission-mode-list'];
      const res = await p2IterateAiPmSlices(validInput);
      expect(res).toBe(ERRORS.TRANSMISSION_MODE_LIST_NOT_PROVIDED);
    });

    test('returns error if transmission-mode-list is not an array', async () => {
      validInput['transmission-mode-list'] = 'invalid-transmission-modes';
      const res = await p2IterateAiPmSlices(validInput);
      expect(res).toBe(ERRORS.TRANSMISSION_MODE_LIST_INVALID);
    });

    test('returns error if any PM slice in historical-performance-data-list is invalid', async () => {
      const malformedInput = JSON.parse(JSON.stringify(validInput));
      malformedInput['historical-performance-data-list'].push('not-an-object');
      const res1 = await p2IterateAiPmSlices(malformedInput);
      expect(res1).toBe(ERRORS.HISTORICAL_DATA_LIST_INVALID);

      const missingGranularity = JSON.parse(JSON.stringify(validInput));
      delete missingGranularity['historical-performance-data-list'][0]['granularity-period'];
      const res2 = await p2IterateAiPmSlices(missingGranularity);
      expect(res2).toBe(ERRORS.HISTORICAL_DATA_LIST_INVALID);

      const missingPeriodEndTime = JSON.parse(JSON.stringify(validInput));
      delete missingPeriodEndTime['historical-performance-data-list'][0]['period-end-time'];
      const res3 = await p2IterateAiPmSlices(missingPeriodEndTime);
      expect(res3).toBe(ERRORS.HISTORICAL_DATA_LIST_INVALID);

      const missingPerformanceData = JSON.parse(JSON.stringify(validInput));
      delete missingPerformanceData['historical-performance-data-list'][0]['performance-data'];
      const res4 = await p2IterateAiPmSlices(missingPerformanceData);
      expect(res4).toBe(ERRORS.HISTORICAL_DATA_LIST_INVALID);
    });
  });

  describe('Ordering: 15min slices processed before 24h slices', () => {
    test('sorts 15min slices before 24h slices regardless of initial array order', async () => {
      const inputData = {
        parameters: validInput.parameters,
        'transmission-mode-list': validInput['transmission-mode-list'],
        'historical-performance-data-list': [
          {
            'period-end-time': '2026-05-18T12:00:00+00:00',
            'granularity-period': 'air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS',
            'performance-data': {
              'tx-level-min': 35,
              'time-xstates-list': [
                { 'transmission-mode': '0056-QPSK-52680/61762-1', time: 86400 }
              ]
            }
          },
          {
            'period-end-time': '2026-05-18T10:00:00+00:00',
            'granularity-period': 'air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
            'performance-data': {
              'tx-level-min': 35,
              'time-xstates-list': [
                { 'transmission-mode': '0056-QPSK-52680/61762-1', time: 900 }
              ]
            }
          },
          {
            'period-end-time': '2026-05-18T09:00:00+00:00',
            'granularity-period': 'air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
            'performance-data': {
              'tx-level-min': 35,
              'time-xstates-list': [
                { 'transmission-mode': '0056-QPSK-52680/61762-1', time: 900 }
              ]
            }
          }
        ]
      };

      const result = await p2IterateAiPmSlices(inputData);
      expect(typeof result).toBe('object');
      const list = result['historical-performance-data-list'];
      expect(list).toHaveLength(3);

      // Slices 0 and 1 must be 15-min, ordered chronologically
      expect(list[0]['granularity-period']).toBe('air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN');
      expect(list[0]['period-end-time']).toBe('2026-05-18T09:00:00+00:00');

      expect(list[1]['granularity-period']).toBe('air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN');
      expect(list[1]['period-end-time']).toBe('2026-05-18T10:00:00+00:00');

      // Slice 2 must be 24-hour
      expect(list[2]['granularity-period']).toBe('air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS');
      expect(list[2]['period-end-time']).toBe('2026-05-18T12:00:00+00:00');
    });

    test('supports shorthand granularity representations', async () => {
      const inputData = {
        parameters: validInput.parameters,
        'transmission-mode-list': validInput['transmission-mode-list'],
        'historical-performance-data-list': [
          {
            'period-end-time': '2026-05-18T12:00:00+00:00',
            'granularity-period': '24h',
            'performance-data': {
              'time-xstates-list': [
                { 'transmission-mode': '0056-QPSK-52680/61762-1', time: 86400 }
              ]
            }
          },
          {
            'period-end-time': '2026-05-18T10:00:00+00:00',
            'granularity-period': '15min',
            'performance-data': {
              'time-xstates-list': [
                { 'transmission-mode': '0056-QPSK-52680/61762-1', time: 900 }
              ]
            }
          }
        ]
      };

      const result = await p2IterateAiPmSlices(inputData);
      expect(typeof result).toBe('object');
      const list = result['historical-performance-data-list'];
      expect(list[0]['granularity-period']).toBe('15min');
      expect(list[1]['granularity-period']).toBe('24h');
    });

    test('handles null or undefined period-end-time during sorting without calling Date', async () => {
      const inputData = {
        parameters: validInput.parameters,
        'transmission-mode-list': validInput['transmission-mode-list'],
        'historical-performance-data-list': [
          {
            'period-end-time': null,
            'granularity-period': '15min',
            'performance-data': {
              'time-xstates-list': [
                { 'transmission-mode': '0056-QPSK-52680/61762-1', time: 900 }
              ]
            }
          },
          {
            'period-end-time': '2026-05-18T10:00:00+00:00',
            'granularity-period': '15min',
            'performance-data': {
              'time-xstates-list': [
                { 'transmission-mode': '0056-QPSK-52680/61762-1', time: 900 }
              ]
            }
          }
        ]
      };

      const result = await p2IterateAiPmSlices(inputData);
      expect(typeof result).toBe('object');
      const list = result['historical-performance-data-list'];
      expect(list[0]['period-end-time']).toBe('2026-05-18T10:00:00+00:00');
      expect(list[1]['period-end-time']).toBeNull();
    });
  });

  describe('Processing Iteration & Feature Execution', () => {
    test('successfully calculates interval-capacity, removes out of range levels and default values', async () => {
      const result = await p2IterateAiPmSlices(validInput);

      // Result should be an object with historical-performance-data-list only
      expect(typeof result).toBe('object');
      expect(result['historical-performance-data-list']).toBeDefined();

      // Ensure Phase 2 does NOT return timestamps in top-level output
      expect(result['most-recent-period-end-time']).toBeUndefined();
      expect(result['most-recent-period-end-time-24']).toBeUndefined();

      const list = result['historical-performance-data-list'];

      // First slice has time-xstates-list with 900s of transmission mode 0056-QPSK-52680/61762-1 (capacity: 82783)
      // Check interval-capacity added
      expect(list[0]['performance-data']['interval-capacity']).toBe(82783);

      // Out-of-range removal check:
      // In dataset.json, valid Tx range is 30 to 100. Slices with tx-level-max: 23 (< 30) should have tx-level-max removed
      expect(list[0]['performance-data']['tx-level-max']).toBeUndefined();

      // Default value removal check:
      // In dataset.json, default for tx-level-avg is "-99". Slices with tx-level-avg: -99 should have it removed
      const sliceWithDefault = list.find(s => s['performance-data']['tx-level-avg'] === -99);
      expect(sliceWithDefault).toBeUndefined();
    });

    test('does not mutate the original input array or its nested objects', async () => {
      const originalInputCopy = JSON.parse(JSON.stringify(validInput));

      await p2IterateAiPmSlices(validInput);

      expect(validInput).toEqual(originalInputCopy);
    });

    test('leaves input untouched if processing fails midway', async () => {
      const failingInput = JSON.parse(JSON.stringify(validInput));
      failingInput.parameters = {
        'sub-function': [
          {
            'function-name': 'p1RemoveOutOfRangeLevels',
            parameter: [
              { 'parameter-name': 'lowerTxLevelLimit', value: '100' },
              { 'parameter-name': 'upperTxLevelLimit', value: '10' },
              { 'parameter-name': 'lowerRxLevelLimit', value: '30' },
              { 'parameter-name': 'upperRxLevelLimit', value: '100' }
            ]
          },
          {
            'function-name': 'p1RemoveDefaultValues',
            parameter: [{ 'parameter-name': 'tx-level-avg', value: '-99' }]
          }
        ]
      };

      const originalInputCopy = JSON.parse(JSON.stringify(failingInput));
      const res = await p2IterateAiPmSlices(failingInput);
      expect(res).toBe(ERRORS.OUT_OF_RANGE_LEVELS_ERROR);

      // Verify the original input was not modified even partially
      expect(failingInput).toEqual(originalInputCopy);
    });

    test('handles direct sub-function parameters object structure', async () => {
      const customParamsInput = {
        parameters: {
          p1RemoveOutOfRangeLevels: {
            parameter: [
              { 'parameter-name': 'lowerTxLevelLimit', value: '10' },
              { 'parameter-name': 'upperTxLevelLimit', value: '50' },
              { 'parameter-name': 'lowerRxLevelLimit', value: '-100' },
              { 'parameter-name': 'upperRxLevelLimit', value: '0' }
            ]
          },
          p1RemoveDefaultValues: {
            parameter: [
              { 'parameter-name': 'ses', value: '0' }
            ]
          }
        },
        'transmission-mode-list': validInput['transmission-mode-list'],
        'historical-performance-data-list': [
          {
            'period-end-time': '2026-05-18T10:00:00+00:00',
            'granularity-period': '15min',
            'performance-data': {
              ses: 0,
              'tx-level-min': 20,
              'time-xstates-list': [
                { 'transmission-mode': '0056-QPSK-52680/61762-1', time: 900 }
              ]
            }
          }
        ]
      };

      const result = await p2IterateAiPmSlices(customParamsInput);
      expect(typeof result).toBe('object');
      const processed = result['historical-performance-data-list'][0]['performance-data'];
      expect(processed['interval-capacity']).toBe(82783);
      expect(processed['tx-level-min']).toBe(20); // within 10 to 50
      expect(processed['ses']).toBeUndefined(); // default value 0 removed
    });
  });

  describe('Error Handling from Sub-functions', () => {
    test('returns OUT_OF_RANGE_LEVELS_ERROR when p1RemoveOutOfRangeLevels fails due to invalid range limits', async () => {
      const invalidRangeInput = JSON.parse(JSON.stringify(validInput));
      // Set lowerTxLevelLimit > upperTxLevelLimit which causes P1RemoveOutOfRangeLevels to return PARAM_INVALID
      invalidRangeInput.parameters = {
        'sub-function': [
          {
            'function-name': 'p1RemoveOutOfRangeLevels',
            parameter: [
              { 'parameter-name': 'lowerTxLevelLimit', value: '100' },
              { 'parameter-name': 'upperTxLevelLimit', value: '10' },
              { 'parameter-name': 'lowerRxLevelLimit', value: '30' },
              { 'parameter-name': 'upperRxLevelLimit', value: '100' }
            ]
          },
          {
            'function-name': 'p1RemoveDefaultValues',
            parameter: [
              { 'parameter-name': 'tx-level-avg', value: '-99' }
            ]
          }
        ]
      };

      const res = await p2IterateAiPmSlices(invalidRangeInput);
      expect(res).toBe(ERRORS.OUT_OF_RANGE_LEVELS_ERROR);
    });

    test('returns DEFAULT_VALUES_ERROR when p1RemoveDefaultValues fails', async () => {
      const invalidDefaultValuesInput = JSON.parse(JSON.stringify(validInput));
      invalidDefaultValuesInput.parameters = {
        'sub-function': [
          {
            'function-name': 'p1RemoveOutOfRangeLevels',
            parameter: [
              { 'parameter-name': 'lowerTxLevelLimit', value: '30' },
              { 'parameter-name': 'upperTxLevelLimit', value: '100' },
              { 'parameter-name': 'lowerRxLevelLimit', value: '30' },
              { 'parameter-name': 'upperRxLevelLimit', value: '100' }
            ]
          },
          {
            'function-name': 'p1RemoveDefaultValues',
            parameter: [] // Empty parameter array causes p1RemoveDefaultValues to return PARAM_INVALID
          }
        ]
      };

      const res = await p2IterateAiPmSlices(invalidDefaultValuesInput);
      expect(res).toBe(ERRORS.DEFAULT_VALUES_ERROR);
    });

    test('returns INTERVAL_CAPACITY_ERROR when time-xstates-list is missing from performance-data', async () => {
      const missingTimeXStatesInput = JSON.parse(JSON.stringify(validInput));
      delete missingTimeXStatesInput['historical-performance-data-list'][0]['performance-data']['time-xstates-list'];

      const res = await p2IterateAiPmSlices(missingTimeXStatesInput);
      expect(res).toBe(ERRORS.INTERVAL_CAPACITY_ERROR);
    });

    test('returns INTERVAL_CAPACITY_ERROR when time-xstates-list is not an array', async () => {
      const invalidTimeXStatesInput = JSON.parse(JSON.stringify(validInput));
      invalidTimeXStatesInput['historical-performance-data-list'][0]['performance-data']['time-xstates-list'] = 'invalid-list';

      const res = await p2IterateAiPmSlices(invalidTimeXStatesInput);
      expect(res).toBe(ERRORS.INTERVAL_CAPACITY_ERROR);
    });
  });
});
