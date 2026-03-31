const ERRORS = require('./ErrorsEnum');

const p1CalculateIntervalCapacity = (input) => {
  try {

    const timeXstatesList = input["time-xstates-list"];
    const transmissionModeList = input["transmission-mode-list"];

    // Based validation
    if (timeXstatesList === undefined) {
      return ERRORS.TIMEXSTATES_NOT_PROVIDED;
    }

    if (!Array.isArray(timeXstatesList)) {
      return ERRORS.TIMEXSTATES_INVALID;
    }

    if (transmissionModeList === undefined) {
      return ERRORS.TRANSMODE_NOT_PROVIDED;
    }

    if (!Array.isArray(transmissionModeList)) {
      return ERRORS.TRANSMODE_INVALID;
    }

    // Mapping all the capacity for each profile
    const capacityMap = new Map();
    for (const mode of transmissionModeList) {
      capacityMap.set(mode["transmission-mode-name"], mode.capacity);
    }

    let totalOfferedVolume = 0;
    let totalTime = 0;

    // Calculate offered volume for each state
    for (const state of timeXstatesList) {
      const capacity = capacityMap.get(state["transmission-mode"]);

      // In case capacity is not present, skip the state
      if (capacity === undefined) {
        continue;
      }

      const time = state.time;
      const offeredVolume = capacity * time;  // Offered Volume is calculate by capacity and time

      totalOfferedVolume += offeredVolume;
      totalTime += time;
    }

    const intervalCapacity =
      totalTime === 0 ? 0 : Math.round(totalOfferedVolume / totalTime);

    // Return value
    return {
      "interval-capacity": intervalCapacity
    };

  } catch (err) {
    return ERRORS.GENERAL_ERROR;
  }
}

module.exports = p1CalculateIntervalCapacity;
