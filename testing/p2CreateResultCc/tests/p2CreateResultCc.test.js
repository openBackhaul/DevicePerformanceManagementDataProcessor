/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 * Source: testing\p2CreateResultCc\scenarios.yaml
 */

const path = require("path");
const { runFunctionVersionFromScenarios } = require("../../tools/functionTestRunner");

const repoRoot = path.resolve(__dirname, "../../..");

describe("p2CreateResultCc  ", () => {
  runFunctionVersionFromScenarios({
    repoRoot,
    functionName: "p2CreateResultCc"
  });
});
