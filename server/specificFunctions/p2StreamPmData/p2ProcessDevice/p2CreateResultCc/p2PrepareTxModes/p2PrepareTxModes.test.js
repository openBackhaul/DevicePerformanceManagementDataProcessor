const fs = require('fs');
const JSON5 = require('json5');

const p2PrepareTxModes = require('./P2PrepareTxModes');

// p2PrepareTxModes
const ERRORS = require('./ErrorsEnum');

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


describe('p2PrepareTxModes', () => {

  test(
    'removes unused transmission modes and enriches used ones with AI capacity',
    () => {
      const result = p2PrepareTxModes({
        'historical-performance-data-list': validHistoricalPerformanceDataList,
        'transmission-mode-list': validTransmissionModeList
      });

      expect(result['processed-transmission-mode-list'].length).toBe(1);
      expect(
        result['processed-transmission-mode-list'][0]['transmission-mode-name']
      ).toBe('MODE-A');

      // AI capacity is calculated and enriched
      expect(
        typeof result['processed-transmission-mode-list'][0]['capacity']
      ).toBe('number');
      expect(
        result['processed-transmission-mode-list'][0]['capacity']
      ).toBeGreaterThan(0);
    }
  );

  test('removes time-xstate entries with time <= 0', () => {
    const historicalData = [
      {
        'performance-data': {
          'time-xstates-list': [
            { 'transmission-mode': 'MODE-A', time: 100 },
            { 'transmission-mode': 'MODE-B', time: 0 },
            { 'transmission-mode': 'MODE-B', time: -10 }
          ]
        }
      }
    ];

    const result = p2PrepareTxModes({
      'historical-performance-data-list': historicalData,
      'transmission-mode-list': validTransmissionModeList
    });

    expect(result['historical-performance-data-list'][0]
    ['performance-data']['time-xstates-list'])
      .toEqual([
        { 'transmission-mode': 'MODE-A', time: 100 }
      ]);

    expect(result['processed-transmission-mode-list'].map(
      mode => mode['transmission-mode-name']
    )).toEqual(['MODE-A']);
  });

  test('output contains only expected keys', () => {
    const result = p2PrepareTxModes({
      'historical-performance-data-list': validHistoricalPerformanceDataList,
      'transmission-mode-list': validTransmissionModeList
    });

    expect(Object.keys(result).sort()).toEqual([
      'historical-performance-data-list',
      'processed-transmission-mode-list'
    ]);
  });

});

describe('p2PrepareTxModes - @Negative tests', () => {
  test('Returns error when input is missing - General Error', () => {
    const result = p2PrepareTxModes();
    expect(result).toBe(ERRORS.GENERAL_ERROR);
  });

  test('Returns error when input is null - General Error', () => {
    const result = p2PrepareTxModes(null);
    expect(result).toBe(ERRORS.GENERAL_ERROR);
  });

  test('Returns error when historical-performance-data-list missing', () => {
    const result = p2PrepareTxModes({
      'transmission-mode-list': validTransmissionModeList
    });
    expect(result).toBe(ERRORS.HIST_PERF_DATA_NOT_PROVIDED);
  });

  test('Returns error when historical-performance-data-list missing', () => {
    const result = p2PrepareTxModes({
      'transmission-mode-list': validTransmissionModeList,
      'historical-performance-data-list': ""
    });
    expect(result).toBe(ERRORS.HIST_PERF_DATA_INVALID);
  });

  test('Returns error when historical-performance-data-list missing', () => {
    const result = p2PrepareTxModes({
      'transmission-mode-list': validTransmissionModeList,
      'historical-performance-data-list': {}
    });
    expect(result).toBe(ERRORS.HIST_PERF_DATA_INVALID);
  });

  test('Returns error when transmission-mode-list invalid', () => {
    const result = p2PrepareTxModes({
      'historical-performance-data-list': validHistoricalPerformanceDataList,
      'transmission-mode-list': {}
    });
    expect(result).toBe(ERRORS.TX_MODE_LIST_INVALID);
  });

  test('returns error when historical-performance-data is incomplete', () => {
    const invalidHistList = [
      {
        // missing performance-data
      }
    ];

    const result = p2PrepareTxModes({
      'historical-performance-data-list': invalidHistList,
      'transmission-mode-list': validTransmissionModeList
    });

    expect(result).toBe(ERRORS.HIST_PERF_DATA_INCOMPLETE);
  });

  test('returns error when tx mode list is incomplete', () => {
    const incompleteTxModes = [
      {
        'transmission-mode-name': 'MODE-A'
        // missing required fields like bandwidth, modulation, code-rate
      }
    ];

    const result = p2PrepareTxModes({
      'historical-performance-data-list': validHistoricalPerformanceDataList,
      'transmission-mode-list': incompleteTxModes
    });

    expect(result).toBe(ERRORS.TX_MODE_LIST_INCOMPLETE);
  });

  test('returns error when historical-performance-data cannot be used', () => {
    const invalidHistList = [
      {
        'performance-data': {
          'time-xstates-list': [] // nothing usable
        }
      }
    ];

    const result = p2PrepareTxModes({
      'historical-performance-data-list': invalidHistList,
      'transmission-mode-list': validTransmissionModeList
    });

    expect(result).toBe(ERRORS.HIST_PERF_DATA_COULD_NOT_BE_PROVIDED);
  });
  test('returns error when used transmission mode is missing from tx mode list', () => {
    const historicalData = [
      {
        'performance-data': {
          'time-xstates-list': [
            {
              'transmission-mode': 'MODE-C',
              time: 100
            }
          ]
        }
      }
    ];

    const result = p2PrepareTxModes({
      'historical-performance-data-list': historicalData,
      'transmission-mode-list': validTransmissionModeList
    });

    expect(result).toBe(ERRORS.TX_MODE_LIST_INCOMPLETE);
  });
})

describe('p2PrepareTxModes - Real dataset', () => {
  test('Use CC-513250004 Dataset 1', () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/airIfDataset_004_1.json', 'utf8');
    let dataSet = JSON.parse(dataFile);
    const result = p2PrepareTxModes({
      'historical-performance-data-list': dataSet['air-interface-historical-performances'],
      'transmission-mode-list': dataSet['air-interface-capability']['transmission-mode-list']
    });

    expect(result["processed-transmission-mode-list"].length).toBe(1);
    expect(result["processed-transmission-mode-list"][0]).toEqual(
      {
        "modulation-scheme-name-at-lct": "QPSK",
        "transmission-mode-name": "0056-QPSK-52680/61762-1",
        "am-downshift-level": -76,
        "supported-as-fixed-configuration": true,
        "tx-power-min": -10,
        "code-rate": 85,
        "modulation-scheme": 4,
        "xpic-is-avail": true,
        "channel-bandwidth": 56000,
        "tx-power-max": 23,
        "transmission-mode-rank": 2,
        "rx-threshold": -84,
        "am-upshift-level": -72,
        "symbol-rate-reduction-factor": 1,
        "capacity": 82783
      }
    )

    expect(result['historical-performance-data-list'].length).toBe(22);

    const hPerfData = result["historical-performance-data-list"];

    for (const pm of hPerfData) {
      expect(pm['performance-data']['time-xstates-list'].length).toBe(1);

      if (pm['granularity-period'] == 'air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN') {
        expect(pm['performance-data']['time-xstates-list'][0]).toEqual(
          {
            'time': 900,
            'time-xstate-sequence-number': 1,
            'transmission-mode': '0056-QPSK-52680/61762-1'
          }
        );
      } else {
        expect(pm['performance-data']['time-xstates-list'][0]).toEqual(
          {
            'time': 86400,
            'time-xstate-sequence-number': 1,
            'transmission-mode': '0056-QPSK-52680/61762-1'
          }
        );
      }
    }

  });

  test('Use CC-513250004 Dataset 2', () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/airIfDataset_004_2.json', 'utf8');
    let dataSet = JSON.parse(dataFile);
    const result = p2PrepareTxModes({
      'historical-performance-data-list': dataSet['air-interface-historical-performances'],
      'transmission-mode-list': dataSet['air-interface-capability']['transmission-mode-list']
    });

    expect(result["processed-transmission-mode-list"].length).toBe(1);
    expect(result["processed-transmission-mode-list"][0]).toEqual(
      {
        "modulation-scheme-name-at-lct": "QPSK",
        "transmission-mode-name": "0056-QPSK-52680/61762-1",
        "am-downshift-level": -76,
        "supported-as-fixed-configuration": true,
        "tx-power-min": -10,
        "code-rate": 85,
        "modulation-scheme": 4,
        "xpic-is-avail": true,
        "channel-bandwidth": 56000,
        "tx-power-max": 13,
        "transmission-mode-rank": 2,
        "rx-threshold": -84,
        "am-upshift-level": -72,
        "symbol-rate-reduction-factor": 1,
        "capacity": 82783
      }
    );

    const hPerfData = result["historical-performance-data-list"];

    for (const pm of hPerfData) {
      expect(pm['performance-data']['time-xstates-list'].length).toBe(1);

      if (pm['granularity-period'] == 'air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN') {
        expect(pm['performance-data']['time-xstates-list'][0]).toEqual(
          {
            'time': 900,
            'time-xstate-sequence-number': 1,
            'transmission-mode': '0056-QPSK-52680/61762-1'
          }
        );
      } else {
        expect(pm['performance-data']['time-xstates-list'][0]).toEqual(
          {
            'time': 86400,
            'time-xstate-sequence-number': 1,
            'transmission-mode': '0056-QPSK-52680/61762-1'
          }
        );
      }
    }
  });

  test('Use CC-513250005 Dataset 1', () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/airIfDataset_005_1.json', 'utf8');
    let dataSet = JSON.parse(dataFile);
    const result = p2PrepareTxModes({
      'historical-performance-data-list': dataSet['air-interface-historical-performances'],
      'transmission-mode-list': dataSet['air-interface-capability']['transmission-mode-list']
    });

    expect(result["processed-transmission-mode-list"].length).toBe(1);
    expect(result["processed-transmission-mode-list"][0]).toEqual(
      {
        "modulation-scheme-name-at-lct": "QPSK",
        "transmission-mode-name": "0056-QPSK-52680/61762-1",
        "am-downshift-level": -76,
        "supported-as-fixed-configuration": true,
        "tx-power-min": -10,
        "code-rate": 85,
        "modulation-scheme": 4,
        "xpic-is-avail": true,
        "channel-bandwidth": 56000,
        "tx-power-max": 23,
        "transmission-mode-rank": 2,
        "rx-threshold": -84,
        "am-upshift-level": -72,
        "symbol-rate-reduction-factor": 1,
        "capacity": 82783
      }
    );

    const hPerfData = result["historical-performance-data-list"];

    for (const pm of hPerfData) {
      expect(pm['performance-data']['time-xstates-list'].length).toBe(1);

      if (pm['granularity-period'] == 'air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN') {
        expect(pm['performance-data']['time-xstates-list'][0]).toEqual(
          {
            'time': 900,
            'time-xstate-sequence-number': 1,
            'transmission-mode': '0056-QPSK-52680/61762-1'
          }
        );
      } else {
        expect(pm['performance-data']['time-xstates-list'][0]['time']).toBeLessThanOrEqual(86400);
        expect(pm['performance-data']['time-xstates-list'][0]['time-xstate-sequence-number']).toBe(1);
        expect(pm['performance-data']['time-xstates-list'][0]['transmission-mode']).toBe('0056-QPSK-52680/61762-1');
      }
    }
  });

});
