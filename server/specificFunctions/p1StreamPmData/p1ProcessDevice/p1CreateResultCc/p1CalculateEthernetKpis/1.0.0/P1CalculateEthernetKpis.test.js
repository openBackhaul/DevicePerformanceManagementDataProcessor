const { p1CalculateEthernetKpis } = require('./P1CalculateEthernetKpis');
const ERR = require('./ErrorsEnum');
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
    expect(() => {
      p1CalculateEthernetKpis({});
    }).toThrow(ERR.HISTORICAL_DATA_NOT_PROVIDED);
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

    expect(() => p1CalculateEthernetKpis(input))
      .toThrow(ERR.TOTAL_BYTES_OUTPUT_INVALID);
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

    expect(() => p1CalculateEthernetKpis(input))
      .toThrow(ERR.TIME_PERIOD_NOT_PROVIDED);
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

    expect(() => p1CalculateEthernetKpis(input))
      .toThrow(ERR.ERRORED_FRAMES_INPUT_NOT_PROVIDED);
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

    expect(() => p1CalculateEthernetKpis(input))
      .toThrow(ERR.TIME_PERIOD_INVALID);
  });

  test('Read from real data, everything is ok', () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/sample1.json', 'utf8');
    let ethPM = JSON.parse(dataFile);
    const input = {
      'historical-performance-data': ethPM
    }

    let result = p1CalculateEthernetKpis(input);
    expect(p1CalculateEthernetKpis(input));
  });

});