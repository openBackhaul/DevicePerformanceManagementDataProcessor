
const performanceStruct = {
  "es": 0,
  "ses": 0,
  "cses": 0,
  "unavailability": 0,
  "tx-level-min": 0,
  "tx-level-max": 0,
  "tx-level-avg": 0,
  "rx-level-min": 0,
  "rx-level-max": 0,
  "rx-level-avg": 0,
  "time-xstates-list": [
    {"transmission-mode": "A"},
    {"transmission-mode": "B"},
    {"transmission-mode": "C"},
  ],
  "interval-capacity": 0,
  "snir-min": 0,
  "snir-max": 0,
  "snir-avg": 0,
  "xpd-min": 0,
  "xpd-max": 0,
  "xpd-avg": 0,
  "defect-blocks-sum": 0,
  "time-period": 100
}

const parameterStruct = {
  "lower-tx-level-limit": "",   // Lower bound of valid values of the transmit level
  "upper-tx-level-limit": "",   // Upper bound of valid values of the transmit level
  "lower-rx-level-limit": "",   // Lower bound of valid values of the receive level
  "upper-rx-level-limit": "",   // Upper bound of valid values of the receive level
}



const p1RemoveOutOfRangeLevels = (input) => {
  const parameters = input["parameters"];
  const performanceData = input["performance-data"];

  if (performanceData["tx-level-min"] < parameters["lower-tx-level-limit"] &&
      performanceData["tx-level-min"] > parameters["upper-tx-level-limit"] 
  ) {
    // drop entry
  }

  return {
    "performance-data": performanceData
  }
}