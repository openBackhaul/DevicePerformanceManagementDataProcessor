/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 * Source: testing\p1IterateAiPmSlices\scenarios.yaml
 */

const path = require("path");
const { runFunctionVersionFromScenarios } = require("../../tools/functionTestRunner");

const repoRoot = path.resolve(__dirname, "../../..");

describe("p1IterateAiPmSlices testing", () => {
  runFunctionVersionFromScenarios({
    repoRoot,
    functionName: "p1IterateAiPmSlices"
  });
});
