const mockPrepareTxModes = jest.fn((input) => ({
  'historical-performance-data-list': input['historical-performance-data-list'],
  'processed-transmission-mode-list': [{
    ...input['transmission-mode-list'][0],
    capacity: 12345
  }]
}));

const mockIterateAiPmSlices = jest.fn((input) => ({
  'historical-performance-data-list': input['historical-performance-data-list']
}));

jest.mock('./p2PrepareTxModes/P2PrepareTxModes', () => mockPrepareTxModes);
jest.mock('./p2IterateAiPmSlices/P2IterateAiPmSlices', () => mockIterateAiPmSlices);

const p2CreateResultCc = require('./P2CreateResultCc');

describe('P2CreateResultCc Lot 6 integration', () => {
  beforeEach(() => {
    mockPrepareTxModes.mockClear();
    mockIterateAiPmSlices.mockClear();
  });

  test('uses the delivered functions and passes processed transmission modes downstream', async () => {
    const historicalPerformanceDataList = [{
      'granularity-period': 'air-interface-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN',
      'period-end-time': '2026-09-11T10:00:00Z',
      'performance-data': {
        'time-xstates-list': [{ 'transmission-mode': 'MODE-A', time: 900 }]
      }
    }];
    const transmissionModeList = [{
      'transmission-mode-name': 'MODE-A',
      'channel-bandwidth': 28000,
      'symbol-rate-reduction-factor': 1,
      'modulation-scheme': 16,
      'code-rate': 90
    }];
    const rawCc = {
      uuid: 'device-1',
      'logical-termination-point': [{
        uuid: 'air-interface-1',
        'layer-protocol': [{
          'layer-protocol-name': 'air-interface-2-0:LAYER_PROTOCOL_NAME_TYPE_AIR_LAYER',
          'air-interface-2-0:air-interface-pac': {
            'air-interface-capability': {
              'transmission-mode-list': transmissionModeList
            },
            'air-interface-historical-performances': {
              'historical-performance-data-list': historicalPerformanceDataList
            }
          }
        }]
      }]
    };
    const parameters = {
      'function-name': 'p2CreateResultCc',
      'sub-function': [
        { 'function-name': 'p2PrepareTxModes', 'is-active': true },
        { 'function-name': 'p2IterateAiPmSlices', 'is-active': true }
      ]
    };

    const result = await p2CreateResultCc.run({
      parameters,
      'raw-cc': rawCc,
      'status-data': [],
      mountName: 'device-1'
    });

    expect(mockPrepareTxModes).toHaveBeenCalledTimes(1);
    expect(mockIterateAiPmSlices).toHaveBeenCalledWith(expect.objectContaining({
      'transmission-mode-list': [expect.objectContaining({ capacity: 12345 })]
    }));
    const resultPac = result['result-cc']['logical-termination-point'][0]
      ['layer-protocol'][0]['air-interface-2-0:air-interface-pac'];
    expect(resultPac['air-interface-capability']['transmission-mode-list'])
      .toEqual([expect.objectContaining({ capacity: 12345 })]);
  });

  test('still permits dependency overrides for isolated callers', async () => {
    const override = jest.fn();
    const parameters = {
      'function-name': 'p2CreateResultCc',
      'sub-function': [{ 'function-name': 'p2PrepareTxModes', 'is-active': false }]
    };

    await p2CreateResultCc.run({
      parameters,
      'raw-cc': { uuid: 'device-1', 'logical-termination-point': [] },
      'status-data': [],
      dependencies: { p2PrepareTxModes: override }
    });

    expect(override).not.toHaveBeenCalled();
  });
});
