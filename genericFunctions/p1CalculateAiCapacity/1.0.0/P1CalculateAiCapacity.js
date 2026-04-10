const ERRORS = require('./ErrorsEnum.js');

const p1CalculateAiCapacity = (input) => {
  try {
    if (Object.keys(input).length == 0) {
      return ERRORS.GENERAL_ERROR;
    }

    const channelBandwidth = input["channel-bandwidth"];
    if (channelBandwidth === undefined) {
      return ERRORS.CHANNEL_BW_NOT_PROVIDED;
    }
    if (typeof channelBandwidth !== "number") {
      return ERRORS.CHANNEL_BW_INVALID;
    }

    const symbolRateReductionFactor = input["symbol-rate-reduction-factor"];
    if (symbolRateReductionFactor === undefined) {
      return ERRORS.SRRF_NOT_PROVIDED;
    }
    if (typeof symbolRateReductionFactor !== "number") {
      return ERRORS.SRRF_INVALID;
    }

    if (symbolRateReductionFactor < 1) { // Otherwise i got infinity
      return ERRORS.SRRF_INVALID;
    }

    const numberOfStatesInModulation = input["number-of-states-in-modulation"];
    if (numberOfStatesInModulation === undefined) {
      return ERRORS.MODSTATES_NOT_PROVIDED;
    }
    if (typeof numberOfStatesInModulation !== "number") {
      return ERRORS.MODSTATES_INVALID;
    }
    if (numberOfStatesInModulation < 1) { // Otherwise i got -infinity
      return ERRORS.MODSTATES_INVALID;
    }

    const codeRate = input["code-rate"];
    if (codeRate === undefined) {
      return ERRORS.CODERATE_NOT_PROVIDED;
    }
    if (typeof codeRate !== "number") {
      return ERRORS.CODERATE_INVALID;
    }
    if (codeRate < 0 || codeRate > 100) { // Otherwise i got -infinity
      return ERRORS.CODERATE_INVALID;
    }

    const BW = channelBandwidth;
    const SRRF = symbolRateReductionFactor;
    const M = numberOfStatesInModulation;
    const CR = codeRate / 100;

    const log2M = Math.log2(M);

    const aiCapacity =
      (BW / SRRF) *
      log2M *
      CR /
      1.15;

    const roundedCapacity = Math.round(aiCapacity);

    return {
      "air-interface-capacity": roundedCapacity
    };

  } catch (err) {
    return ERRORS.GENERAL_ERROR;
  }
};

module.exports = p1CalculateAiCapacity;