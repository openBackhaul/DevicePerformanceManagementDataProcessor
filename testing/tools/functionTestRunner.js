const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, "utf8"));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function cloneValue(value) {
  if (value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

function readJsonCloned(filePath) {
  return cloneValue(readJson(filePath));
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

function resolveMockValue(mockDef, scenarioDir, stepId, currentCallIndex) {
  const repeatLast = mockDef.repeatLast !== false;

  if (mockDef.fixtureSequence !== undefined) {
    const fixtureName = getSequenceItem(
      mockDef.fixtureSequence,
      currentCallIndex,
      stepId,
      "fixture",
      repeatLast
    );
    return readJsonCloned(path.join(scenarioDir, fixtureName));
  }

  if (mockDef.fixture) {
    return readJsonCloned(path.join(scenarioDir, mockDef.fixture));
  }

  if (mockDef.value !== undefined) {
    return cloneValue(mockDef.value);
  }

  throw new Error(
    `Mock for step '${stepId}' with type '${mockDef.type}' requires 'fixture', 'fixtureSequence', or 'value'`
  );
}

function resolveMockError(mockDef, stepId, currentCallIndex) {
  const repeatLast = mockDef.repeatLast !== false;

  if (mockDef.errorSequence !== undefined) {
    return getSequenceItem(
      mockDef.errorSequence,
      currentCallIndex,
      stepId,
      "error",
      repeatLast
    );
  }

  if (mockDef.error !== undefined) {
    return mockDef.error;
  }

  throw new Error(
    `Mock for step '${stepId}' with type '${mockDef.type}' requires 'error' or 'errorSequence'`
  );
}

function toRealError(errVal) {
  if (errVal instanceof Error) {
    return errVal;
  }

  if (typeof errVal === "string") {
    return new Error(errVal);
  }

  if (errVal && typeof errVal === "object") {
    const message = errVal.message || "Mocked error";

    if (errVal.name === "SyntaxError") {
      const e = new SyntaxError(message);
      Object.assign(e, errVal);
      return e;
    }

    if (errVal.name === "TypeError") {
      const e = new TypeError(message);
      Object.assign(e, errVal);
      return e;
    }

    if (errVal.name === "ReferenceError") {
      const e = new ReferenceError(message);
      Object.assign(e, errVal);
      return e;
    }

    const e = new Error(message);
    Object.assign(e, errVal);
    if (errVal.name) {
      e.name = errVal.name;
    }
    return e;
  }

  return new Error(String(errVal));
}

function createMockFunction({ scenarioDir, stepId, mockDef, fallbackIsAsync = false }) {
  let callIndex = 0;
  const isAsync = mockDef.isAsync === true || fallbackIsAsync === true;

  return jest.fn(() => {
    const currentCallIndex = callIndex;
    callIndex += 1;

    if (mockDef.type === "return" || mockDef.type === "returnSequence") {
      const val = resolveMockValue(mockDef, scenarioDir, stepId, currentCallIndex);
      return isAsync ? Promise.resolve(val) : val;
    }

    if (mockDef.type === "throw" || mockDef.type === "throwSequence") {
      const errVal = toRealError(resolveMockError(mockDef, stepId, currentCallIndex));
      if (isAsync) {
        return Promise.reject(errVal);
      }
      throw errVal;
    }

    throw new Error(`Unknown mock type '${mockDef.type}' for step '${stepId}'`);
  });
}

function installDependencyMocks(dependencies = []) {
  for (const dep of dependencies) {
    if (!dep || !dep.name) {
      continue;
    }

    if (dep.name === "@confluentinc/kafka-javascript") {
      jest.doMock(
        dep.name,
        () => ({
          KafkaJS: {
            Kafka: jest.fn(() => ({})),
          },
        }),
        { virtual: true }
      );
      continue;
    }

    if (dep.name === "pino") {
      jest.doMock(
        dep.name,
        () => {
          const logger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            fatal: jest.fn(),
            trace: jest.fn(),
            child: jest.fn(() => logger),
          };

          const pinoMock = jest.fn(() => logger);

          pinoMock.transport = jest.fn(() => ({}));
          pinoMock.destination = jest.fn(() => ({}));
          pinoMock.stdTimeFunctions = {
            isoTime: jest.fn(),
          };

          return pinoMock;
        },
        { virtual: true }
      );
      continue;
    }

    jest.doMock(dep.name, () => ({}), { virtual: true });
  }
}

function installMocks({ scenarioDir, processingSteps, scenarioMocks }) {
  const exactMockByStepId = new Map((scenarioMocks || []).map((m) => [m.stepId, m]));

  for (const step of processingSteps) {
    const exactMock = exactMockByStepId.get(step.stepId);

    const childMocks = (scenarioMocks || []).filter(
      (m) => typeof m.stepId === "string" && m.stepId.startsWith(`${step.stepId}.`)
    );

    if (!exactMock && childMocks.length === 0) {
      continue;
    }

    if (childMocks.length > 0) {
      jest.doMock(step.modulePath, () => {
        const actualModule = jest.requireActual(step.modulePath);
        const mockedModule = { ...actualModule };

        for (const childMock of childMocks) {
          const exportName = childMock.stepId.slice(step.stepId.length + 1);

          if (!exportName) {
            throw new Error(`Invalid child mock stepId '${childMock.stepId}'`);
          }

          mockedModule[exportName] = createMockFunction({
            scenarioDir,
            stepId: childMock.stepId,
            mockDef: childMock,
            fallbackIsAsync: false,
          });
        }

        return mockedModule;
      });
      continue;
    }

    const isAsync = step.isAsync === true;

    jest.doMock(step.modulePath, () => {
      const fn = createMockFunction({
        scenarioDir,
        stepId: step.stepId,
        mockDef: exactMock,
        fallbackIsAsync: isAsync,
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
  const dependencies = spec.dependencies || [];

  if (!fut?.modulePath) {
    throw new Error(`Missing module.functionUnderTest.modulePath in ${scenariosPath}`);
  }

  for (const s of scenarios) {
    test(`${s.id}${s.description ? ` - ${s.description}` : ""}`, async () => {
      jest.restoreAllMocks();
      jest.resetAllMocks();
      jest.resetModules();

      const scenarioDir = path.join(baseDir, "fixture", s.id);
      const input = readJsonCloned(path.join(scenarioDir, s.inputFixture || "input.json"));

      installDependencyMocks(dependencies);

      installMocks({
        scenarioDir,
        processingSteps,
        scenarioMocks: s.mocks || [],
      });

      const futAbsPath = path.resolve(baseDir, fut.modulePath);
      const fn = loadFunctionUnderTest(futAbsPath, fut.exportName);

      if (s.expected?.type === "success") {
        const expectedOutput = readJsonCloned(
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