#!/usr/bin/env node
/**
 * Generate fixtures for p1RemoveOutOfRangeTemperature scenarios.
 *
 * Usage:
 *   node scripts/create-p1RemoveOutOfRangeTemperature-fixtures.js testing/p1RemoveOutOfRangeTemperature/1.0.0/scenarios.yaml
 *
 * Output:
 *   Creates testing/p1RemoveOutOfRangeTemperature/1.0.0/fixture/<scenarioId>/{input.json,output.json?}
 *
 * Behavior (per spec variables.yaml):
 * - Read lower/upper limits from parameters.parameter[] where parameter-name is
 *   lowerTemperatureLimit / upperTemperatureLimit
 * - For each equipment[*].actual-equipment.physical-properties.temperature:
 *   delete temperature if temperature < lower OR temperature > upper
 *
 * Notes:
 * - Spec defines temperature and limits as strings; comparisons require parsing to numbers.
 * - If parsing fails (empty string, non-numeric), this generator keeps the temperature unchanged.
 * - Success scenarios get output.json computed.
 * - Error scenarios only get input.json (runner asserts errorEnum from scenarios.yaml).
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}
function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, "utf8"));
}
function writeJson(filePath, obj, { overwrite = false } = {}) {
  if (!overwrite && fs.existsSync(filePath)) return;
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + "\n", "utf8");
}
function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

const BASE_PARAMETERS = {
  "function-name": "p1RemoveOutOfRangeTemperature",
  "description": "Deletes temperature attributes with values outside pre-defined range from equipment",
  "is-active": true,
  "parameter": [
    {
      "parameter-name": "lowerTemperatureLimit",
      "purpose": "Lower bound of valid temperature values",
      "owner": "engineering",
      "value": "-40"
    },
    {
      "parameter-name": "upperTemperatureLimit",
      "purpose": "Upper bound of valid temperature values",
      "owner": "engineering",
      "value": "85"
    }
  ],
  "sub-function": []
};

const BASE_EQUIPMENT = [
  {
    "actual-equipment": {
      "physical-properties": { "temperature": "45" },
      "local-id": "EQUIPMENT-1",
      "structure": { "category": "core-model-1-4:EQUIPMENT_CATEGORY_SUBRACK" }
    },
    "uuid": "HUAWEI-EQUIPMENT-1"
  },
  {
    "actual-equipment": {
      "physical-properties": { "temperature": "" },
      "local-id": "4-2",
      "structure": { "category": "core-model-1-4:EQUIPMENT_CATEGORY_SMALL_FORMFACTOR_PLUGGABLE" }
    },
    "uuid": "WIRE-EQUIPMENT-4-2"
  },
  {
    "actual-equipment": {
      "physical-properties": { "temperature": "" },
      "local-id": "4-1",
      "structure": { "category": "core-model-1-4:EQUIPMENT_CATEGORY_SMALL_FORMFACTOR_PLUGGABLE" }
    },
    "uuid": "WIRE-EQUIPMENT-4-1"
  },
  {
    "actual-equipment": {
      "physical-properties": { "temperature": "-1" },
      "local-id": "4-4",
      "structure": { "category": "core-model-1-4:EQUIPMENT_CATEGORY_SMALL_FORMFACTOR_PLUGGABLE" }
    },
    "uuid": "WIRE-EQUIPMENT-4-4"
  },
  {
    "actual-equipment": {
      "physical-properties": { "temperature": "" },
      "local-id": "6-2",
      "structure": { "category": "core-model-1-4:EQUIPMENT_CATEGORY_SMALL_FORMFACTOR_PLUGGABLE" }
    },
    "uuid": "WIRE-EQUIPMENT-6-2"
  },
  {
    "actual-equipment": {
      "physical-properties": { "temperature": "-1" },
      "local-id": "4-3",
      "structure": { "category": "core-model-1-4:EQUIPMENT_CATEGORY_SMALL_FORMFACTOR_PLUGGABLE" }
    },
    "uuid": "WIRE-EQUIPMENT-4-3"
  },
  {
    "actual-equipment": {
      "physical-properties": { "temperature": "" },
      "local-id": "6-1",
      "structure": { "category": "core-model-1-4:EQUIPMENT_CATEGORY_SMALL_FORMFACTOR_PLUGGABLE" }
    },
    "uuid": "WIRE-EQUIPMENT-6-1"
  },
  {
    "actual-equipment": {
      "physical-properties": { "temperature": "" },
      "local-id": "5",
      "structure": { "category": "equipment-augment-1-0:EQUIPMENT_CATEGORY_MODEM" }
    },
    "uuid": "AIR-EQUIPMENT-5"
  },
  {
    "actual-equipment": {
      "physical-properties": { "temperature": "-1" },
      "local-id": "6-4",
      "structure": { "category": "core-model-1-4:EQUIPMENT_CATEGORY_SMALL_FORMFACTOR_PLUGGABLE" }
    },
    "uuid": "WIRE-EQUIPMENT-6-4"
  },
  {
    "actual-equipment": {
      "physical-properties": { "temperature": "-1" },
      "local-id": "6-3",
      "structure": { "category": "core-model-1-4:EQUIPMENT_CATEGORY_SMALL_FORMFACTOR_PLUGGABLE" }
    },
    "uuid": "WIRE-EQUIPMENT-6-3"
  },
  {
    "actual-equipment": {
      "physical-properties": { "temperature": "" },
      "local-id": "5-1",
      "structure": { "category": "equipment-augment-1-0:EQUIPMENT_CATEGORY_OUTDOOR_UNIT" }
    },
    "uuid": "AIR-EQUIPMENT-5-1"
  },
  { "uuid": "AIR-EQUIPMENT-5-2" },
  {
    "actual-equipment": {
      "physical-properties": { "temperature": "-1" },
      "local-id": "6",
      "structure": { "category": "equipment-augment-1-0:EQUIPMENT_CATEGORY_PORT_EXPANSION_BOARD" }
    },
    "uuid": "WIRE-EQUIPMENT-6"
  },
  {
    "actual-equipment": {
      "physical-properties": { "temperature": "-1" },
      "local-id": "4",
      "structure": { "category": "equipment-augment-1-0:EQUIPMENT_CATEGORY_PORT_EXPANSION_BOARD" }
    },
    "uuid": "WIRE-EQUIPMENT-4"
  }
];

function baseInput() {
  return {
    parameters: clone(BASE_PARAMETERS),
    equipment: clone(BASE_EQUIPMENT)
  };
}

function getLimit(parameters, name) {
  const list = Array.isArray(parameters?.parameter) ? parameters.parameter : [];
  const p = list.find((x) => x && x["parameter-name"] === name);
  return p?.value;
}
function parseMaybeNumber(s) {
  if (typeof s !== "string") return null;
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function applyRemoveOutOfRangeTemperature(equipment, parameters) {
  const out = clone(equipment);

  const lowerStr = getLimit(parameters, "lowerTemperatureLimit");
  const upperStr = getLimit(parameters, "upperTemperatureLimit");
  const lower = parseMaybeNumber(lowerStr);
  const upper = parseMaybeNumber(upperStr);

  // If limits missing/invalid, keep unchanged (generator choice to avoid crashing)
  if (lower === null || upper === null) return out;
  if (lower > upper) return out;

  for (const eq of out) {
    const tempPath = eq?.["actual-equipment"]?.["physical-properties"];
    if (!tempPath || typeof tempPath !== "object") continue;
    if (!Object.prototype.hasOwnProperty.call(tempPath, "temperature")) continue;

    const tStr = tempPath.temperature;
    const t = parseMaybeNumber(tStr);

    // If temperature can't be parsed (""), keep unchanged
    if (t === null) continue;

    if (t < lower || t > upper) {
      delete tempPath.temperature;
    }
  }

  return out;
}

function outputForSuccess(input) {
  return {
    equipment: applyRemoveOutOfRangeTemperature(input.equipment, input.parameters)
  };
}

function inputForScenarioId(id) {
  if (id === "errMissingInput") return null;

  if (id === "errParametersNotProvided") {
    const x = baseInput();
    delete x.parameters;
    return x;
  }

  if (id === "errParametersInvalid") {
    const x = baseInput();
    x.parameters = "not-an-object";
    return x;
  }

  if (id === "errEquipmentNotProvided") {
    const x = baseInput();
    delete x.equipment;
    return x;
  }

  if (id === "errEquipmentInvalid") {
    const x = baseInput();
    x.equipment = "not-an-array";
    return x;
  }

  if (id === "okEquipmentEmptyList") {
    const x = baseInput();
    x.equipment = [];
    return x;
  }

  if (id === "okNoParameterList") {
    const x = baseInput();
    delete x.parameters.parameter;
    return x;
  }

  if (id === "okEmptyParameterList") {
    const x = baseInput();
    x.parameters.parameter = [];
    return x;
  }

  if (id === "okLowerLimitMissing") {
    const x = baseInput();
    x.parameters.parameter = x.parameters.parameter.filter((p) => p["parameter-name"] !== "lowerTemperatureLimit");
    return x;
  }

  if (id === "okUpperLimitMissing") {
    const x = baseInput();
    x.parameters.parameter = x.parameters.parameter.filter((p) => p["parameter-name"] !== "upperTemperatureLimit");
    return x;
  }

  if (id === "okLimitsInvalidNonNumeric") {
    const x = baseInput();
    x.parameters.parameter = [
      { "parameter-name": "lowerTemperatureLimit", purpose: "lower", owner: "engineering", value: "cold" },
      { "parameter-name": "upperTemperatureLimit", purpose: "upper", owner: "engineering", value: "hot" }
    ];
    return x;
  }

  if (id === "okLimitsReversed") {
    const x = baseInput();
    x.parameters.parameter = [
      { "parameter-name": "lowerTemperatureLimit", purpose: "lower", owner: "engineering", value: "100" },
      { "parameter-name": "upperTemperatureLimit", purpose: "upper", owner: "engineering", value: "0" }
    ];
    return x;
  }

  if (id === "okTemperatureMissing") {
    const x = baseInput();
    // remove temperature from first element
    delete x.equipment[0]["actual-equipment"]["physical-properties"]["temperature"];
    return x;
  }

  if (id === "okTemperatureWithinRangeKeep") {
    const x = baseInput();
    // Ensure one temp is within range
    x.equipment[0]["actual-equipment"]["physical-properties"]["temperature"] = "45";
    x.parameters.parameter = [
      { "parameter-name": "lowerTemperatureLimit", purpose: "lower", owner: "engineering", value: "0" },
      { "parameter-name": "upperTemperatureLimit", purpose: "upper", owner: "engineering", value: "60" }
    ];
    return x;
  }

  if (id === "okTemperatureEqualsLowerLimitKeep") {
    const x = baseInput();
    x.equipment[0]["actual-equipment"]["physical-properties"]["temperature"] = "0";
    x.parameters.parameter = [
      { "parameter-name": "lowerTemperatureLimit", purpose: "lower", owner: "engineering", value: "0" },
      { "parameter-name": "upperTemperatureLimit", purpose: "upper", owner: "engineering", value: "60" }
    ];
    return x;
  }

  if (id === "okTemperatureEqualsUpperLimitKeep") {
    const x = baseInput();
    x.equipment[0]["actual-equipment"]["physical-properties"]["temperature"] = "60";
    x.parameters.parameter = [
      { "parameter-name": "lowerTemperatureLimit", purpose: "lower", owner: "engineering", value: "0" },
      { "parameter-name": "upperTemperatureLimit", purpose: "upper", owner: "engineering", value: "60" }
    ];
    return x;
  }

  if (id === "okTemperatureBelowLowerDeleted") {
    const x = baseInput();
    x.equipment[0]["actual-equipment"]["physical-properties"]["temperature"] = "-50";
    x.parameters.parameter = [
      { "parameter-name": "lowerTemperatureLimit", purpose: "lower", owner: "engineering", value: "-40" },
      { "parameter-name": "upperTemperatureLimit", purpose: "upper", owner: "engineering", value: "85" }
    ];
    return x;
  }

  if (id === "okTemperatureAboveUpperDeleted") {
    const x = baseInput();
    x.equipment[0]["actual-equipment"]["physical-properties"]["temperature"] = "90";
    x.parameters.parameter = [
      { "parameter-name": "lowerTemperatureLimit", purpose: "lower", owner: "engineering", value: "-40" },
      { "parameter-name": "upperTemperatureLimit", purpose: "upper", owner: "engineering", value: "85" }
    ];
    return x;
  }

  if (id === "okMultipleEquipmentMixed") {
    const x = baseInput();
    // mix: within, below, above, empty
    x.equipment[0]["actual-equipment"]["physical-properties"]["temperature"] = "45";  // keep
    x.equipment[1]["actual-equipment"]["physical-properties"]["temperature"] = "-50"; // delete
    x.equipment[2]["actual-equipment"]["physical-properties"]["temperature"] = "90";  // delete
    x.equipment[3]["actual-equipment"]["physical-properties"]["temperature"] = "";    // keep as-is
    x.parameters.parameter = [
      { "parameter-name": "lowerTemperatureLimit", purpose: "lower", owner: "engineering", value: "-40" },
      { "parameter-name": "upperTemperatureLimit", purpose: "upper", owner: "engineering", value: "85" }
    ];
    return x;
  }

  if (id === "okNestedStructuresMissing") {
    const x = baseInput();
    // remove actual-equipment from one entry and physical-properties from another
    delete x.equipment[0]["actual-equipment"]["physical-properties"];
    delete x.equipment[1]["actual-equipment"];
    return x;
  }

  return baseInput();
}

function main() {
  const scenariosPathArg = process.argv[2];
  if (!scenariosPathArg) {
    console.error("ERROR: provide path to scenarios.yaml");
    process.exit(1);
  }

  const absScenariosPath = path.resolve(process.cwd(), scenariosPathArg);
  const spec = readYaml(absScenariosPath);
  const scenarios = spec?.scenarios || [];

  const baseDir = path.dirname(absScenariosPath);
  const fixtureRoot = path.join(baseDir, "fixture");
  mkdirp(fixtureRoot);

  for (const s of scenarios) {
    const id = s?.id;
    if (!id) continue;

    const scenarioDir = path.join(fixtureRoot, id);
    mkdirp(scenarioDir);

    const input = inputForScenarioId(id);
    const inputName = s.inputFixture || "input.json";
    writeJson(path.join(scenarioDir, inputName), input);

    if (s?.expected?.type === "success") {
      const output = outputForSuccess(input);
      const outName = s.expected.outputFixture || "output.json";
      writeJson(path.join(scenarioDir, outName), output);
    }
  }

  console.log(`Done. Created fixtures under: ${fixtureRoot}`);
}

main();