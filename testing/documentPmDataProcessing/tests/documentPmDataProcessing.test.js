/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 * Source: testing\documentPmDataProcessing\scenarios.yaml
 */

const path = require("path");
const { runFunctionVersionFromScenarios } = require("../../tools/functionTestRunner");

const repoRoot = path.resolve(__dirname, "../../..");

describe("documentPmDataProcessing  ", () => {
  runFunctionVersionFromScenarios({
    repoRoot,
    functionName: "documentPmDataProcessing"
  });
});
