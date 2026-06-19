const ERRORS = require('./ErrorsEnum');

function calculateTransmitTraffic(totalBytesOutput, timePeriod) {
  if (totalBytesOutput == null) {
    return ERRORS.TOTAL_BYTES_OUTPUT_NOT_PROVIDED;
  }

  const bytes = Number(totalBytesOutput);
  const time = Number(timePeriod);

  if (Number.isNaN(bytes)) {
    return ERRORS.TOTAL_BYTES_OUTPUT_INVALID;
  }
  if (timePeriod == null) {
    return ERRORS.TIME_PERIOD_NOT_PROVIDED;
  }
  if (Number.isNaN(time) || time <= 0) {
    return ERRORS.TIME_PERIOD_INVALID;
  }

  return Math.floor((bytes * 8) / (time * 1000000));
}

function calculateReceiveTraffic(totalBytesInput, timePeriod) {
  if (totalBytesInput == null) {
    return ERRORS.TOTAL_BYTES_INPUT_NOT_PROVIDED;
  }

  const bytes = Number(totalBytesInput);
  const time = Number(timePeriod);

  if (Number.isNaN(bytes)) {
    return ERRORS.TOTAL_BYTES_INPUT_INVALID;
  }
  if (timePeriod == null) {
    return ERRORS.TIME_PERIOD_NOT_PROVIDED;
  }
  if (Number.isNaN(time) || time <= 0) {
    return ERRORS.TIME_PERIOD_INVALID;
  }

  return Math.floor((bytes * 8) / (time * 1000000));
}

function calculateFrameLossInput(err, drop) {
  if (err == null) {
    return ERRORS.ERRORED_FRAMES_INPUT_NOT_PROVIDED;
  }
  if (drop == null) {
    return ERRORS.DROPPED_FRAMES_INPUT_NOT_PROVIDED;
  }

  const errNum = Number(err);
  const dropNum = Number(drop);

  if (Number.isNaN(errNum)) {
    return ERRORS.ERRORED_FRAMES_INPUT_INVALID;
  }
  if (Number.isNaN(dropNum)) {
    return ERRORS.DROPPED_FRAMES_INPUT_INVALID;
  }

  const safeErr = Math.max(0, errNum);
  const safeDrop = Math.max(0, dropNum);

  return safeErr + safeDrop;
}

function calculateFrameLossOutput(err, drop) {
  if (err == null) {
    return ERRORS.ERRORED_FRAMES_OUTPUT_NOT_PROVIDED;
  }
  if (drop == null) {
    return ERRORS.DROPPED_FRAMES_OUTPUT_NOT_PROVIDED;
  }

  const errNum = Number(err);
  const dropNum = Number(drop);

  if (Number.isNaN(errNum)) {
    return ERRORS.ERRORED_FRAMES_OUTPUT_INVALID;
  }
  if (Number.isNaN(dropNum)) {
    return ERRORS.DROPPED_FRAMES_OUTPUT_INVALID;
  }

  const safeErr = Math.max(0, errNum);
  const safeDrop = Math.max(0, dropNum);

  return safeErr + safeDrop;
}

function p1CalculateEthernetKpis(input) {
  try {
    if (!input) {
      return ERRORS.GENERAL_ERROR;
    }

    if (input['historical-performance-data'] == undefined) {
      return ERRORS.HISTORICAL_DATA_NOT_PROVIDED;
    }

    const dataList = input['historical-performance-data'];

    if (!Array.isArray(dataList) || dataList.length === 0) {
      return ERRORS.HISTORICAL_DATA_INVALID;
    }

    const result = dataList.map(item => {
      let transmitTraffic, receiveTraffic, frameLossInput, frameLossOutput;

      try {
        if (Object.keys(item).length === 0 && item.constructor === Object) {
          return ERRORS.HISTORICAL_DATA_INCOMPLETE;
        }

        transmitTraffic = calculateTransmitTraffic(
          item['total-bytes-output'],
          item['time-period']
        );

        if (typeof transmitTraffic === "string") {
          return ERRORS.TRANSMIT_TRAFFIC_ERROR;
        }

      } catch (error) {
        return ERRORS.TRANSMIT_TRAFFIC_ERROR;
      }

      try {
        receiveTraffic = calculateReceiveTraffic(
          item['total-bytes-input'],
          item['time-period']
        );

        if (typeof receiveTraffic === "string") {
          return ERRORS.RECEIVE_TRAFFIC_ERROR;
        }
      } catch (error) {
        return ERRORS.RECEIVE_TRAFFIC_ERROR;
      }

      try {
        frameLossInput = calculateFrameLossInput(
          item['errored-frames-input'],
          item['dropped-frames-input']
        );

        if (typeof frameLossInput === "string") {
          return ERRORS.FRAME_LOSS_INPUT_ERROR;
        }
      } catch (error) {
        return ERRORS.FRAME_LOSS_INPUT_ERROR;
      }

      try {
        frameLossOutput = calculateFrameLossOutput(
          item['errored-frames-output'],
          item['dropped-frames-output']
        );

        if (typeof frameLossOutput === "string") {
          return ERRORS.FRAME_LOSS_OUTPUT_ERROR;
        }
      } catch (error) {
        return ERRORS.FRAME_LOSS_OUTPUT_ERROR;
      }

      return {
        ...item,
        'transmit-traffic': transmitTraffic,
        'receive-traffic': receiveTraffic,
        'frame-loss-input': frameLossInput,
        'frame-loss-output': frameLossOutput
      };
    });

    if (typeof result === "object" && typeof result[0] === "string") {
      return result[0];
    }

    return {
      'historical-performance-data': result
    };

  } catch (error) {
    return ERRORS.GENERAL_ERROR;
  }
}

module.exports = p1CalculateEthernetKpis;
