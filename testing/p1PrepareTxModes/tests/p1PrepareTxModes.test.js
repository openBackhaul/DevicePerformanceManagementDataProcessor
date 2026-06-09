/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 * Source: testing\p1PrepareTxModes\scenarios.yaml
 */

const path = require("path");
const { runFunctionVersionFromScenarios } = require("../../tools/functionTestRunner");

const repoRoot = path.resolve(__dirname, "../../..");

describe("p1PrepareTxModes testing", () => {
  runFunctionVersionFromScenarios({
    repoRoot,
    functionName: "p1PrepareTxModes"
  });
});
