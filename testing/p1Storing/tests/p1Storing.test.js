/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 * Source: testing\p1Storing\scenarios.yaml
 */

const path = require("path");
const { runFunctionVersionFromScenarios } = require("../../tools/functionTestRunner");

const repoRoot = path.resolve(__dirname, "../../..");

describe("p1Storing  ", () => {
  runFunctionVersionFromScenarios({
    repoRoot,
    functionName: "p1Storing"
  });
});
