const { applyFieldsFilter } = require("../../utils/fieldsFilter");

/**
 * Request:
 * {
 *   dataStructure: <object>,
 *   fieldsFilterString: "a,b(c,d)"
 * }
 *
 * Response:
 * {
 *   filteredDataStructure: <object>
 * }
 */
async function run(request) {
  if (!Object.prototype.hasOwnProperty.call(request, "dataStructure")) {
    throw new Error("dataStructure is mandatory");
  }

  const filteredDataStructure = applyFieldsFilter(
    request.dataStructure,
    request.fieldsFilterString || ""
  );

  return { filteredDataStructure };
}

module.exports = { run };