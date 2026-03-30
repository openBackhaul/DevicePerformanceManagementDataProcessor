const p1CalculateIntervalCapacity = require('./P1CalculateIntervalCapacity');
const ERRORS = require('./ErrorsEnum');
const fs = require('fs');

describe('p1CalculateIntervalCapacity', () => {

  test('should return error if input is missing', () => {
    expect(p1CalculateIntervalCapacity(null))
    .toBe(ERRORS.GENERAL_ERROR);
  });

  test('should return error if time-xstates-list is missing', () => {
    expect(p1CalculateIntervalCapacity({
      "transmission-mode-list": []
      // "time-xstates-list": []  <-- not provided
    })).toBe(ERRORS.TIMEXSTATES_NOT_PROVIDED);
  });

  test('should return error if transmission-mode-list is missing', () => {
    expect(p1CalculateIntervalCapacity({
      // "transmission-mode-list": [] <-- not provided
      "time-xstates-list": []
    })).toBe(ERRORS.TRANSMODE_NOT_PROVIDED);
  });

  test('should calculate interval capacity correctly', () => {
    const result = p1CalculateIntervalCapacity({
      "time-xstates-list": [
        {"transmission-mode": "A", "time": 10},
        {"transmission-mode": "B", "time": 10}
      ],
      "transmission-mode-list": [
        {"transmission-mode-name": "A", "capacity": 100},
        {"transmission-mode-name": "B", "capacity": 200}
      ]
    });

    expect(result["interval-capacity"]).toBe(150);
  });

  test('should return 0 when total time is 0', () => {
    const result = p1CalculateIntervalCapacity({
      "time-xstates-list": [],
      "transmission-mode-list": [
        {"transmission-mode-name": "A", "capacity": 100}
      ]
    });

    expect(result["interval-capacity"]).toBe(0);
  });

  test('should ignore unknown transmission modes', () => {
    const result = p1CalculateIntervalCapacity({
      "time-xstates-list": [
        {"transmission-mode": "A", "time": 10},
        {"transmission-mode": "UNKNOWN", "time": 100}
      ],
      "transmission-mode-list": [
        {"transmission-mode-name": "A", "capacity": 100}
      ]
    });

    expect(result["interval-capacity"]).toBe(100);
  });

  test('sum 2 transmission modes', () => {
    const result = p1CalculateIntervalCapacity({
      "time-xstates-list": [
        {"transmission-mode": "A", "time": 10},
        {"transmission-mode": "B", "time": 10},
        // {"transmission-mode": "C", "time": 10},
        {"transmission-mode": "UNKNOWN", "time": 100}
      ],
      "transmission-mode-list": [
        {"transmission-mode-name": "A", "capacity": 100},
        {"transmission-mode-name": "B", "capacity": 200},
        {"transmission-mode-name": "C", "capacity": 300}
      ]
    });

    expect(result["interval-capacity"]).toBe(150);
  });

  test('sum 3 transmission modes', () => {
    const result = p1CalculateIntervalCapacity({
      "time-xstates-list": [
        {"transmission-mode": "A", "time": 10},
        {"transmission-mode": "B", "time": 10},
        {"transmission-mode": "C", "time": 10},
        {"transmission-mode": "UNKNOWN", "time": 100}
      ],
      "transmission-mode-list": [
        {"transmission-mode-name": "A", "capacity": 100},
        {"transmission-mode-name": "B", "capacity": 200},
        {"transmission-mode-name": "C", "capacity": 300}
      ]
    });

    expect(result["interval-capacity"]).toBe(200);
  });

  test('using real data for testing', () => {
    let dataFile = fs.readFileSync('./transmissionModeList1.json', 'utf8');
    let transmissionMode = JSON.parse(dataFile);

    dataFile = fs.readFileSync('./timeXstates1.json', 'utf8');
    let timeXstates = JSON.parse(dataFile);

    const result = p1CalculateIntervalCapacity({
      "time-xstates-list": timeXstates,
      "transmission-mode-list": transmissionMode
    });

    expect(result["interval-capacity"]).toBe(200);
  });

});
