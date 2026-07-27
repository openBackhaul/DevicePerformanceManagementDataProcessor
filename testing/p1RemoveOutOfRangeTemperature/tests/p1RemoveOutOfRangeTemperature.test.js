/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 * Source: testing\p1RemoveOutOfRangeTemperature\1.0.0\scenarios.yaml
 */

const path = require("path");
const { runFunctionVersionFromScenarios } = require("../../tools/functionTestRunner");

const repoRoot = path.resolve(__dirname, "../../..");

describe("p1RemoveOutOfRangeTemperature 1.0.0 (generated)", () => {
  runFunctionVersionFromScenarios({
    repoRoot,
    functionName: "p1RemoveOutOfRangeTemperature",
    version: "1.0.0",
  });
});
