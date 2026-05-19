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

function getSequenceItem(sequence, index, stepId, kind, repeatLast = true) {
  if (!Array.isArray(sequence) || sequence.length === 0) {
    throw new Error(
      `Mock for step '${stepId}' declared ${kind}Sequence but it is empty or invalid`
    );
  }

  if (index < sequence.length) {
    return sequence[index];
  }

  if (repeatLast) {
    return sequence[sequence.length - 1];
  }

  throw new Error(
    `Mock for step '${stepId}' was called more times than configured in ${kind}Sequence ` +
      `(call #${index + 1}, configured ${sequence.length})`
  );
}

function installMocks({ scenarioDir, processingSteps, scenarioMocks }) {
  const mockByStepId = new Map((scenarioMocks || []).map((m) => [m.stepId, m]));

  for (const step of processingSteps) {
    const m = mockByStepId.get(step.stepId);

    if (!m) {
      continue;
    }

    const isAsync = step.isAsync === true;

    jest.doMock(step.modulePath, () => {
      let callIndex = 0;

      const fn = jest.fn(() => {
        const currentCallIndex = callIndex;
        console.log(`[Mock] ${step.stepId} called #${currentCallIndex+1}`);
        callIndex += 1;

        const repeatLast = m.repeatLast !== false;

        if (m.type === "return") {
          let val;

          if (m.fixtureSequence !== undefined) {
            const fixtureName = getSequenceItem(
              m.fixtureSequence,
              currentCallIndex,
              step.stepId,
              "fixture",
              repeatLast
            );
            val = readJson(path.join(scenarioDir, fixtureName));
          } else if (m.fixture) {
            val = readJson(path.join(scenarioDir, m.fixture));
          } else {
            throw new Error(
              `Mock for step '${step.stepId}' with type 'return' requires 'fixture' or 'fixtureSequence'`
            );
          }

          return isAsync ? Promise.resolve(val) : val;
        }

        if (m.type === "throw") {
          let errVal;

          if (m.errorSequence !== undefined) {
            errVal = getSequenceItem(
              m.errorSequence,
              currentCallIndex,
              step.stepId,
              "error",
              repeatLast
            );
          } else if (m.error !== undefined) {
            errVal = m.error;
          } else {
            throw new Error(
              `Mock for step '${step.stepId}' with type 'throw' requires 'error' or 'errorSequence'`
            );
          }

          if (isAsync) {
            return Promise.reject(errVal);
          }
          throw errVal;
        }

        throw new Error(`Unknown mock type '${m.type}' for step '${step.stepId}'`);
      });

      if (!step.exportName) {
        return fn;
      }

      return { [step.exportName]: fn };
    });
  }
}

/**
 * Called by generated Jest tests.
 */
function runFunctionVersionFromScenarios({ repoRoot, functionName }) {
  const baseDir = path.join(repoRoot, "testing", functionName);
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

      const scenarioDir = path.join(baseDir, "fixture", s.id);

      const input = readJson(path.join(scenarioDir, s.inputFixture || "input.json"));

      installMocks({
        scenarioDir,
        processingSteps,
        scenarioMocks: s.mocks || [],
      });

      const futAbsPath = path.resolve(baseDir, fut.modulePath);
      const fn = loadFunctionUnderTest(futAbsPath, fut.exportName);

      if (s.expected?.type === "success") {
        const expectedOutput = readJson(
          path.join(scenarioDir, s.expected.outputFixture || "output.json")
        );
        const actual = await fn(input);
      const actualOutputPath = path.join(scenarioDir, "actual_output.json");
      fs.writeFileSync(actualOutputPath, JSON.stringify(actual, null, 2), "utf8");

        expect(actual).toEqual(expectedOutput);
        return;
      }

      if (s.expected?.type === "error") {
        try {
          const actual = await fn(input);
          expect(actual).toBe(s.expected.errorEnum);
        } catch (err) {
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