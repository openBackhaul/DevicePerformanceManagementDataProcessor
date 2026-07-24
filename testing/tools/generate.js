const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFileIfMissing(filePath, content) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, "utf8");
  }
}

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, "utf8"));
}

function getDefaultJsonContent() {
  return JSON.stringify({}, null, 2) + "\n";
}

function getDefaultErrorSchema() {
  return JSON.stringify(
    {
      type: "string"
    },
    null,
    2
  ) + "\n";
}

function getDefaultOutputSchema() {
  return JSON.stringify(
    {
      type: "object"
    },
    null,
    2
  ) + "\n";
}

function createFixturesForScenario(baseDir, scenario) {
  const fixtureRoot = path.join(baseDir, "fixture");
  const scenarioDir = path.join(fixtureRoot, scenario.id);

  ensureDir(scenarioDir);

  const inputFixtureName = scenario.inputFixture || "input.json";
  writeFileIfMissing(
    path.join(scenarioDir, inputFixtureName),
    getDefaultJsonContent()
  );

  if (scenario.expected?.type === "success") {
    const outputFixtureName = scenario.expected.outputFixture || "output.json";
    writeFileIfMissing(
      path.join(scenarioDir, outputFixtureName),
      getDefaultJsonContent()
    );

    if (scenario.expected.outputSchemaFixture) {
      writeFileIfMissing(
        path.join(scenarioDir, scenario.expected.outputSchemaFixture),
        getDefaultOutputSchema()
      );
    }
  }

  if (scenario.expected?.type === "error") {
    if (scenario.expected.errorSchemaFixture) {
      writeFileIfMissing(
        path.join(scenarioDir, scenario.expected.errorSchemaFixture),
        getDefaultErrorSchema()
      );
    }
  }

  for (const mock of scenario.mocks || []) {
    if (mock.fixture) {
      writeFileIfMissing(
        path.join(scenarioDir, mock.fixture),
        getDefaultJsonContent()
      );
    }

    if (Array.isArray(mock.fixtureSequence)) {
      for (const fixtureName of mock.fixtureSequence) {
        writeFileIfMissing(
          path.join(scenarioDir, fixtureName),
          getDefaultJsonContent()
        );
      }
    }
  }

  console.log(`Created fixture folder: ${scenarioDir}`);
}

function main() {
  const scenariosPathArg = process.argv[2];

  if (!scenariosPathArg) {
    console.error(
      "Usage: node scripts/create-scenario-fixture-folders.js <path-to-scenarios.yaml>"
    );
    process.exit(1);
  }

  const scenariosPath = path.resolve(scenariosPathArg);

  if (!fs.existsSync(scenariosPath)) {
    console.error(`scenarios.yaml not found: ${scenariosPath}`);
    process.exit(1);
  }

  const baseDir = path.dirname(scenariosPath);
  const spec = readYaml(scenariosPath);
  const scenarios = spec.scenarios || [];

  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    console.error(`No scenarios found in ${scenariosPath}`);
    process.exit(1);
  }

  ensureDir(path.join(baseDir, "fixture"));

  for (const scenario of scenarios) {
    if (!scenario.id) {
      console.warn("Skipping scenario without id");
      continue;
    }

    createFixturesForScenario(baseDir, scenario);
  }

  console.log("Done.");
}

main();