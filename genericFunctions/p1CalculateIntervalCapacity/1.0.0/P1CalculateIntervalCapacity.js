
const p1CalculateIntervalCapacity = (input) => {
  try {

    const timeXstatesList = input["time-xstates-list"];
    const transmissionModeList = input["transmission-mode-list"];

    if (timeXstatesList === undefined) {
      throw "timeXstatesList not provided";
    }

    if (!Array.isArray(timeXstatesList)) {
      throw "timeXstatesList invalid";
    }

    if (transmissionModeList === undefined) {
      throw "transmissionModeList not provided";
    }

    if (!Array.isArray(transmissionModeList)) {
      throw "transmissionModeList invalid";
    }

    const capacityMap = new Map();

    for (const mode of transmissionModeList) {
      capacityMap.set(mode["transmission-mode"], mode.capacity);
    }

    let totalOfferedVolume = 0;
    let totalTime = 0;

    for (const state of timeXstatesList) {

      const capacity = capacityMap.get(state["transmission-mode"]);

      if (capacity === undefined) {
        continue;
      }

      const time = state.time;

      const offeredVolume = capacity * time;

      totalOfferedVolume += offeredVolume;
      totalTime += time;
    }

    const intervalCapacity =
      totalTime === 0 ? 0 : Math.round(totalOfferedVolume / totalTime);

    return {
      "interval-capacity": intervalCapacity
    };

  } catch (err) {

    if (typeof err === "string") {
      return {
        "error": err
      };
    }



    return {
      "error": "General processing error",
    };
  }
}

module.exports = p1CalculateIntervalCapacity;
