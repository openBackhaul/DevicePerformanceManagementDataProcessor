const { applyFieldsFilter } = require("../../utils/fieldsFilter");

const ERRORS = {
  DATA_STRUCTURE_NOT_PROVIDED: "dataStructure not provided",
  DATA_STRUCTURE_INVALID: "dataStructure invalid",
  FIELDS_FILTER_STRING_NOT_PROVIDED: "fieldsFilterString not provided",
  FIELDS_FILTER_STRING_INVALID: "fieldsFilterString invalid",
  FILTERED_DATA_STRUCTURE_COULD_NOT_BE_PROVIDED:
    "filteredDataStructure could not be provided",
  GENERAL_ERROR: "General processing error"
};

function getDataStructure(request) {
  if (Object.prototype.hasOwnProperty.call(request, "dataStructure")) {
    return request.dataStructure;
  }

  if (Object.prototype.hasOwnProperty.call(request, "data-structure")) {
    return request["data-structure"];
  }

  return undefined;
}

function getFieldsFilterString(request) {
  if (Object.prototype.hasOwnProperty.call(request, "fieldsFilterString")) {
    return request.fieldsFilterString;
  }

  if (Object.prototype.hasOwnProperty.call(request, "fields-filter-string")) {
    return request["fields-filter-string"];
  }

  return undefined;
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Request:
 * {
 *   dataStructure / data-structure: <object>,
 *   fieldsFilterString / fields-filter-string: "a(b,c)"
 * }
 *
 * Success response as per interface.yaml:
 * {
 *   "filtered-data-structure": <object>
 * }
 *
 * Error response:
 * string enum from interface.yaml
 */
async function run(request) {
  try {
    if (!request || typeof request !== "object") {
      return ERRORS.GENERAL_ERROR;
    }

    const dataStructure = getDataStructure(request);
    const fieldsFilterString = getFieldsFilterString(request);

    if (dataStructure === undefined || dataStructure === null) {
      return ERRORS.DATA_STRUCTURE_NOT_PROVIDED;
    }

    if (!isObject(dataStructure)) {
      return ERRORS.DATA_STRUCTURE_INVALID;
    }

    if (fieldsFilterString === undefined || fieldsFilterString === null) {
      return ERRORS.FIELDS_FILTER_STRING_NOT_PROVIDED;
    }

    if (
      typeof fieldsFilterString !== "string" ||
      fieldsFilterString.trim() === ""
    ) {
      return ERRORS.FIELDS_FILTER_STRING_INVALID;
    }

    let filteredDataStructure;

    try {
      filteredDataStructure = applyFieldsFilter(
        dataStructure,
        fieldsFilterString
      );
    } catch (error) {
      return ERRORS.FIELDS_FILTER_STRING_INVALID;
    }

    if (!filteredDataStructure || typeof filteredDataStructure !== "object" || Object.keys(filteredDataStructure).length === 0) {
      return ERRORS.FILTERED_DATA_STRUCTURE_COULD_NOT_BE_PROVIDED;
    }

    return { "filtered-data-structure": filteredDataStructure };
     
  } catch (error) {
    return ERRORS.GENERAL_ERROR;
  }
}

module.exports = { run };