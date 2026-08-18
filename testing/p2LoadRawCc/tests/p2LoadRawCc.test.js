/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 * Source: testing\p2LoadRawCc\scenarios.yaml
 */

const path = require("path");
const { runFunctionVersionFromScenarios } = require("../../tools/functionTestRunner");

const repoRoot = path.resolve(__dirname, "../../..");

describe("p2LoadRawCc  ", () => {
  runFunctionVersionFromScenarios({
    repoRoot,
    functionName: "p2LoadRawCc"
  });
});
