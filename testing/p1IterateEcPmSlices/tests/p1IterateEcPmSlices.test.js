/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 * Source: testing\p1IterateEcPmSlices\scenarios.yaml
 */

const path = require("path");
const { runFunctionVersionFromScenarios } = require("../../tools/functionTestRunner");

const repoRoot = path.resolve(__dirname, "../../..");

describe("p1IterateEcPmSlices  ", () => {
  runFunctionVersionFromScenarios({
    repoRoot,
    functionName: "p1IterateEcPmSlices"
  });
});
