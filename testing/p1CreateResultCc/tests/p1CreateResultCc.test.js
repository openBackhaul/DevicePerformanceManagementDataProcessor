/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 * Source: testing\p1CreateResultCc\scenarios.yaml
 */

const path = require("path");
const { runFunctionVersionFromScenarios } = require("../../tools/functionTestRunner");

const repoRoot = path.resolve(__dirname, "../../..");

describe("p1CreateResultCc  ", () => {
  runFunctionVersionFromScenarios({
    repoRoot,
    functionName: "p1CreateResultCc"
  });
});
