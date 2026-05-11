/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 * Source: testing\p1InitKafka\scenarios.yaml
 */

const path = require("path");
const { runFunctionVersionFromScenarios } = require("../../tools/functionTestRunner");

const repoRoot = path.resolve(__dirname, "../../..");

describe("p1InitKafka ", () => {
  runFunctionVersionFromScenarios({
    repoRoot,
    functionName: "p1InitKafka"
  });
});
