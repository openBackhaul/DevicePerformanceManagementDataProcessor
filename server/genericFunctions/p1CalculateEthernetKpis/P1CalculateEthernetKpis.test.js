const p1CalculateEthernetKpis  = require('./P1CalculateEthernetKpis');
const ERRORS = require('./ErrorsEnum');
const fs = require('fs');

describe('p1CalculateEthernetKpis', () => {

  test('should calculate all KPIs correctly', () => {
    const input = {
      'historical-performance-data': [
        {
          'total-bytes-output': "1000",
          'total-bytes-input': "2000",
          'time-period': 10,
          'errored-frames-input': 5,
          'dropped-frames-input': 5,
          'errored-frames-output': 3,
          'dropped-frames-output': 2
        }
      ]
    };

    const result = p1CalculateEthernetKpis(input);

    expect(result['historical-performance-data'][0]).toMatchObject({
      'transmit-traffic': 0,
      'receive-traffic': 0,
      'frame-loss-input': 10,
      'frame-loss-output': 5
    });
  });

  test('should throw error if historicalPerformanceData missing', () => {
    const result = p1CalculateEthernetKpis({});

    expect(result).toBe(ERRORS.HISTORICAL_DATA_NOT_PROVIDED);
  });

  test('should throw error for invalid totalBytesOutput', () => {
    const input = {
      'historical-performance-data': [
        {
          'total-bytes-output': "abc",
          'total-bytes-input': "2000",
          'time-period': 10,
          'errored-frames-input': 5,
          'dropped-frames-input': 5,
          'errored-frames-output': 3,
          'dropped-frames-output': 2
        }
      ]
    };
    
    const result = p1CalculateEthernetKpis(input);
    expect(result).toBe(ERRORS.TRANSMIT_TRAFFIC_ERROR);
  });

  test('should throw error for missing timePeriod', () => {
    const input = {
      'historical-performance-data': [
        {
          'total-bytes-output': "1000",
          'total-bytes-input': "2000"
        }
      ]
    };

    const result = p1CalculateEthernetKpis(input);
    expect(result).toBe(ERRORS.TRANSMIT_TRAFFIC_ERROR);
  });

  test('should throw error for frame loss input missing', () => {
    const input = {
      'historical-performance-data': [
        {
          'total-bytes-output': "1000",
          'total-bytes-input': "2000",
          'time-period': 10,
          'dropped-frames-input': 5
        }
      ]
    };

    const result = p1CalculateEthernetKpis(input);
    expect(result).toBe(ERRORS.FRAME_LOSS_INPUT_ERROR);
  });

  test('should handle multiple records', () => {
    const input = {
      'historical-performance-data': [
        {
          'total-bytes-output': "1000",
          'total-bytes-input': "2000",
          'time-period': 10,
          'errored-frames-input': 1,
          'dropped-frames-input': 1,
          'errored-frames-output': 1,
          'dropped-frames-output': 1
        },
        {
          'total-bytes-output': "500",
          'total-bytes-input': "1000",
          'time-period': 5,
          'errored-frames-input': 2,
          'dropped-frames-input': 3,
          'errored-frames-output': 4,
          'dropped-frames-output': 1
        }
      ]
    };

    const result = p1CalculateEthernetKpis(input);

    expect(result['historical-performance-data'].length).toBe(2);
    expect(result['historical-performance-data'][1]['frame-loss-input']).toBe(5);
    expect(result['historical-performance-data'][1]['frame-loss-output']).toBe(5);
    expect(result['historical-performance-data'][1]['transmit-traffic']).toBe(0);
    expect(result['historical-performance-data'][1]['receive-traffic']).toBe(0);
  });

  test('should throw error for timePeriod = 0', () => {
    const input = {
      'historical-performance-data': [
        {
          'total-bytes-output': "1000",
          'total-bytes-input': "2000",
          'time-period': 0,
          'errored-frames-input': 1,
          'dropped-frames-input': 1,
          'errored-frames-output': 1,
          'dropped-frames-output': 1
        }
      ]
    };

    const result = p1CalculateEthernetKpis(input);
    expect(result).toBe(ERRORS.TRANSMIT_TRAFFIC_ERROR);
  });

  test('Read from real data, everything is ok', () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/sample1.json', 'utf8');
    let ethPM = JSON.parse(dataFile);
    const input = {
      'historical-performance-data': ethPM
    }

    let result = p1CalculateEthernetKpis(input);
    expect(result['historical-performance-data'].length).toBe(9);
  });

  test('should return Data invalid error for empty historicalPerformanceData array', () => {
    const input = {
      'historical-performance-data': []
    };

    const result = p1CalculateEthernetKpis(input);
    expect(result).toBe(ERRORS.HISTORICAL_DATA_INVALID);
  });

  test('should throw error for invalid totalBytesInput', () => {
    const input = {
      'historical-performance-data': [
        {
          'total-bytes-output': "1000",
          'total-bytes-input': "abc",
          'time-period': 10,
          'errored-frames-input': 1,
          'dropped-frames-input': 1,
          'errored-frames-output': 1,
          'dropped-frames-output': 1
        }
      ]
    };

    const result = p1CalculateEthernetKpis(input);
    expect(result).toBe(ERRORS.RECEIVE_TRAFFIC_ERROR);
  });

  test('should throw error for missing totalBytesOutput', () => {
    const input = {
      'historical-performance-data': [
        {
          'total-bytes-input': "2000",
          'time-period': 10,
          'errored-frames-input': 1,
          'dropped-frames-input': 1,
          'errored-frames-output': 1,
          'dropped-frames-output': 1
        }
      ]
    };

    const result = p1CalculateEthernetKpis(input);
    expect(result).toBe(ERRORS.TRANSMIT_TRAFFIC_ERROR);
  });

  test('should throw error for missing totalBytesInput', () => {
    const input = {
      'historical-performance-data': [
        {
          'total-bytes-output': "1000",
          'time-period': 10,
          'errored-frames-input': 1,
          'dropped-frames-input': 1,
          'errored-frames-output': 1,
          'dropped-frames-output': 1
        }
      ]
    };

    const result = p1CalculateEthernetKpis(input);
    expect(result).toBe(ERRORS.RECEIVE_TRAFFIC_ERROR);
  });

  test('should throw error for invalid errored-frames-input', () => {
    const input = {
      'historical-performance-data': [
        {
          'total-bytes-output': "1000",
          'total-bytes-input': "2000",
          'time-period': 10,
          'errored-frames-input': "abc",
          'dropped-frames-input': 1,
          'errored-frames-output': 1,
          'dropped-frames-output': 1
        }
      ]
    };

    const result = p1CalculateEthernetKpis(input);
    expect(result).toBe(ERRORS.FRAME_LOSS_INPUT_ERROR);
  });

  test('should throw error for invalid dropped-frames-output', () => {
    const input = {
      'historical-performance-data': [
        {
          'total-bytes-output': "1000",
          'total-bytes-input': "2000",
          'time-period': 10,
          'errored-frames-input': 1,
          'dropped-frames-input': 1,
          'errored-frames-output': 1,
          'dropped-frames-output': "xyz"
        }
      ]
    };

    const result = p1CalculateEthernetKpis(input);
    expect(result).toBe(ERRORS.FRAME_LOSS_OUTPUT_ERROR);
  });

  test('should throw error for missing errored-frames-output', () => {
    const input = {
      'historical-performance-data': [
        {
          'total-bytes-output': "1000",
          'total-bytes-input': "2000",
          'time-period': 10,
          'errored-frames-input': 1,
          'dropped-frames-input': 1,
          'dropped-frames-output': 1
        }
      ]
    };

    const result = p1CalculateEthernetKpis(input);
    expect(result).toBe(ERRORS.FRAME_LOSS_OUTPUT_ERROR);
  });

  test('should throw error if historicalPerformanceData is not an array', () => {
    const input = {
      'historical-performance-data': "invalid"
    };

    const result = p1CalculateEthernetKpis(input);
    expect(result).toBe(ERRORS.HISTORICAL_DATA_INVALID);
  });

  test('should handle negative errored-frames-input as 0', () => {
    const input = {
      'historical-performance-data': [
        {
          'total-bytes-output': "1000",
          'total-bytes-input': "2000",
          'time-period': 10,
          'errored-frames-input': -5,
          'dropped-frames-input': 3,
          'errored-frames-output': 1,
          'dropped-frames-output': 1
        }
      ]
    };

    const result = p1CalculateEthernetKpis(input);

    expect(result['historical-performance-data'][0]['frame-loss-input'])
      .toBe(3);
  });

  test('should handle negative dropped-frames-input as 0', () => {
    const input = {
      'historical-performance-data': [
        {
          'total-bytes-output': "1000",
          'total-bytes-input': "2000",
          'time-period': 10,
          'errored-frames-input': 2,
          'dropped-frames-input': -10,
          'errored-frames-output': 1,
          'dropped-frames-output': 1
        }
      ]
    };

    const result = p1CalculateEthernetKpis(input);

    expect(result['historical-performance-data'][0]['frame-loss-input'])
      .toBe(2); // 2 + 0
  });

  test('should handle negative errored-frames-output as 0', () => {
    const input = {
      'historical-performance-data': [
        {
          'total-bytes-output': "1000",
          'total-bytes-input': "2000",
          'time-period': 10,
          'errored-frames-input': 1,
          'dropped-frames-input': 1,
          'errored-frames-output': -4,
          'dropped-frames-output': 2
        }
      ]
    };

    const result = p1CalculateEthernetKpis(input);

    expect(result['historical-performance-data'][0]['frame-loss-output'])
      .toBe(2);
  });

  test('should handle negative dropped-frames-output as 0', () => {
    const input = {
      'historical-performance-data': [
        {
          'total-bytes-output': "1000",
          'total-bytes-input': "2000",
          'time-period': 10,
          'errored-frames-input': 1,
          'dropped-frames-input': 1,
          'errored-frames-output': 3,
          'dropped-frames-output': -2
        }
      ]
    };

    const result = p1CalculateEthernetKpis(input);

    expect(result['historical-performance-data'][0]['frame-loss-output'])
      .toBe(3);
  });

});