'use strict';

const ERRORS = require('./ErrorsEnum');
const p1CalculateAiCapacity = require('../../../../../genericFunctions/p1CalculateAiCapacity/P1CalculateAiCapacity');

/////////////////////////////////

/**
 * Removes unused transmission modes and calculates the capacity
 * of the transmission modes that are actually referenced.
 *
 * @param {Object} input
 * @returns {Promise<Object>}
 */
function p2PrepareTxModes(input) {
  try {
    const validateRes = validateInput(input);

    if (validateRes != "") {
      return validateRes;
    }

    /*
     * Work on a copy so that the original input object is not modified.
     *
     * structuredClone is available in recent Node.js versions.
     * JSON cloning is sufficient here because the input contains
     * plain JSON-compatible data.
     */
    const historicalPerformanceDataList = deepClone(
      input['historical-performance-data-list']
    );

    const transmissionModeList = deepClone(
      input['transmission-mode-list']
    );

    const usedTransmissionModeNames = new Set();

    /*
     * Remove time-xstate entries whose time is zero or lower and
     * collect the names of the transmission modes that are still used.
     */
    for (const historicalPerformanceData of historicalPerformanceDataList) {
      const timeXstatesList = historicalPerformanceData['performance-data']['time-xstates-list'];

      const filteredTimeXstatesList = timeXstatesList.filter(
        (timeXstateEntry) => {
          if (timeXstateEntry.time > 0) {
            usedTransmissionModeNames.add(timeXstateEntry['transmission-mode']);
            return true;
          }

          return false;
        }
      );

      historicalPerformanceData['performance-data']['time-xstates-list'] = filteredTimeXstatesList;
    }

    const transmissionModesByName = new Map(
      transmissionModeList.map((transmissionMode) => [
        transmissionMode['transmission-mode-name'],
        transmissionMode
      ])
    );

    /*
     * A historical record with time > 0 must reference an existing
     * transmission mode.
     */
    for (const transmissionModeName of usedTransmissionModeNames) {
      if (!transmissionModesByName.has(transmissionModeName)) {
        return ERRORS.TX_MODE_LIST_INCOMPLETE;
      }
    }

    const processedTransmissionModeList = [];

    /*
     * Iterate over the original transmission-mode-list so that its
     * original ordering is preserved.
     */
    for (const transmissionMode of transmissionModeList) {
      const transmissionModeName =
        transmissionMode['transmission-mode-name'];

      if (!usedTransmissionModeNames.has(transmissionModeName)) {
        continue;
      }

      const capacityResult = p1CalculateAiCapacity({
        'channel-bandwidth': transmissionMode['channel-bandwidth'],
        'symbol-rate-reduction-factor': transmissionMode['symbol-rate-reduction-factor'],
        'number-of-states-in-modulation': transmissionMode['modulation-scheme'],
        'code-rate': transmissionMode['code-rate']
      });

      if (!capacityResult || typeof capacityResult !== 'object' ||
        !Number.isFinite(capacityResult['air-interface-capacity'])) {
        return ERRORS.PROC_TX_MODE_LIST_COULD_NOT_BE_PROVIDED;
      }

      processedTransmissionModeList.push({
        ...transmissionMode,
        capacity: capacityResult['air-interface-capacity']
      });
    }

    return {
      'historical-performance-data-list': historicalPerformanceDataList,
      'processed-transmission-mode-list': processedTransmissionModeList
    };
  } catch (error) {
    // if (error instanceof ProcessingError) {
    //   throw error.message;
    // }

    return ERRORS.GENERAL_ERROR;
  }
};




////////////////////








/**
 * Validates the complete input object.
 *
 * @param {Object} input
 */
function validateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return ERRORS.HIST_PERF_DATA_NOT_PROVIDED;
  }

  let res = validateHistoricalPerformanceDataList(input['historical-performance-data-list']);

  if (res != "") {
    return res;
  }

  res = validateTransmissionModeList(input['transmission-mode-list']);

  if (res != "") {
    return res;
  }

  return "";
}

/**
 * Validates historical-performance-data-list.
 *
 * @param {*} historicalPerformanceDataList
 */
function validateHistoricalPerformanceDataList(
  historicalPerformanceDataList
) {
  if (historicalPerformanceDataList === undefined || historicalPerformanceDataList === null) {
    return ERRORS.HIST_PERF_DATA_NOT_PROVIDED;
  }

  if (!Array.isArray(historicalPerformanceDataList)) {
    return ERRORS.HIST_PERF_DATA_INVALID;
  }

  for (const historicalPerformanceData of historicalPerformanceDataList) {
    if (!historicalPerformanceData || typeof historicalPerformanceData !== 'object' ||
      Array.isArray(historicalPerformanceData)) {
      return ERRORS.HIST_PERF_DATA_INVALID;
    }

    if (!Object.prototype.hasOwnProperty.call(historicalPerformanceData, 'performance-data')) {
      return ERRORS.HIST_PERF_DATA_INCOMPLETE;
    }

    const performanceData = historicalPerformanceData['performance-data'];

    if (!performanceData || typeof performanceData !== 'object' ||
      Array.isArray(performanceData)) {
      return ERRORS.HIST_PERF_DATA_INVALID;
    }

    if (!Object.prototype.hasOwnProperty.call(performanceData, 'time-xstates-list')) {
      return ERRORS.HIST_PERF_DATA_INCOMPLETE;
    }

    const timeXstatesList = performanceData['time-xstates-list'];

    if (!Array.isArray(timeXstatesList)) {
      return ERRORS.HIST_PERF_DATA_INVALID
    }

    for (const timeXstateEntry of timeXstatesList) {
      const resVal = validateTimeXstateEntry(timeXstateEntry);
      if (resVal != "") {
        return resVal;
      }
    }
  }

  return "";
}

/**
 * Validates a time-xstates-list entry.
 *
 * @param {*} timeXstateEntry
 */
function validateTimeXstateEntry(timeXstateEntry) {
  if (!timeXstateEntry || typeof timeXstateEntry !== 'object' || Array.isArray(timeXstateEntry)) {
    return ERRORS.HIST_PERF_DATA_INVALID;
  }

  if (!Object.prototype.hasOwnProperty.call(timeXstateEntry, 'transmission-mode') ||
    !Object.prototype.hasOwnProperty.call(timeXstateEntry, 'time')) {
    return ERRORS.HIST_PERF_DATA_INCOMPLETE;
  }

  if (typeof timeXstateEntry['transmission-mode'] !== 'string' ||
    timeXstateEntry['transmission-mode'].trim() === '' || !Number.isInteger(timeXstateEntry.time)) {
    return ERRORS.HIST_PERF_DATA_INVALID;
  }

  return "";
}

/**
 * Validates transmission-mode-list.
 *
 * @param {*} transmissionModeList
 */
function validateTransmissionModeList(transmissionModeList) {
  if ( transmissionModeList === undefined || transmissionModeList === null) {
    return ERRORS.TX_MODE_LIST_NOT_PROVIDED;
  }

  if (!Array.isArray(transmissionModeList)) {
    return ERRORS.TX_MODE_LIST_INVALID;
  }

  const transmissionModeNames = new Set();

  for (const transmissionMode of transmissionModeList) {
    if (!transmissionMode || typeof transmissionMode !== 'object' ||
      Array.isArray(transmissionMode)) {
      return ERRORS.TX_MODE_LIST_INVALID;
    }

    const requiredProperties = [
      'transmission-mode-name',
      'channel-bandwidth',
      'modulation-scheme',
      'code-rate',
      'symbol-rate-reduction-factor'
    ];

    for (const property of requiredProperties) {
      if (!Object.prototype.hasOwnProperty.call(transmissionMode, property)) {
        return ERRORS.TX_MODE_LIST_INCOMPLETE;
      }
    }

    const transmissionModeName = transmissionMode['transmission-mode-name'];

    if (typeof transmissionModeName !== 'string' || transmissionModeName.trim() === '') {
      return ERRORS.TX_MODE_LIST_INVALID;
    }

    if (transmissionModeNames.has(transmissionModeName)) {
      return ERRORS.TX_MODE_LIST_INVALID;
    }

    transmissionModeNames.add(transmissionModeName);

    const numericProperties = [
      'channel-bandwidth',
      'modulation-scheme',
      'code-rate',
      'symbol-rate-reduction-factor'
    ];

    for (const property of numericProperties) {
      if (!Number.isInteger(transmissionMode[property]) 
        // || transmissionMode[property] <= 0
      ) {
        return ERRORS.TX_MODE_LIST_INVALID;
      }
    }
  }

  return "";
}

/**
 * Creates a copy of JSON-compatible data.
 *
 * @param {*} value
 * @returns {*}
 */
function deepClone(value) {
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
  } catch {
    return ERRORS.HIST_PERF_DATA_COULD_NOT_BE_PROVIDED;
  }
}

class ProcessingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProcessingError';
  }
}

module.exports = p2PrepareTxModes;
