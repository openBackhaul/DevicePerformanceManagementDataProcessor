/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 * Source: testing\p1CalculateBusyHourPerformanceIndicators\scenarios.yaml
 */

const path = require("path");
const { runFunctionVersionFromScenarios } = require("../../tools/functionTestRunner");

const repoRoot = path.resolve(__dirname, "../../..");

describe("p1CalculateBusyHourPerformanceIndicators  ", () => {
  runFunctionVersionFromScenarios({
    repoRoot,
    functionName: "p1CalculateBusyHourPerformanceIndicators"
  });
});
