/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 * Source: testing\p1DiscardIrrelevantPmRecords\1.0.0\scenarios.yaml
 */

const path = require("path");
const { runFunctionVersionFromScenarios } = require("../../tools/functionTestRunner");

const repoRoot = path.resolve(__dirname, "../../..");

describe("p1DiscardIrrelevantPmRecords 1.0.0 (generated)", () => {
  runFunctionVersionFromScenarios({
    repoRoot,
    functionName: "p1DiscardIrrelevantPmRecords",
    version: "1.0.0",
  });
});
