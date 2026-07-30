'use strict';

const ERRORS = require("./ErrorsEnum");
const p1FieldsFilter = require("../../../../genericFunctions/p1FieldsFilter/P1FieldsFilter");

/**
 * Creates a list of ONF output formats by applying the configured
 * fields filters to resultCc.
 *
 * @param {Object} input
 * @param {Object} input.parameters Hierarchical parameter configuration.
 * @param {Object} input.result-cc ResultCc to be filtered.
 * @param {Function} p1FieldsFilter Function used to apply a NETCONF fields filter.
 *
 * @returns {Promise<Object>}
 * {
 *   "onf-output-format": [
 *     {
 *       "format-name": "...",
 *       "output-format": { ... }
 *     }
 *   ]
 * }
 */
async function p2FormattingOutputOnf(input) {
  try {
    let validateRes = validateInput(input);

    if (validateRes != "") {
      return validateRes;
    }

    const parameters = input['parameters'];
    const resultCc = input['result-cc'];

    const fieldsFilters = extractFieldsFilters(parameters);

    if (fieldsFilters == ERRORS.PARAMETERS_INVALID) {
      return ERRORS.PARAMETERS_INVALID;
    }

    const onfOutputFormats = [];

    for (const fieldsFilter of fieldsFilters) {
      const filterInput = {
        // Clone resultCc because p1FieldsFilter must not be allowed
        // to modify the original data structure.
        'dataStructure': deepClone(resultCc),
        'fieldsFilterString': fieldsFilter['fields-filter-string']
      };

      let filterResult;
      try {
        filterResult = await p1FieldsFilter.run(filterInput);
      } catch (error) {
        return ERRORS.ONF_OUTPUT_FORMAT;
      }

      if (typeof filterResult == "string") {
        return ERRORS.ONF_OUTPUT_FORMAT;
      }

      const filteredDataStructure = extractFilteredDataStructure(filterResult);

      if (typeof filteredDataStructure == "string") {
        return filteredDataStructure; // is a error string
      }

      onfOutputFormats.push({
        'format-name': fieldsFilter['format-name'],
        'output-format': filteredDataStructure
      });
    }

    return { 'onf-output-format': onfOutputFormats };
  } catch (error) {
    return ERRORS.GENERAL_ERROR;
  }
}

/**
 * Validates the input according to the interface specification.
 *
 * @param {*} input
 */
function validateInput(input) {
  if (!isPlainObject(input)) {
    return ERRORS.PARAMETERS_NOT_PROVIDED;
  }

  if (
    !Object.prototype.hasOwnProperty.call(input, 'parameters') ||
    input.parameters === undefined ||
    input.parameters === null
  ) {
    return ERRORS.PARAMETERS_NOT_PROVIDED;
  }

  if (!isPlainObject(input.parameters)) {
    return ERRORS.PARAMETERS_INVALID;
  }

  if (
    !Object.prototype.hasOwnProperty.call(input, 'result-cc') ||
    input['result-cc'] === undefined ||
    input['result-cc'] === null
  ) {
    return ERRORS.RESULT_CC_NOT_PROVIDED;
  }

  if (!isPlainObject(input['result-cc'])) {
    return ERRORS.RESULT_CC_INVALID;
  }

  return "";
}

/**
 * Recursively extracts all parameters whose purpose is "fieldsFilter".
 *
 * Supported parameter example:
 * {
 *   "parameter-name": "compactFormat",
 *   "purpose": "fieldsFilter",
 *   "value": "air-interface-2-0:air-interface-pac(...)"
 * }
 *
 * @param {Object} parameters
 * @returns {Array<Object>}
 */
function extractFieldsFilters(parameters) {
  const fieldsFilters = [];
  const visited = new WeakSet();

  traverseParameters(parameters, fieldsFilters, visited);

  const validateRes = validateExtractedFieldsFilters(fieldsFilters);
  if (validateRes != "") {
    return validateRes;
  }

  return fieldsFilters;
}

/**
 * Recursively traverses objects and arrays.
 *
 * @param {*} currentValue
 * @param {Array<Object>} fieldsFilters
 * @param {WeakSet<Object>} visited
 */
function traverseParameters(currentValue, fieldsFilters, visited) {
  if (currentValue === null || typeof currentValue !== 'object') {
    return;
  }

  // Protect against circular parameter structures.
  if (visited.has(currentValue)) {
    return;
  }

  visited.add(currentValue);

  if (Array.isArray(currentValue)) {
    for (const item of currentValue) {
      traverseParameters(item, fieldsFilters, visited);
    }

    return;
  }

  if (currentValue.purpose === 'fieldsFilter') {
    fieldsFilters.push({
      'format-name': currentValue['parameter-name'],
      'fields-filter-string': currentValue.value
    });
  }

  for (const value of Object.values(currentValue)) {
    traverseParameters(value, fieldsFilters, visited);
  }
}

/**
 * Checks that extracted filter configurations are valid.
 *
 * @param {Array<Object>} fieldsFilters
 */
function validateExtractedFieldsFilters(fieldsFilters) {
  const formatNames = new Set();

  for (const fieldsFilter of fieldsFilters) {
    const formatName = fieldsFilter['format-name'];
    const fieldsFilterString = fieldsFilter['fields-filter-string'];

    if (
      typeof formatName !== 'string' ||
      formatName.trim().length === 0 ||
      typeof fieldsFilterString !== 'string' ||
      fieldsFilterString.trim().length === 0
    ) {
      return ERRORS.PARAMETERS_INVALID;
    }

    // onf-output-format declares format-name as x-key,
    // therefore duplicate names are considered invalid.
    if (formatNames.has(formatName)) {
      return ERRORS.PARAMETERS_INVALID;
    }

    formatNames.add(formatName);
  }

  return "";
}

/**
 * Extracts filtered-data-structure from the p1FieldsFilter output.
 *
 * Expected output:
 * {
 *   "filtered-data-structure": { ... }
 * }
 *
 * @param {*} filterResult
 * @returns {Object}
 */
function extractFilteredDataStructure(filterResult) {
  if (!isPlainObject(filterResult)) {
    return ERRORS.ONF_OUTPUT_FORMAT
  }

  if (!Object.prototype.hasOwnProperty.call(filterResult, 'filtered-data-structure')) {
    return ERRORS.ONF_OUTPUT_FORMAT
  }

  const filteredDataStructure = filterResult['filtered-data-structure'];

  if (!isPlainObject(filteredDataStructure)) {
    return ERRORS.ONF_OUTPUT_FORMAT
  }

  return filteredDataStructure;
}

/**
 * Creates a deep copy so that resultCc cannot be modified indirectly.
 *
 * @param {*} value
 * @returns {*}
 */
function deepClone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

module.exports = p2FormattingOutputOnf;
