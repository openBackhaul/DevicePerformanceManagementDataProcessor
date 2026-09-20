/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 * Source: testing\p2IterateAiPmSlices\scenarios.yaml
 */

const path = require("path");
const { runFunctionVersionFromScenarios } = require("../../tools/functionTestRunner");

const repoRoot = path.resolve(__dirname, "../../..");

describe("p2IterateAiPmSlices  ", () => {
  runFunctionVersionFromScenarios({
    repoRoot,
    functionName: "p2IterateAiPmSlices"
  });
});
