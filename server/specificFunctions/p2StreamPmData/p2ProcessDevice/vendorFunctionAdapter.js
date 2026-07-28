"use strict";

const path = require("path");

const MODULES = Object.freeze({
  p1LoadOffsetsAndStatusData:
    "./p1LoadOffsetsAndStatusData/P1LoadOffsetsAndStatusData",
  p2DiscardIrrelevantPmRecords:
    "./p2LoadRawCc/p2DiscardIrrelevantPmRecords/P2DiscardIrrelevantPmRecords",
  p1CalculateInterfacePmDataQuality:
    "./p2LoadRawCc/p1CalculateInterfacePmDataQuality/P1CalculateInterfacePmDataQuality",
  p2PrepareTxModes:
    "./p2CreateResultCc/p2PrepareTxModes/P2PrepareTxModes",
  p2IterateAiPmSlices:
    "./p2CreateResultCc/p2IterateAiPmSlices/P2IterateAiPmSlices",
  p2IterateEcPmSlices:
    "./p2CreateResultCc/p2IterateEcPmSlices/P2IterateEcPmSlices",
  p2FormattingOutputOnf:
    "./p2FormattingOutputOnf/P2FormattingOutputOnf"
});

function integrationError(functionName, cause) {
  const relativePath = MODULES[functionName];
  const error = new Error(
    `Vendor function ${functionName} is unavailable. Expected local module ${relativePath}`
  );
  error.code = "VENDOR_FUNCTION_UNAVAILABLE";
  error.stage = functionName;
  error.retryable = false;
  error.cause = cause;
  return error;
}

function load(functionName, injectedDependencies) {
  const injected = injectedDependencies && injectedDependencies[functionName];
  if (injected) {
    return injected;
  }

  const relativePath = MODULES[functionName];
  if (!relativePath) {
    throw integrationError(functionName);
  }

  try {
    return require(path.resolve(__dirname, relativePath));
  } catch (error) {
    if (error && error.code !== "MODULE_NOT_FOUND") {
      throw error;
    }
    throw integrationError(functionName, error);
  }
}

async function invoke(functionName, request, injectedDependencies) {
  const implementation = load(functionName, injectedDependencies);
  const callable =
    typeof implementation === "function"
      ? implementation
      : implementation && typeof implementation.run === "function"
        ? implementation.run.bind(implementation)
        : implementation &&
            typeof implementation[functionName] === "function"
          ? implementation[functionName].bind(implementation)
          : null;

  if (!callable) {
    const error = new Error(
      `Vendor function ${functionName} does not export a function, run(), or ${functionName}()`
    );
    error.code = "VENDOR_FUNCTION_INVALID_EXPORT";
    error.stage = functionName;
    error.retryable = false;
    throw error;
  }

  return callable(request);
}

module.exports = {
  MODULES,
  invoke,
  load
};
