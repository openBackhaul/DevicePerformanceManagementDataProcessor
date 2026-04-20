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
        break;
      }

      if (ch === "," || ch === ";") {
        index += 1;
        continue;
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
        index += 1;
        continue;
      }

      if (source[index] === "(") {
        index += 1;
        out[name] = parseNode(")");
      } else {
        out[name] = true;
      }
    }

    return out;
  }

  return parseNode(null);
}

function isEmptyObject(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
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

  if (!data || typeof data !== "object") {
    return undefined;
  }

  const out = {};

  for (const [key, subTree] of Object.entries(tree || {})) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) {
      continue;
    }

    const value =
      subTree === true ? data[key] : project(data[key], subTree);

    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value) && value.length === 0) {
      continue;
    }

    if (isEmptyObject(value)) {
      continue;
    }

    out[key] = value;
  }

  return out;
}

function applyFieldsFilter(dataStructure, fieldsFilterString) {
  if (!fieldsFilterString || !String(fieldsFilterString).trim()) {
    return dataStructure;
  }

  return project(dataStructure, parse(fieldsFilterString)) || {};
}

module.exports = {
  applyFieldsFilter
};