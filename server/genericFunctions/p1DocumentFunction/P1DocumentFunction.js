const ERRORS = require('./ErrorsEnum');

/**
 * p1DocumentFunction
 *
 * Creates plain text documentation for active functions only.
 */
function p1DocumentFunction(input) {
  try {

    if (!input || input == null || input == undefined) {
      return ERRORS.GENERAL_ERROR;
    }

    if (!input || input["parameters-of-to-be-documented-function"] === null) {
      return ERRORS.PARAMETERS_NOT_PROVIDED;
    }

    if (input["parameters-of-to-be-documented-function"] === undefined) {
      return ERRORS.PARAMETERS_INVALID;
    }

    const rawParameters = input["parameters-of-to-be-documented-function"];

    const parameters =
      typeof rawParameters === "string"
        ? JSON.parse(rawParameters)
        : rawParameters;

    const documentation = formatDocumentation({ parameters });

    return documentation;
  } catch (error) {
    return ERRORS.GENERAL_ERROR;
  }
}

/**
 * Processing function:
 * formatDocumentation
 */
function formatDocumentation(input) {
  if (!input || !input['parameters']) {
    return ERRORS.PARAMETERS_NOT_PROVIDED;
  }

  if (typeof input['parameters'] !== "object" || Array.isArray(input['parameters'])) {
    return ERRORS.PARAMETERS_INVALID;
  }

  try {
    const lines = documentFunctionRecursive(input['parameters'], 0);

    if (!lines || lines.length === 0) {
      return "";
    }

    return lines.join("\n");
  } catch (error) {
    return ERRORS.DOC_COULDNT_CREATED;
  }
}

/**
 * Recursive formatter
 */
function documentFunctionRecursive(functionObject, indentLevel) {
  if (!functionObject || typeof functionObject !== "object") {
    return [];
  }

  if (functionObject['is-active'] !== true) {
    return [];
  }

  const indent = " ".repeat(indentLevel);
  const childIndent = " ".repeat(indentLevel + 2);

  const functionName = functionObject['function-name'];
  const description = functionObject['description'];

  if (!functionName || typeof functionName !== "string") {
    return [];
  }

  const lines = [];

  lines.push(`${indent}- ${functionName}`);

  if (description && typeof description === "string") {
    lines.push(`${childIndent}${description}`);
  }

  const stringParameters = getStringParameters(functionObject);

  for (const parameter of stringParameters) {
    if (!parameter['parameter-name'] || typeof parameter['parameter-name'] !== "string") {
      continue;
    }

    lines.push(`${childIndent}. ${parameter['parameter-name']}`);

    if (parameter['purpose'] && typeof parameter['purpose'] === "string") {
      lines.push(`${childIndent}  ${parameter['purpose']}`);
    }

    if (parameter['value'] !== undefined && parameter['value'] !== null) {
      lines.push(`${childIndent}  ${String(parameter['value'])}`);
    }
  }

  const subFunctions = getSubFunctions(functionObject);

  for (const subFunction of subFunctions) {
    const subFunctionLines = documentFunctionRecursive(
      subFunction,
      indentLevel + 2
    );

    lines.push(...subFunctionLines);
  }

  return lines;
}

/**
 * Extract string parameters.
 * Adapt the property names here if your real config uses different names.
 */
function getStringParameters(functionObject) {
  const candidates = [
    // functionObject.stringParameters,
    // functionObject["string-parameters"],
    functionObject['parameter'],  // This must be the official one
    // functionObject.parameters,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (item) =>
          item &&
          typeof item === "object" &&
          item['parameter-name'] &&
          item['value'] !== undefined
      );
    }
  }

  return [];
}

/**
 * Extract sub-functions.
 * Adapt the property names here if your real config uses different names.
 */
function getSubFunctions(functionObject) {
  const candidates = [
    // functionObject.subFunctions,
    functionObject["sub-function"],    // This must be the official one
    // functionObject.functions,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item) => item && typeof item === "object");
    }
  }

  return [];
}

module.exports = p1DocumentFunction;
