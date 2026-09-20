/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 * Source: testing\p2PrepareTxModes\scenarios.yaml
 */

const path = require("path");
const { runFunctionVersionFromScenarios } = require("../../tools/functionTestRunner");

const repoRoot = path.resolve(__dirname, "../../..");

describe("p2PrepareTxModes  ", () => {
  runFunctionVersionFromScenarios({
    repoRoot,
    functionName: "p2PrepareTxModes"
  });
});
