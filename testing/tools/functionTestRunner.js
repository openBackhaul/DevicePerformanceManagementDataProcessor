/**
 * Runner:
 * - reads scenarios.yaml
 * - for each scenario:
 *   - loads input/output fixtures
 *   - installs mocks for each processing step (jest.doMock) based on scenario config
 *   - requires the function under test AFTER mocks
 *   - executes and asserts
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, "utf8"));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadFunctionUnderTest(absModulePath, exportName) {
  const mod = require(absModulePath);

  // "" or undefined => CommonJS default export (module.exports = fn)
  if (!exportName) {
    if (typeof mod !== "function") {
      throw new Error(`Expected default export to be a function in '${absModulePath}'`);
    }
    return mod;
  }

  const fn = mod[exportName];
  if (typeof fn !== "function") {
    throw new Error(`Export '${exportName}' not found or not a function in '${absModulePath}'`);
  }
  return fn;
}

function installMocks({ scenarioDir, processingSteps, scenarioMocks }) {
  const mockByStepId = new Map((scenarioMocks || []).map((m) => [m.stepId, m]));

  for (const step of processingSteps) {
    const m = mockByStepId.get(step.stepId);

    if (!m) {
      throw new Error(`Missing mock for step '${step.stepId}'`);
    }

    const isAsync = step.isAsync === true;

    jest.doMock(step.modulePath, () => {
      const fn = jest.fn(() => {
        if (m.type === "return") {
          const val = readJson(path.join(scenarioDir, m.fixture));
          return isAsync ? Promise.resolve(val) : val;
        }

        if (m.type === "throw") {
          if (isAsync) {
            return Promise.reject(m.error);
          }
          throw m.error;
        }

        throw new Error(`Unknown mock type '${m.type}' for step '${step.stepId}'`);
      });

      return { [step.exportName]: fn };
    });
  }
}

/**
 * Called by generated Jest tests.
 */
function runFunctionVersionFromScenarios({ repoRoot, functionName, version }) {
  const baseDir = path.join(repoRoot, "testing", functionName, version);
  const scenariosPath = path.join(baseDir, "scenarios.yaml");

  const spec = readYaml(scenariosPath);

  const fut = spec?.module?.functionUnderTest;
  const processingSteps = spec.processingSteps || [];
  const scenarios = spec.scenarios || [];

  if (!fut?.modulePath) {
    throw new Error(`Missing module.functionUnderTest.modulePath in ${scenariosPath}`);
  }

  for (const s of scenarios) {
    test(`${s.id}${s.description ? ` - ${s.description}` : ""}`, async () => {
      jest.resetModules();
      jest.clearAllMocks();

      const scenarioDir = path.join(baseDir,"fixture", s.id);

      // 1) Load input
      const input = readJson(path.join(scenarioDir, s.inputFixture || "input.json"));


      // 2) Install mocks (dynamic per scenario)
      installMocks({
        scenarioDir,
        processingSteps,
        scenarioMocks: s.mocks || [],
      });

      // 3) Execute function under test (require AFTER mocks)
      const futAbsPath = path.resolve(baseDir, fut.modulePath);
      const fn = loadFunctionUnderTest(futAbsPath, fut.exportName);

      // 4) Assert
      if (s.expected?.type === "success") {
        const expectedOutput = readJson(
          path.join(scenarioDir, s.expected.outputFixture || "output.json")
        );
        const actual = await fn(input);

        expect(actual).toEqual(expectedOutput);
        return;
      }

      if (s.expected?.type === "error") {
        // Two patterns are common:
        // A) function RETURNS error enum string 
        // B) function THROWS error enum string

        try {
          const actual = await fn(input);
          // If it returned, compare returned value to expected enum:
          expect(actual).toBe(s.expected.errorEnum);
        } catch (err) {
          // If it threw, compare thrown string/message:
          const thrown = typeof err === "string" ? err : err?.message;
          expect(thrown).toBe(s.expected.errorEnum);
        }
        return;
      }

      throw new Error(`Scenario '${s.id}' has invalid expected.type`);
    });
  }
}

module.exports = {
  runFunctionVersionFromScenarios,
};