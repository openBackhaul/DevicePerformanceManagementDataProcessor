const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadConfigFile() {
  const filePath = global.databasePath
    ? path.resolve(global.databasePath)
    : path.resolve(__dirname, "./../database/config.json");

  return readJson(filePath);
}

function loadRuntimeConfig() {
  const filePath = global.runtimeConfigPath
    ? path.resolve(global.runtimeConfigPath)
    : path.resolve(__dirname, "./../database/runtime.json");

  return readJson(filePath);
}

module.exports = {
  readJson,
  loadConfigFile,
  loadRuntimeConfig
};