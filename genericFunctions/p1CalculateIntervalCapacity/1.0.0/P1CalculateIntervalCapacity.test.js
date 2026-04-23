const p1CalculateIntervalCapacity = require('./P1CalculateIntervalCapacity');
const ERRORS = require('./ErrorsEnum');
const fs = require('fs');

describe('p1CalculateIntervalCapacity', () => {

  describe('Error Cases @negative', () => {
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

    test('should return error if time-xstates-list is not an array', () => {
      expect(p1CalculateIntervalCapacity({
        "time-xstates-list": "not an array",
        "transmission-mode-list": []
      })).toBe(ERRORS.TIMEXSTATES_INVALID);
    });

    test('should return error if transmission-mode-list is not an array', () => {
      expect(p1CalculateIntervalCapacity({
        "time-xstates-list": [],
        "transmission-mode-list": "not an array"
      })).toBe(ERRORS.TRANSMODE_INVALID);
    });
  });

  describe('Positive Tests @positive', () => {
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

    test('Testing using the same capcity value = 200', () => {
      let dataFile = fs.readFileSync(__dirname + '/dataset/transmissionModeList1.json', 'utf8');
      let transmissionMode = JSON.parse(dataFile);

      dataFile = fs.readFileSync(__dirname + '/dataset/timeXstates1.json', 'utf8');
      let timeXstates = JSON.parse(dataFile);

      const result = p1CalculateIntervalCapacity({
        "time-xstates-list": timeXstates,
        "transmission-mode-list": transmissionMode
      });

      expect(result["interval-capacity"]).toBe(200);
    });

    test('Testing using different values of capacity', () => {
      let dataFile = fs.readFileSync(__dirname + '/dataset/transmissionModeList2.json', 'utf8');
      let transmissionMode = JSON.parse(dataFile);

      dataFile = fs.readFileSync(__dirname + '/dataset/timeXstates1.json', 'utf8');
      let timeXstates = JSON.parse(dataFile);

      const result = p1CalculateIntervalCapacity({
        "time-xstates-list": timeXstates,
        "transmission-mode-list": transmissionMode
      });

      expect(result["interval-capacity"]).toBe(536);
    });

    test('should handle single transmission mode', () => {
      const result = p1CalculateIntervalCapacity({
        "time-xstates-list": [
          {"transmission-mode": "A", "time": 30}
        ],
        "transmission-mode-list": [
          {"transmission-mode-name": "A", "capacity": 150}
        ]
      });

      expect(result["interval-capacity"]).toBe(150);
    });
  });

  describe('Edge Cases @edge', () => {
    test('should return 0 when total time is 0', () => {
      const result = p1CalculateIntervalCapacity({
        "time-xstates-list": [],
        "transmission-mode-list": [
          {"transmission-mode-name": "A", "capacity": 100}
        ]
      });

      expect(result["interval-capacity"]).toBe(0);
    });

    test('should return 0 when all transmission modes are unknown', () => {
      const result = p1CalculateIntervalCapacity({
        "time-xstates-list": [
          {"transmission-mode": "UNKNOWN1", "time": 10},
          {"transmission-mode": "UNKNOWN2", "time": 20}
        ],
        "transmission-mode-list": [
          {"transmission-mode-name": "A", "capacity": 100}
        ]
      });

      expect(result["interval-capacity"]).toBe(0);
    });

    test('should handle capacity of 0 correctly', () => {
      const result = p1CalculateIntervalCapacity({
        "time-xstates-list": [
          {"transmission-mode": "A", "time": 10},
          {"transmission-mode": "B", "time": 10}
        ],
        "transmission-mode-list": [
          {"transmission-mode-name": "A", "capacity": 0},
          {"transmission-mode-name": "B", "capacity": 200}
        ]
      });

      expect(result["interval-capacity"]).toBe(100);
    });

    test('should handle negative time values', () => {
      const result = p1CalculateIntervalCapacity({
        "time-xstates-list": [
          {"transmission-mode": "A", "time": -10},
          {"transmission-mode": "B", "time": 20}
        ],
        "transmission-mode-list": [
          {"transmission-mode-name": "A", "capacity": 100},
          {"transmission-mode-name": "B", "capacity": 200}
        ]
      });

      expect(result["interval-capacity"]).toBe(300);
    });

    test('should handle decimal time values', () => {
      const result = p1CalculateIntervalCapacity({
        "time-xstates-list": [
          {"transmission-mode": "A", "time": 5.5},
          {"transmission-mode": "B", "time": 4.5}
        ],
        "transmission-mode-list": [
          {"transmission-mode-name": "A", "capacity": 100},
          {"transmission-mode-name": "B", "capacity": 200}
        ]
      });

      expect(result["interval-capacity"]).toBe(145);
    });

  test('should handle single transmission mode', () => {
    const result = p1CalculateIntervalCapacity({
      "time-xstates-list": [
        {"transmission-mode": "A", "time": 30}
      ],
      "transmission-mode-list": [
        {"transmission-mode-name": "A", "capacity": 150}
      ]
    });

    expect(result["interval-capacity"]).toBe(150);
  });

    test('should handle empty transmission-mode-list', () => {
      const result = p1CalculateIntervalCapacity({
        "time-xstates-list": [
          {"transmission-mode": "A", "time": 10}
        ],
        "transmission-mode-list": []
      });

      expect(result["interval-capacity"]).toBe(0);
    });

    test('should return 0 when total time equals zero due to positive and negative values', () => {
      const result = p1CalculateIntervalCapacity({
        "time-xstates-list": [
          {"transmission-mode": "A", "time": -10},
          {"transmission-mode": "B", "time": 10}
        ],
        "transmission-mode-list": [
          {"transmission-mode-name": "A", "capacity": 100},
          {"transmission-mode-name": "B", "capacity": 200}
        ]
      });

      expect(result["interval-capacity"]).toBe(0);
    });

  test('should return 0 when offered volume is 0 but total time is not zero', () => {
    const result = p1CalculateIntervalCapacity({
      "time-xstates-list": [
        {"transmission-mode": "A", "time": -20},
        {"transmission-mode": "B", "time": 10}
      ],
      "transmission-mode-list": [
        {"transmission-mode-name": "A", "capacity": 100},
        {"transmission-mode-name": "B", "capacity": 200}
      ]
    });

    expect(result["interval-capacity"]).toBeCloseTo(0);
  });

});


describe('p1CalculateIntervalCapacity passing values', () => {
  test('should ignore unknown transmission modes', () => {

      let inputObj = {
        "time-xstates-list": [
          {"transmission-mode": "A", "time": 10},
          {"transmission-mode": "UNKNOWN", "time": 100}
        ],
        "transmission-mode-list": [
          {"transmission-mode-name": "A", "capacity": 100}
        ]
      };

      const result = p1CalculateIntervalCapacity(inputObj);

      expect(inputObj).toMatchObject({
        "time-xstates-list": [
          {"transmission-mode": "A", "time": 10, "transmission-mode-capacity": 100, 'offered-volume': 1000 },
          {"transmission-mode": "UNKNOWN", "time": 100}
        ],
        "transmission-mode-list": [
          {"transmission-mode-name": "A", "capacity": 100}
        ]
      });
    });

    test('should handle missing transmission-mode property by skipping @edge', () => {
      const result = p1CalculateIntervalCapacity({
        "time-xstates-list": [
          {"time": 10},
          {"transmission-mode": "B", "time": 10}
        ],
        "transmission-mode-list": [
          {"transmission-mode-name": "A", "capacity": 100},
          {"transmission-mode-name": "B", "capacity": 200}
        ]
      });
      expect(result["interval-capacity"]).toBe(200);
    });

    test('should handle capacity as string by coercing to number @edge', () => {
      const result = p1CalculateIntervalCapacity({
        "time-xstates-list": [
          {"transmission-mode": "A", "time": 10}
        ],
        "transmission-mode-list": [
          {"transmission-mode-name": "A", "capacity": "500"}
        ]
      });
      expect(result["interval-capacity"]).toBe(500);
    });

    test('should handle time as string by coercing to number @edge', () => {
      const result = p1CalculateIntervalCapacity({
        "time-xstates-list": [
          {"transmission-mode": "A", "time": "10"}
        ],
        "transmission-mode-list": [
          {"transmission-mode-name": "A", "capacity": 100}
        ]
      });
      expect(result["interval-capacity"]).toBe(100);
    });
  });
});
