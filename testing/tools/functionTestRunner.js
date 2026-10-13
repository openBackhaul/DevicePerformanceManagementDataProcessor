const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const ajv = new Ajv({
  allErrors: true,
  strict: false,
});
addFormats(ajv);

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

function formatSchemaErrors(errors = []) {
  return errors
    .map((err) => {
      const instancePath = err.instancePath || "/";
      return `${instancePath} ${err.message}`;
    })
    .join("\n");
}

function validateAgainstSchemaIfPresent({ scenarioDir, schemaFixtureName, data, label }) {
  if (!schemaFixtureName) {
    return false;
  }

  const schemaPath = path.join(scenarioDir, schemaFixtureName);

  if (!fs.existsSync(schemaPath)) {
    throw new Error(
      `${label} schema fixture '${schemaFixtureName}' was declared but not found at '${schemaPath}'`
    );
  }

  const schema = readJson(schemaPath);
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (!valid) {
    throw new Error(
      `${label} schema validation failed:\n${formatSchemaErrors(validate.errors)}`
    );
  }

  return true;
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

function materializeMockMethods(value, scenarioDir, stepIdPrefix = "") {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => materializeMockMethods(item, scenarioDir, stepIdPrefix));
  }

  if (typeof value !== "object") {
    return value;
  }

  const result = {};

  for (const [key, val] of Object.entries(value)) {
    if (key === "__mockMethods" && val && typeof val === "object" && !Array.isArray(val)) {
      for (const [methodName, methodDef] of Object.entries(val)) {
        result[methodName] = createMockFunction({
          scenarioDir,
          stepId: stepIdPrefix ? `${stepIdPrefix}.${methodName}` : methodName,
          mockDef: methodDef,
          fallbackIsAsync: methodDef?.isAsync === true,
        });
      }
      continue;
    }

    result[key] = materializeMockMethods(val, scenarioDir, stepIdPrefix);
  }

  return result;
}

function resolveMockValue(mockDef, scenarioDir, stepId, currentCallIndex) {
  const repeatLast = mockDef.repeatLast !== false;
  const fixtureSequence = mockDef.fixtureSequence ?? mockDef.fixtures;

  if (fixtureSequence !== undefined) {
    const fixtureName = getSequenceItem(
      fixtureSequence,
      currentCallIndex,
      stepId,
      "fixture",
      repeatLast
    );
    return materializeMockMethods(
      readJsonCloned(path.join(scenarioDir, fixtureName)),
      scenarioDir,
      stepId
    );
  }

  if (mockDef.fixture) {
    return materializeMockMethods(
      readJsonCloned(path.join(scenarioDir, mockDef.fixture)),
      scenarioDir,
      stepId
    );
  }

  if (mockDef.value !== undefined) {
    return materializeMockMethods(
      cloneValue(mockDef.value),
      scenarioDir,
      stepId
    );
  }

  throw new Error(
    `Mock for step '${stepId}' with type '${mockDef.type}' requires 'fixture', 'fixtureSequence'/'fixtures', or 'value'`
  );
}

function resolveMockError(mockDef, stepId, currentCallIndex) {
  const repeatLast = mockDef.repeatLast !== false;
  const errorSequence = mockDef.errorSequence ?? mockDef.errors;

  if (errorSequence !== undefined) {
    return getSequenceItem(
      errorSequence,
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
    `Mock for step '${stepId}' with type '${mockDef.type}' requires 'error' or 'errorSequence'/'errors'`
  );
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

    if (
      dep.name === "../../server/service/LoggingService.js" ||
      dep.name.endsWith("/service/LoggingService.js")
    ) {
      jest.doMock(dep.name, () => {
        const logger = {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
          fatal: jest.fn(),
          trace: jest.fn(),
          child: jest.fn(() => logger),
        };

        return {
          getLogger: jest.fn(() => logger),
        };
      });
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

function installFetchMocks(fetchMocks = []) {
  if (!Array.isArray(fetchMocks) || fetchMocks.length === 0) {
    return;
  }

  let callIndex = 0;

  global.fetch = jest.fn(async () => {
    const mockDef = getSequenceItem(fetchMocks, callIndex, "global.fetch", "fetch", true);
    callIndex += 1;

    if (mockDef.type === "throw") {
      throw toRealError(mockDef.error);
    }

    if (mockDef.type === "return") {
      const val = cloneValue(mockDef.value || {});
      return {
        ok: val.ok === true,
        status: val.status ?? 200,
        json: jest.fn().mockResolvedValue(cloneValue(val.json)),
      };
    }

    throw new Error(`Unknown fetch mock type '${mockDef.type}'`);
  });
}

function readScenarioInput(s, scenarioDir) {
  if (Object.prototype.hasOwnProperty.call(s, "input")) {
    return materializeMockMethods(cloneValue(s.input), scenarioDir, "input");
  }

  return materializeMockMethods(
    readJsonCloned(path.join(scenarioDir, s.inputFixture || "input.json")),
    scenarioDir,
    "input"
  );
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
    describe(`${s.id}${s.description ? ` - ${s.description}` : ""}`, () => {
      const scenarioDir = path.join(baseDir, "fixture", s.id);

      let actual;
      let thrown;
      let expectedOutput;
      let consoleErrorSpy;

      beforeAll(async () => {
        jest.restoreAllMocks();
        jest.resetAllMocks();
        jest.resetModules();
        delete global.fetch;

        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        const input = readScenarioInput(s, scenarioDir);

        installDependencyMocks(dependencies);

        installMocks({
          scenarioDir,
          processingSteps,
          scenarioMocks: s.mocks || [],
        });

        installFetchMocks(s.fetchMocks || []);

        const futAbsPath = path.resolve(baseDir, fut.modulePath);
        const fn = loadFunctionUnderTest(futAbsPath, fut.exportName);

        if (s.expected?.type === "success") {
          expectedOutput = readJsonCloned(
            path.join(scenarioDir, s.expected.outputFixture || "output.json")
          );

          actual = await fn(input);

          const actualOutputPath = path.join(scenarioDir, "actual_output.json");
          fs.writeFileSync(actualOutputPath, JSON.stringify(actual, null, 2), "utf8");
          return;
        }

        if (s.expected?.type === "error") {
          try {
            actual = await fn(input);
          } catch (err) {
            thrown = err;
          }
          return;
        }

        throw new Error(`Scenario '${s.id}' has invalid expected.type`);
      });

      afterAll(() => {
        if (consoleErrorSpy) {
          consoleErrorSpy.mockRestore();
        }
        delete global.fetch;
      });

      if (s.expected?.type === "success") {
        test(
          s.expected.outputSchemaFixture
            ? `schema validates against ${s.expected.outputSchemaFixture}`
            : "schema validation skipped",
          () => {
            if (!s.expected.outputSchemaFixture) {
              return;
            }

            const validated = validateAgainstSchemaIfPresent({
              scenarioDir,
              schemaFixtureName: s.expected.outputSchemaFixture,
              data: actual,
              label: `Scenario '${s.id}' success output`,
            });

            expect(validated).toBe(true);
          }
        );

        test(`output matches ${s.expected.outputFixture || "output.json"}`, () => {
          expect(actual).toEqual(expectedOutput);
        });
      } else if (s.expected?.type === "error") {
        test(
          s.expected.errorSchemaFixture
            ? `schema validates against ${s.expected.errorSchemaFixture}`
            : "schema validation skipped",
          () => {
            if (!s.expected.errorSchemaFixture) {
              return;
            }

            const errorValue = thrown !== undefined ? thrown : actual;

            const validated = validateAgainstSchemaIfPresent({
              scenarioDir,
              schemaFixtureName: s.expected.errorSchemaFixture,
              data: errorValue,
              label: `Scenario '${s.id}' error output`,
            });

            expect(validated).toBe(true);
          }
        );

        if (s.expected.errorFixture) {
          test(`error matches ${s.expected.errorFixture}`, () => {
            const expectedError = readJsonCloned(
              path.join(scenarioDir, s.expected.errorFixture)
            );
            expect(thrown).toEqual(expectedError);
          });
        } else {
          test(`error matches '${s.expected.errorEnum}'`, () => {
            if (typeof thrown === "string") {
              expect(thrown).toBe(s.expected.errorEnum);
            } else if (thrown && typeof thrown === "object" && "message" in thrown) {
              expect(thrown.message).toBe(s.expected.errorEnum);
            } else {
              expect(actual).toBe(s.expected.errorEnum);
            }
          });
        }
      }
    });
  }
}

module.exports = {
  runFunctionVersionFromScenarios,
};