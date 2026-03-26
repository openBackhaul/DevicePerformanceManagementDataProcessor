const p1CalculateIntervalCapacity = require('./P1CalculateIntervalCapacity');
const ERRORS = require('./ErrorsEnum');

describe('p1CalculateIntervalCapacity', () => {

  test('should return error if input is missing', () => {
    expect(p1CalculateIntervalCapacity(null))
    .toBe(ERRORS.GENERAL_ERROR);
  });

  test('should return error if time-xstates-list is missing', () => {
    expect(p1CalculateIntervalCapacity({
      "transmission-mode-list": []
    })).toBe(ERRORS.TIMEXSTATES_NOT_PROVIDED);
  });

  test('should return error if transmission-mode-list is missing', () => {
    expect(p1CalculateIntervalCapacity({
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
        {"transmission-mode": "A", "capacity": 100},
        {"transmission-mode": "B", "capacity": 200}
      ]
    });

    expect(result["interval-capacity"]).toBe(150);
  });

  test('should return 0 when total time is 0', () => {
    const result = p1CalculateIntervalCapacity({
      "time-xstates-list": [],
      "transmission-mode-list": [
        {"transmission-mode": "A", "capacity": 100}
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
        {"transmission-mode": "A", "capacity": 100}
      ]
    });

    expect(result["interval-capacity"]).toBe(100);
  });

});
