/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 * Source: testing\p1ResolveEsAddress\scenarios.yaml
 */

const path = require("path");
const { runFunctionVersionFromScenarios } = require("../../tools/functionTestRunner");

const repoRoot = path.resolve(__dirname, "../../..");

describe("p1ResolveEsAddress undefined (generated)", () => {
  runFunctionVersionFromScenarios({
    repoRoot,
    functionName: "p1ResolveEsAddress",
    version: "undefined",
  });
});
