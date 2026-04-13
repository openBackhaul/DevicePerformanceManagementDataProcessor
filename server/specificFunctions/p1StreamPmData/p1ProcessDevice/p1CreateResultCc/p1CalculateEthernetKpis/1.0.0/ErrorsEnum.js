module.exports = {
  // General
  GENERAL_ERROR: 'General processing error',

  // Historical data
  HISTORICAL_DATA_NOT_PROVIDED: 'historicalPerformanceData not provided',
  HISTORICAL_DATA_INCOMPLETE: 'historicalPerformanceData incomplete',

  // KPI level errors (as per YAML contract)
  TRANSMIT_TRAFFIC_ERROR: 'transmitTraffic could not be provided',
  RECEIVE_TRAFFIC_ERROR: 'receiveTraffic could not be provided',
  FRAME_LOSS_INPUT_ERROR: 'frameLossInput could not be provided',
  FRAME_LOSS_OUTPUT_ERROR: 'frameLossOutput could not be provided',

  // Field level errors
  TOTAL_BYTES_OUTPUT_NOT_PROVIDED: 'totalBytesOutput not provided',
  TOTAL_BYTES_OUTPUT_INVALID: 'totalBytesOutput invalid',

  TOTAL_BYTES_INPUT_NOT_PROVIDED: 'totalBytesInput not provided',
  TOTAL_BYTES_INPUT_INVALID: 'totalBytesInput invalid',

  TIME_PERIOD_NOT_PROVIDED: 'timePeriod not provided',
  TIME_PERIOD_INVALID: 'timePeriod invalid',

  ERRORED_FRAMES_INPUT_NOT_PROVIDED: 'erroredFramesInput not provided',
  ERRORED_FRAMES_INPUT_INVALID: 'erroredFramesInput invalid',

  DROPPED_FRAMES_INPUT_NOT_PROVIDED: 'droppedFramesInput not provided',
  DROPPED_FRAMES_INPUT_INVALID: 'droppedFramesInput invalid',

  ERRORED_FRAMES_OUTPUT_NOT_PROVIDED: 'erroredFramesOutput not provided',
  ERRORED_FRAMES_OUTPUT_INVALID: 'erroredFramesOutput invalid',

  DROPPED_FRAMES_OUTPUT_NOT_PROVIDED: 'droppedFramesOutput not provided',
  DROPPED_FRAMES_OUTPUT_INVALID: 'droppedFramesOutput invalid',

  FRAME_LOSS_INPUT_INVALID: 'frameLossInput invalid',
  FRAME_LOSS_OUTPUT_INVALID: 'frameLossOutput invalid',
};