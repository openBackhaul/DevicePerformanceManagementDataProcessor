/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 * Source: testing\p1CalculateIntervalCapacity\1.0.0\scenarios.yaml
 */

const path = require("path");
const { runFunctionVersionFromScenarios } = require("../../tools/functionTestRunner");

const repoRoot = path.resolve(__dirname, "../../..");

describe("p1CalculateIntervalCapacity 1.0.0 (generated)", () => {
  runFunctionVersionFromScenarios({
    repoRoot,
    functionName: "p1CalculateIntervalCapacity",
    version: "1.0.0",
  });
});
