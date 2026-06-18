const { p1IterateAiPmSlices } = require('./P1IterateAiPmSlices');
const ERRORS = require('./ErrorsEnum');
const fs = require('fs');
const path = require('path');

describe('p1IterateAiPmSlices', () => {
  let validInput;

  beforeEach(() => {
    const dataPath = path.resolve(__dirname, './datasets/dataset.json');
    validInput = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  });

  describe('Input Validation', () => {
    test('returns error if parameters not provided', () => {
      delete validInput.parameters;
      expect(p1IterateAiPmSlices(validInput)).toBe(ERRORS.PARAMETERS_NOT_PROVIDED);
    });

    test('returns error if parameters is not an object', () => {
      validInput.parameters = [];
      expect(p1IterateAiPmSlices(validInput)).toBe(ERRORS.PARAMETERS_INVALID);
    });

    test('returns error if historical-performance-data-list not provided', () => {
      delete validInput['historical-performance-data-list'];
      expect(p1IterateAiPmSlices(validInput)).toBe(ERRORS.HISTORICAL_DATA_LIST_NOT_PROVIDED);
    });

    test('returns error if historical-performance-data-list is not an array', () => {
      validInput['historical-performance-data-list'] = {};
      expect(p1IterateAiPmSlices(validInput)).toBe(ERRORS.HISTORICAL_DATA_LIST_INVALID);
    });

    test('returns error if transmission-mode-list not provided', () => {
      delete validInput['transmission-mode-list'];
      expect(p1IterateAiPmSlices(validInput)).toBe(ERRORS.TRANSMISSION_MODE_LIST_NOT_PROVIDED);
    });

    test('returns error if transmission-mode-list is not an array', () => {
      validInput['transmission-mode-list'] = 'invalid';
      expect(p1IterateAiPmSlices(validInput)).toBe(ERRORS.TRANSMISSION_MODE_LIST_INVALID);
    });

    test('Passing null, return General Error', () => {
      const res = p1IterateAiPmSlices(null);
      expect(res).toBe(ERRORS.GENERAL_ERROR);
    });

    test('Passing all 3 properties but with null value, return General Error', () => {
      const res = p1IterateAiPmSlices({
        'historical-performance-data-list': null,
        'transmission-mode-list': null,
        'parameters': null
      });
      expect(res).toBe(ERRORS.GENERAL_ERROR);
    });
  });

  describe('Processing Iteration', () => {
    test('successfully processes slices and updates timestamps', () => {
      const result = p1IterateAiPmSlices(validInput);

      // Check return type is object and not error string
      expect(typeof result).toBe('object');
      expect(result['historical-performance-data-list']).toBeDefined();

      // Check timestamps updated correctly
      expect(result['most-recent-period-end-time']).toBe('2026-05-18T10:15:00+00:00');
      expect(result['most-recent-period-end-time-24']).toBe('2026-05-13T02:30:00+00:00');

      // Check performance data modified (interval-capacity added)
      const firstSlice = result['historical-performance-data-list'][0];
      expect(firstSlice['performance-data']['interval-capacity']).toBe(82783);

      // Check default value removal
      const secondSlice = result['historical-performance-data-list'][1];
      expect(secondSlice['performance-data']['tx-level-avg']).toBeUndefined();
    });
  });
});
