/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 * Source: testing\p1CalculateInterfacePmDataQuality\scenarios.yaml
 */

const path = require("path");
const { runFunctionVersionFromScenarios } = require("../../tools/functionTestRunner");

const repoRoot = path.resolve(__dirname, "../../..");

describe("p1CalculateInterfacePmDataQuality  ", () => {
  runFunctionVersionFromScenarios({
    repoRoot,
    functionName: "p1CalculateInterfacePmDataQuality"
  });
});
