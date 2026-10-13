/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 * Source: testing\provideDeviceDataStoreDump\scenarios.yaml
 */

const path = require("path");
const { runFunctionVersionFromScenarios } = require("../../tools/functionTestRunner");

const repoRoot = path.resolve(__dirname, "../../..");

describe("provideDeviceDataStoreDump  ", () => {
  runFunctionVersionFromScenarios({
    repoRoot,
    functionName: "provideDeviceDataStoreDump"
  });
});
