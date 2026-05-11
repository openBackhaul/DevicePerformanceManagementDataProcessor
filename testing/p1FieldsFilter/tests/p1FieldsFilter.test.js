/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 * Source: testing\p1FieldsFilter\scenarios.yaml
 */

const path = require("path");
const { runFunctionVersionFromScenarios } = require("../../tools/functionTestRunner");

const repoRoot = path.resolve(__dirname, "../../..");

describe("p1FieldsFilter ", () => {
  runFunctionVersionFromScenarios({
    repoRoot,
    functionName: "p1FieldsFilter"
  });
});
