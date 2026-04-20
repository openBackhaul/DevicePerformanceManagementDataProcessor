function getControlConstruct(configFile) {
  return configFile["core-model-1-4:control-construct"] || configFile;
}

function getProfileList(configFile) {
  return (((getControlConstruct(configFile) || {})["profile-collection"] || {}).profile) || [];
}

function buildMaps(configFile) {
  const profileList = getProfileList(configFile);
  const byUuid = new Map();

  for (const profile of profileList) {
    byUuid.set(profile.uuid, profile);
  }

  return { profileList, byUuid };
}

function getFunctionProfileData(profile) {
  const pac = profile["function-profile-1-0:function-profile-pac"] || {};

  return {
    capability: pac["function-profile-capability"] || {},
    configuration: pac["function-profile-configuration"] || {}
  };
}

function getStringProfileData(profile) {
  const pac = profile["string-profile-1-0:string-profile-pac"] || {};

  return {
    capability: pac["string-profile-capability"] || {},
    configuration: pac["string-profile-configuration"] || {}
  };
}

function findFunctionProfileByName(configFile, functionName) {
  const { profileList } = buildMaps(configFile);

  return (
    profileList.find((profile) => {
      if (!String(profile["profile-name"] || "").includes("FUNCTION_PROFILE")) {
        return false;
      }

      return (
        getFunctionProfileData(profile).capability["function-name"] === functionName
      );
    }) || null
  );
}

function buildFunctionNode(configFile, functionProfile) {
  const { byUuid } = buildMaps(configFile);
  const functionData = getFunctionProfileData(functionProfile);

  const node = {
    "function-name": functionData.capability["function-name"],
    description: functionData.capability["function-description"] || "",
    "is-active": Boolean(functionData.configuration["is-active"]),
    parameter: [],
    "sub-function": []
  };

  for (const parameterRef of functionData.capability["parameter-list"] || []) {
    const stringProfile = byUuid.get(parameterRef.parameter);
    if (!stringProfile) {
      continue;
    }

    const stringData = getStringProfileData(stringProfile);

    const parameter = {
      "parameter-name": stringData.capability["string-name"],
      purpose: stringData.capability["string-purpose"] || "",
      owner: parameterRef.owner || "platform",
      value: stringData.configuration["string-value"]
    };

    if (stringData.capability.pattern !== undefined) {
      parameter.pattern = stringData.capability.pattern;
    }

    if (stringData.capability.enumeration !== undefined) {
      parameter.enumeration = stringData.capability.enumeration;
    }

    node.parameter.push(parameter);
  }

  for (const subFunctionUuid of functionData.capability["sub-function-list"] || []) {
    const subFunctionProfile = byUuid.get(subFunctionUuid);
    if (!subFunctionProfile) {
      continue;
    }

    node["sub-function"].push(buildFunctionNode(configFile, subFunctionProfile));
  }

  return node;
}

function loadFunctionParameters(configFile, functionName) {
  const functionProfile = findFunctionProfileByName(configFile, functionName);

  if (!functionProfile) {
    throw new Error("Function profile not found for " + functionName);
  }

  return buildFunctionNode(configFile, functionProfile);
}

function findFunctionNode(tree, functionName) {
  if (!tree) {
    return null;
  }

  if (tree["function-name"] === functionName) {
    return tree;
  }

  for (const subFunction of tree["sub-function"] || []) {
    const hit = findFunctionNode(subFunction, functionName);
    if (hit) {
      return hit;
    }
  }

  return null;
}

function getParamFromFunction(tree, functionName, paramName, defaultValue) {
  const functionNode = findFunctionNode(tree, functionName);

  if (!functionNode) {
    return defaultValue;
  }

  const found = (functionNode.parameter || []).find(
    (item) => item && item["parameter-name"] === paramName
  );

  return found && found.value !== undefined ? found.value : defaultValue;
}

function getParamsByPurpose(tree, functionName, purpose) {
  const functionNode = findFunctionNode(tree, functionName);

  if (!functionNode) {
    return [];
  }

  return (functionNode.parameter || []).filter(
    (item) => item && item.purpose === purpose
  );
}

module.exports = {
  loadFunctionParameters,
  findFunctionNode,
  getParamFromFunction,
  getParamsByPurpose
};