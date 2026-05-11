function normalize(filterString) {
  return String(filterString || "")
    .replace(/;/g, ",")
    .replace(/\s+/g, "");
}

function parse(filterString) {
  const source = normalize(filterString);
  let index = 0;

  function parseNode(stopChar) {
    const out = {};

    while (index < source.length) {
      const ch = source[index];

      if (stopChar && ch === stopChar) {
        index += 1;
        return out;
      }

      if (ch === "," || ch === ";") {
        index += 1;
        continue;
      }

      if (ch === ")") {
        throw new Error("fieldsFilterString invalid");
      }

      let name = "";

      while (
        index < source.length &&
        !["(", ")", ",", ";"].includes(source[index])
      ) {
        name += source[index];
        index += 1;
      }

      if (!name) {
        throw new Error("fieldsFilterString invalid");
      }

      if (source[index] === "(") {
        index += 1;
        out[name] = parseNode(")");
      } else {
        out[name] = true;
      }
    }

    if (stopChar) {
      throw new Error("fieldsFilterString invalid");
    }

    return out;
  }

  return parseNode(null);
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function isEmptyObject(value) {
  return (
    isPlainObject(value) &&
    Object.keys(value).length === 0
  );
}

function hasOwn(data, key) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function stripCoreModelPrefix(key) {
  return String(key || "").replace(/^core-model-\d+-\d+:/, "");
}

function getCandidateKeys(data, requestedKey) {
  const keys = [];

  if (!isPlainObject(data)) {
    return keys;
  }

  if (hasOwn(data, requestedKey)) {
    keys.push(requestedKey);
  }

  const strippedKey = stripCoreModelPrefix(requestedKey);

  if (
    strippedKey !== requestedKey &&
    hasOwn(data, strippedKey) &&
    !keys.includes(strippedKey)
  ) {
    keys.push(strippedKey);
  }

  return keys;
}

function isGenericLayer1AggregationPacKey(key) {
  return (
    key ===
    "layer-1-aggregation-profile-1-0:layer-1-aggregation-profile-pac"
  );
}

function isGenericLayer1AggregationConfigurationKey(key) {
  return key === "layer-1-aggregation-profile-configuration";
}

function isProfilePacKey(key) {
  return /-profile-1-0:.*-pac$/.test(String(key || ""));
}

function isConfigurationKey(key) {
  return /-configuration$/.test(String(key || ""));
}

function getConfigurationObject(pacObject) {
  if (!isPlainObject(pacObject)) {
    return null;
  }

  for (const [key, value] of Object.entries(pacObject)) {
    if (isConfigurationKey(key) && isPlainObject(value)) {
      return {
        key,
        value
      };
    }
  }

  return null;
}

function isLayer1AggregationCandidate(profileObject, pacKey) {
  const profileName = String(profileObject["profile-name"] || "").toLowerCase();
  const normalizedPacKey = String(pacKey || "").toLowerCase();

  if (
    profileName.includes("layer-1") ||
    profileName.includes("aggregation") ||
    normalizedPacKey.includes("layer-1") ||
    normalizedPacKey.includes("aggregation")
  ) {
    return true;
  }

  const config = getConfigurationObject(profileObject[pacKey]);

  if (!config) {
    return false;
  }

  return (
    hasOwn(config.value, "client-ltp") ||
    hasOwn(config.value, "server-ltp-list")
  );
}

function projectProfilePacWithGenericConfig(pacObject, genericPacTree) {
  if (genericPacTree === true) {
    return pacObject;
  }

  if (!isPlainObject(pacObject)) {
    return undefined;
  }

  const out = {};

  for (const [requestedKey, subTree] of Object.entries(genericPacTree || {})) {
    if (isGenericLayer1AggregationConfigurationKey(requestedKey)) {
      for (const [actualConfigKey, actualConfigValue] of Object.entries(pacObject)) {
        if (!isConfigurationKey(actualConfigKey)) {
          continue;
        }

        const projectedConfig =
          subTree === true
            ? actualConfigValue
            : project(actualConfigValue, subTree);

        if (
          projectedConfig !== undefined &&
          projectedConfig !== null &&
          !isEmptyObject(projectedConfig)
        ) {
          out[actualConfigKey] = projectedConfig;
        }
      }

      continue;
    }

    for (const actualKey of getCandidateKeys(pacObject, requestedKey)) {
      const value =
        subTree === true
          ? pacObject[actualKey]
          : project(pacObject[actualKey], subTree);

      if (
        value !== undefined &&
        value !== null &&
        !(Array.isArray(value) && value.length === 0) &&
        !isEmptyObject(value)
      ) {
        out[actualKey] = value;
      }
    }
  }

  return isEmptyObject(out) ? undefined : out;
}

function projectGenericLayer1AggregationProfilePac(profileObject, genericPacTree) {
  if (!isPlainObject(profileObject)) {
    return undefined;
  }

  const out = {};

  for (const [actualPacKey, actualPacValue] of Object.entries(profileObject)) {
    if (!isProfilePacKey(actualPacKey)) {
      continue;
    }

    if (!isLayer1AggregationCandidate(profileObject, actualPacKey)) {
      continue;
    }

    const projectedPac = projectProfilePacWithGenericConfig(
      actualPacValue,
      genericPacTree
    );

    if (
      projectedPac !== undefined &&
      projectedPac !== null &&
      !isEmptyObject(projectedPac)
    ) {
      out[actualPacKey] = projectedPac;
    }
  }

  return isEmptyObject(out) ? undefined : out;
}

function project(data, tree) {
  if (tree === true) {
    return data;
  }

  if (Array.isArray(data)) {
    return data
      .map((item) => project(item, tree))
      .filter(
        (item) =>
          item !== undefined &&
          item !== null &&
          !isEmptyObject(item)
      );
  }

  if (!isPlainObject(data)) {
    return undefined;
  }

  const out = {};

  for (const [requestedKey, subTree] of Object.entries(tree || {})) {
    if (isGenericLayer1AggregationPacKey(requestedKey)) {
      const projectedGenericPac = projectGenericLayer1AggregationProfilePac(
        data,
        subTree
      );

      if (
        projectedGenericPac !== undefined &&
        projectedGenericPac !== null &&
        !isEmptyObject(projectedGenericPac)
      ) {
        Object.assign(out, projectedGenericPac);
      }

      continue;
    }

    const candidateKeys = getCandidateKeys(data, requestedKey);

    for (const actualKey of candidateKeys) {
      const value =
        subTree === true ? data[actualKey] : project(data[actualKey], subTree);

      if (value === undefined || value === null) {
        continue;
      }

      if (Array.isArray(value) && value.length === 0) {
        continue;
      }

      if (isEmptyObject(value)) {
        continue;
      }

      out[actualKey] = value;
    }
  }

  return out;
}

function getControlConstructWrapperKey(dataStructure) {
  if (!isPlainObject(dataStructure)) {
    return null;
  }

  return (
    Object.keys(dataStructure).find((key) =>
      /^core-model-\d+-\d+:control-construct$/.test(key)
    ) || null
  );
}

function applyFieldsFilter(dataStructure, fieldsFilterString) {
  if (!fieldsFilterString || !String(fieldsFilterString).trim()) {
    return dataStructure;
  }

  const parsedTree = parse(fieldsFilterString);
  const wrapperKey = getControlConstructWrapperKey(dataStructure);

  if (wrapperKey && !hasOwn(parsedTree, wrapperKey)) {
    const filteredInner = project(dataStructure[wrapperKey], parsedTree) || {};
    return {
      [wrapperKey]: filteredInner
    };
  }

  return project(dataStructure, parsedTree) || {};
}

module.exports = {
  applyFieldsFilter
};