const fs = require('fs');
const path = require('path');
const JSON5 = require('json5');

const p1PrepareTxModes = require('./P1PrepareTxModes');
const ERRORS = require('./ErrorsEnum');

describe('p1PrepareTxModes', () => {

  beforeAll(() => {
    const ccFile = fs.readFileSync(
      path.join(__dirname, 'dataset', 'p1CreateResultCc-input_latest.json'),
      'utf8'
    );
    JSON5.parse(ccFile);
  });

  const validHistoricalPerformanceDataList = [
    {
      'performance-data': {
        'time-xstates-list': [
          { 'transmission-mode': 'MODE-A', time: 120 },
          { 'transmission-mode': 'MODE-B', time: 0 }
        ]
      }
    },
    {
      'performance-data': {
        'time-xstates-list': [
          { 'transmission-mode': 'MODE-A', time: 30 }
        ]
      }
    }
  ];

  const validTransmissionModeList = [
    {
      'transmission-mode-name': 'MODE-A',
      'channel-bandwidth': 28000,
      'symbol-rate-reduction-factor': 1,
      'modulation-scheme': 16,
      'code-rate': 90
    },
    {
      'transmission-mode-name': 'MODE-B',
      'channel-bandwidth': 14000,
      'symbol-rate-reduction-factor': 1,
      'modulation-scheme': 4,
      'code-rate': 70
    }
  ];

  test(
    'removes unused transmission modes and enriches used ones with AI capacity',
    () => {
      const result = p1PrepareTxModes({
        'historical-performance-data-list': validHistoricalPerformanceDataList,
        'transmission-mode-list': validTransmissionModeList
      });

      expect(result['transmission-mode-list'].length).toBe(1);
      expect(
        result['transmission-mode-list'][0]['transmission-mode-name']
      ).toBe('MODE-A');

      // AI capacity is calculated and enriched
      expect(
        typeof result['transmission-mode-list'][0]['capacity']
      ).toBe('number');
      expect(
        result['transmission-mode-list'][0]['capacity']
      ).toBeGreaterThan(0);
    }
  );

  test('returns error when input is missing', () => {
    const result = p1PrepareTxModes();
    expect(result).toBe(ERRORS.HIST_PERF_DATA_NOT_PROVIDED);
  });

  test('returns error when historical-performance-data-list missing', () => {
    const result = p1PrepareTxModes({
      'transmission-mode-list': validTransmissionModeList
    });
    expect(result).toBe(ERRORS.HIST_PERF_DATA_NOT_PROVIDED);
  });

  test('returns error when transmission-mode-list invalid', () => {
    const result = p1PrepareTxModes({
      'historical-performance-data-list': validHistoricalPerformanceDataList,
      'transmission-mode-list': {}
    });
    expect(result).toBe(ERRORS.TX_MODE_LIST_INVALID);
  });
  test('output contains only expected keys', () => {
    const result = p1PrepareTxModes({
      'historical-performance-data-list': validHistoricalPerformanceDataList,
      'transmission-mode-list': validTransmissionModeList
    });

    expect(Object.keys(result).sort()).toEqual([
      'historical-performance-data-list',
      'transmission-mode-list'
    ]);
  });
});