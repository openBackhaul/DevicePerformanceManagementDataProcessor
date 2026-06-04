const ERRORS = require('./ErrorsEnum');
const p1CalculateAiCapacity = require('../../../../../genericFunctions/p1CalculateAiCapacity/P1CalculateAiCapacity');

const p1PrepareTxModes = (input) => {
  try {

    if (!input) {
      return ERRORS.GENERAL_ERROR;
    }

    const histList = input['historical-performance-data-list'];
    const txModeList = input['transmission-mode-list'];

    if ((!histList && !txModeList) || (histList == undefined && txModeList == undefined)) {
      return ERRORS.GENERAL_ERROR;
    }

    // Checking Historical Performance
    if (histList === undefined) {
      return ERRORS.HIST_PERF_DATA_NOT_PROVIDED;
    }
    if (!Array.isArray(histList)) {
      return ERRORS.HIST_PERF_DATA_INVALID;
    }

    // Checking TX Mode list
    if (txModeList === undefined) {
      return ERRORS.TX_MODE_LIST_NOT_PROVIDED;
    }
    if (!Array.isArray(txModeList)) {
      return ERRORS.TX_MODE_LIST_INVALID;
    }

    for (let i = 0; i< histList.length; i++) {
      const entry = histList[i];
      if (!entry['performance-data']) {
        return ERRORS.HIST_PERF_DATA_INCOMPLETE;
      } else if (!Array.isArray(entry['performance-data']['time-xstates-list'])) {
        // Skip PM data where 'time-xstate-list' is not present
        const idx = histList.indexOf(entry);
        histList.splice(i, 1);
        i = i-1;
      }
    }

    for (const mode of txModeList) {
      if (
        mode['channel-bandwidth'] === undefined ||
        mode['symbol-rate-reduction-factor'] === undefined ||
        mode['modulation-scheme'] === undefined ||
        mode['code-rate'] === undefined
      ) {
        return ERRORS.TX_MODE_LIST_INCOMPLETE;
      }
    }

    const usedTxModes = new Set();

    const cleanedHistList = histList.map(histEntry => {
      const perfData = histEntry['performance-data'];

      const cleanedXstates =
        perfData['time-xstates-list'].filter(xstate => {
          if (xstate.time > 0) {
            usedTxModes.add(xstate['transmission-mode']);
            return true;
          }
          return false;
        });

      return {
        ...histEntry,
        'performance-data': {
          ...perfData,
          'time-xstates-list': cleanedXstates
        }
      };
    });

    const hasValidData = cleanedHistList.some(entry =>
      entry['performance-data']['time-xstates-list'].length > 0
    );

    if (!hasValidData) {
      return ERRORS.HIST_PERF_DATA_COULD_NOT_BE_PROVIDED;
    }

    const filteredTxModes = txModeList.filter(mode =>
      usedTxModes.has(mode['transmission-mode-name'])
    );

    if (filteredTxModes.length === 0) {
      return ERRORS.TX_MODE_LIST_COULD_NOT_BE_PROVIDED;
    }

    const enrichedTxModes = [];

    for (const mode of filteredTxModes) {
      const capacityResult = p1CalculateAiCapacity({
        'channel-bandwidth': mode['channel-bandwidth'],
        'symbol-rate-reduction-factor':
          mode['symbol-rate-reduction-factor'],
        'number-of-states-in-modulation':
          mode['modulation-scheme'],
        'code-rate': mode['code-rate']
      });


      if (typeof capacityResult === 'string') {
        return ERRORS.TX_MODE_LIST_COULD_NOT_BE_PROVIDED;
      }

      enrichedTxModes.push({
        ...mode,
        capacity: capacityResult['air-interface-capacity']
      });
    }

    return {
      'historical-performance-data-list': cleanedHistList,
      'transmission-mode-list': enrichedTxModes
    };

  } catch (err) {
    return ERRORS.GENERAL_ERROR;
  }
};

module.exports = p1PrepareTxModes;