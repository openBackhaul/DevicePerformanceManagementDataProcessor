/**
 * Generator:
 * - reads testing/<FunctionName>/<version>/scenarios.yaml
 * - generates testing/<FunctionName>/<version>/tests/<FunctionName>.test.js
 *
 * The generated test file calls the shared runner, which:
 * - dynamically applies mocks per scenario
 * - executes the function under test
 * - asserts results
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, "utf8"));
}

function generate({ repoRoot, functionName, version }) {
  const baseDir = path.join(repoRoot, "testing", functionName, version);
  const scenariosPath = path.join(baseDir, "scenarios.yaml");

  const spec = readYaml(scenariosPath);

  // Optional sanity checks (nice to fail early at generation time)
  if (!spec?.module?.functionUnderTest?.modulePath) {
    throw new Error(`Missing module.functionUnderTest.modulePath in ${scenariosPath}`);
  }
  if (!Array.isArray(spec.scenarios) || spec.scenarios.length === 0) {
    throw new Error(`No scenarios found in ${scenariosPath}`);
  }

  const outDir = path.join(baseDir, "tests");
  ensureDir(outDir);

  const outPath = path.join(outDir, `${functionName}.test.js`);

  // Keep the generated test intentionally thin: runner owns execution & mocking.
  const content = `/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 * Source: ${path.relative(repoRoot, scenariosPath)}
 */

const path = require("path");
const { runFunctionVersionFromScenarios } = require("../../../tools/functionTestRunner");

const repoRoot = path.resolve(__dirname, "../../../..");

describe("${functionName} ${version} (generated)", () => {
  runFunctionVersionFromScenarios({
    repoRoot,
    functionName: "${functionName}",
    version: "${version}",
  });
});
`;

  fs.writeFileSync(outPath, content, "utf8");
  return outPath;
}

// CLI:
if (require.main === module) {
  const repoRoot = path.resolve(__dirname, "../..");
  const [functionName, version] = process.argv.slice(2);

  if (!functionName || !version) {
    console.error("Usage: node testing/tools/generateFunctionTests.js <FunctionName> <version>");
    process.exit(1);
  }

  const out = generate({ repoRoot, functionName, version });
  console.log(`Generated: ${out}`);
}

module.exports = { generate };