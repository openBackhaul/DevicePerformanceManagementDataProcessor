const ERR = require('./ErrorsEnum');


function calculateTransmitTraffic(totalBytesOutput, timePeriod) {
  if (totalBytesOutput == null) throw new Error(ERR.TOTAL_BYTES_OUTPUT_NOT_PROVIDED);

  const bytes = Number(totalBytesOutput);
  const time = Number(timePeriod);

  if (Number.isNaN(bytes)) {
    throw new Error(ERR.TOTAL_BYTES_OUTPUT_INVALID);
  }
  if (timePeriod == null) {
    throw new Error(ERR.TIME_PERIOD_NOT_PROVIDED);
  }
  if (Number.isNaN(time) || time <= 0) {
    throw new Error(ERR.TIME_PERIOD_INVALID);
  }

  return Math.floor((bytes * 8) / (time * 1000000));
}

function calculateReceiveTraffic(totalBytesInput, timePeriod) {
  if (totalBytesInput == null) throw new Error(ERR.TOTAL_BYTES_INPUT_NOT_PROVIDED);

  const bytes = Number(totalBytesInput);
  const time = Number(timePeriod);

  if (Number.isNaN(bytes)) {
    throw new Error(ERR.TOTAL_BYTES_INPUT_INVALID);
  }
  if (timePeriod == null) {
    throw new Error(ERR.TIME_PERIOD_NOT_PROVIDED);
  }
  if (Number.isNaN(time) || time <= 0) {
    throw new Error(ERR.TIME_PERIOD_INVALID);
  }

  return Math.floor((bytes * 8) / (time * 1000000));
}

function calculateFrameLossInput(err, drop) {
  if (err == null) {
    throw new Error(ERR.ERRORED_FRAMES_INPUT_NOT_PROVIDED);
  }
  if (drop == null) {
    throw new Error(ERR.DROPPED_FRAMES_INPUT_NOT_PROVIDED);
  }

  if (Number.isNaN(Number(err))) {
    throw new Error(ERR.ERRORED_FRAMES_INPUT_INVALID);
  }
  if (Number.isNaN(Number(drop))) {
    throw new Error(ERR.DROPPED_FRAMES_INPUT_INVALID);
  }

  return Number(err) + Number(drop);
}

function calculateFrameLossOutput(err, drop) {
  if (err == null) {
    throw new Error(ERR.ERRORED_FRAMES_OUTPUT_NOT_PROVIDED);
  }
  if (drop == null) {
    throw new Error(ERR.DROPPED_FRAMES_OUTPUT_NOT_PROVIDED);
  }

  if (Number.isNaN(Number(err))) {
    throw new Error(ERR.ERRORED_FRAMES_OUTPUT_INVALID);
  }
  if (Number.isNaN(Number(drop))) {
    throw new Error(ERR.DROPPED_FRAMES_OUTPUT_INVALID);
  }

  return Number(err) + Number(drop);
}


function p1CalculateEthernetKpis(input) {
  try {
    if (!input || !input['historical-performance-data']) {
      throw new Error(ERR.HISTORICAL_DATA_NOT_PROVIDED);
    }

    const dataList = input['historical-performance-data'];

    if (!Array.isArray(dataList) || dataList.length === 0) {
      throw new Error(ERR.HISTORICAL_DATA_INCOMPLETE);
    }

    const result = dataList.map(item => {
      let transmitTraffic, receiveTraffic, frameLossInput, frameLossOutput;

      try {
        transmitTraffic = calculateTransmitTraffic(
          item['total-bytes-output'],
          item['time-period']
        );
      } catch (error) {
        if (Object.values(ERR).includes(error.message)) {
          throw error;
        }
        throw new Error(ERR.TRANSMIT_TRAFFIC_ERROR);
      }

      try {
        receiveTraffic = calculateReceiveTraffic(
          item['total-bytes-input'],
          item['time-period']
        );
      } catch (error) {
        if (Object.values(ERR).includes(error.message)) {
          throw error;
        }
        throw new Error(ERR.RECEIVE_TRAFFIC_ERROR);
      }

      try {
        frameLossInput = calculateFrameLossInput(
          item['errored-frames-input'],
          item['dropped-frames-input']
        );
      } catch (error) {
        if (Object.values(ERR).includes(error.message)) {
          throw error;
        }
        throw new Error(ERR.FRAME_LOSS_INPUT_ERROR);
      }

      try {
        frameLossOutput = calculateFrameLossOutput(
          item['errored-frames-output'],
          item['dropped-frames-output']
        );
      } catch (error) {
        if (Object.values(ERR).includes(error.message)) {
          throw error;
        }
        throw new Error(ERR.FRAME_LOSS_OUTPUT_ERROR);
      }

      return {
        ...item,
        'transmit-traffic': transmitTraffic,
        'receive-traffic': receiveTraffic,
        'frame-loss-input': frameLossInput,
        'frame-loss-output': frameLossOutput
      };
    });

    return {
      'historical-performance-data': result
    };

  } catch (error) {

    if (Object.values(ERR).includes(error.message)) {
      throw error;
    }
    throw new Error(ERR.GENERAL_ERROR);
  }
}



module.exports = {
  p1CalculateEthernetKpis
};