module.exports = {
  // General Error
  GENERAL_ERROR: 'General processing error',

  // Historical data
  HISTORICAL_DATA_NOT_PROVIDED: 'historicalPerformanceData not provided',
  HISTORICAL_DATA_INCOMPLETE: 'historicalPerformanceData incomplete',
  HISTORICAL_DATA_INVALID: 'historicalPerformanceData invalid',

  // KPI level errors (as per YAML contract)
  TRANSMIT_TRAFFIC_ERROR: 'transmitTraffic could not be provided',
  RECEIVE_TRAFFIC_ERROR: 'receiveTraffic could not be provided',
  FRAME_LOSS_INPUT_ERROR: 'frameLossInput could not be provided',
  FRAME_LOSS_OUTPUT_ERROR: 'frameLossOutput could not be provided',
  // ----------------------------------------------------------------

  // calculateTransmitTraffic - Field level errors
  TOTAL_BYTES_OUTPUT_NOT_PROVIDED: 'totalBytesOutput not provided',
  TOTAL_BYTES_OUTPUT_INVALID: 'totalBytesOutput invalid',

  TIME_PERIOD_NOT_PROVIDED: 'timePeriod not provided', //  calculateReceiveTraffic
  TIME_PERIOD_INVALID: 'timePeriod invalid',           //  calculateReceiveTraffic

  // calculateReceiveTraffic - Field level errors
  TOTAL_BYTES_INPUT_NOT_PROVIDED: 'totalBytesInput not provided',
  TOTAL_BYTES_INPUT_INVALID: 'totalBytesInput invalid',

  // calculateFrameLossInput - Field level errors
  ERRORED_FRAMES_INPUT_NOT_PROVIDED: 'erroredFramesInput not provided',
  ERRORED_FRAMES_INPUT_INVALID: 'erroredFramesInput invalid',
  DROPPED_FRAMES_INPUT_NOT_PROVIDED: 'droppedFramesInput not provided',
  DROPPED_FRAMES_INPUT_INVALID: 'droppedFramesInput invalid',

  // calculateFrameLossOutput - Field level errors
  ERRORED_FRAMES_OUTPUT_NOT_PROVIDED: 'erroredFramesOutput not provided',
  ERRORED_FRAMES_OUTPUT_INVALID: 'erroredFramesOutput invalid',
  DROPPED_FRAMES_OUTPUT_NOT_PROVIDED: 'droppedFramesOutput not provided',
  DROPPED_FRAMES_OUTPUT_INVALID: 'droppedFramesOutput invalid',

};