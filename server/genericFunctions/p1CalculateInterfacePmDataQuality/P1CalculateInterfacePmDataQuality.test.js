const p1CalculateInterfacePmDataQuality = require('./P1CalculateInterfacePmDataQuality');
const ERRORS = require('./ErrorsEnum');
const fs = require('fs');

describe("p1CalculateInterfacePmDataQuality", () => {

  describe("p1CalculateInterfacePmDataQuality - Errors", () => {

    test('should return error if input is missing', () => {
      expect(p1CalculateInterfacePmDataQuality(null))
        .toBe(ERRORS.GENERAL_ERROR);
    });


    test('should return error if input properties are undefined', () => {
      const input = {
        'uuid': undefined,
        'former-most-recent-period-end-time': undefined,
        'new-most-recent-period-end-time': undefined,
        'amount-received': undefined,
      };

      const res = p1CalculateInterfacePmDataQuality(input);
      expect(res).toBe(ERRORS.GENERAL_ERROR);
    });

    // UUID
    test('should return error if UUID is undefined', () => {
      const input = {
        'uuid': undefined,
        'former-most-recent-period-end-time': '2026-07-01T21:30:00Z',
        'new-most-recent-period-end-time': '2026-07-02T01:15:00Z',
        'amount-received': undefined
      };

      const res = p1CalculateInterfacePmDataQuality(input);
      expect(res).toBe(ERRORS.UUID_NOT_PROVIDED);
    });

    test('should return error if UUID is not a string - 1', () => {
      const input = {
        'uuid': 20,
        'former-most-recent-period-end-time': '2026-07-01T21:30:00Z',
        'new-most-recent-period-end-time': '2026-07-02T01:15:00Z',
        'amount-received': undefined
      };

      const res = p1CalculateInterfacePmDataQuality(input);
      expect(res).toBe(ERRORS.UUID_INVALID);
    });

    test('should return error if UUID is not a string - 2', () => {
      const input = {
        'uuid': [],
        'former-most-recent-period-end-time': '2026-07-01T21:30:00Z',
        'new-most-recent-period-end-time': '2026-07-02T01:15:00Z',
        'amount-received': undefined
      };

      const res = p1CalculateInterfacePmDataQuality(input);
      expect(res).toBe(ERRORS.UUID_INVALID);
    });

    // former-most-recent-period-end-time
    test('should return error if former-most-recent-period-end-time is undefined', () => {
      const input = {
        'uuid': 'interface-001',
        'former-most-recent-period-end-time': undefined,
        'new-most-recent-period-end-time': '2026-07-02T01:15:00Z',
        'amount-received': undefined
      };

      const res = p1CalculateInterfacePmDataQuality(input);
      expect(res).toBe(ERRORS.FORMER_MRPET_NOT_PROVIDED);
    });

    test('should return error if former-most-recent-period-end-time is not a string - 1', () => {
      const input = {
        'uuid': 'interface-001',
        'former-most-recent-period-end-time': 22,
        'new-most-recent-period-end-time': '2026-07-02T01:15:00Z',
        'amount-received': undefined
      };

      const res = p1CalculateInterfacePmDataQuality(input);
      expect(res).toBe(ERRORS.FORMER_MRPET_INVALID);
    });

    test('should return error if former-most-recent-period-end-time is not a string - 2', () => {
      const input = {
        'uuid': 'interface-001',
        'former-most-recent-period-end-time': [],
        'new-most-recent-period-end-time': '2026-07-02T01:15:00Z',
        'amount-received': undefined
      };

      const res = p1CalculateInterfacePmDataQuality(input);
      expect(res).toBe(ERRORS.FORMER_MRPET_INVALID);
    });

    // new-most-recent-period-end-time
    test('should return error if new-most-recent-period-end-time is undefined', () => {
      const input = {
        'uuid': 'interface-001',
        'former-most-recent-period-end-time': '2026-07-02T01:15:00Z',
        'new-most-recent-period-end-time': undefined,
        'amount-received': undefined
      };

      const res = p1CalculateInterfacePmDataQuality(input);
      expect(res).toBe(ERRORS.NEW_MRPET_NOT_PROVIDED);
    });

    test('should return error if new-most-recent-period-end-time is not a string - 1', () => {
      const input = {
        'uuid': 'interface-001',
        'former-most-recent-period-end-time': '2026-07-01T01:15:00Z',
        'new-most-recent-period-end-time': 20,
        'amount-received': undefined
      };

      const res = p1CalculateInterfacePmDataQuality(input);
      expect(res).toBe(ERRORS.NEW_MRPET_INVALID);
    });

    test('should return error if new-most-recent-period-end-time is not a string - 2', () => {
      const input = {
        'uuid': 'interface-001',
        'former-most-recent-period-end-time': '2026-07-02T01:15:00Z',
        'new-most-recent-period-end-time': [],
        'amount-received': undefined
      };

      const res = p1CalculateInterfacePmDataQuality(input);
      expect(res).toBe(ERRORS.NEW_MRPET_INVALID);
    });

    // amount received
    test('should return error if amount-received is undefined - 1', () => {
      const input = {
        'uuid': 'interface-001',
        'former-most-recent-period-end-time': '2026-07-02T01:15:00Z',
        'new-most-recent-period-end-time': '2026-07-02T01:15:00Z',
        'amount-received': undefined
      };

      const res = p1CalculateInterfacePmDataQuality(input);
      expect(res).toBe(ERRORS.AMOUNT_RECV_NOT_PROVIDED);
    });

    test('should return error if amount-received is undefined - 2', () => {
      const input = {
        'uuid': 'interface-001',
        'former-most-recent-period-end-time': '2026-07-02T01:15:00Z',
        'new-most-recent-period-end-time': '2026-07-02T01:15:00Z',
        'amount-received': undefined
      };

      const res = p1CalculateInterfacePmDataQuality(input);
      expect(res).toBe(ERRORS.AMOUNT_RECV_NOT_PROVIDED);
    });

    test('should return error if amount-received is not an array - 1', () => {
      const input = {
        'uuid': 'interface-001',
        'former-most-recent-period-end-time': '2026-07-02T01:15:00Z',
        'new-most-recent-period-end-time': '2026-07-02T01:15:00Z',
        'amount-received': 'XYZ'
      };

      const res = p1CalculateInterfacePmDataQuality(input);
      expect(res).toBe(ERRORS.AMOUNT_RECV_INVALID);
    });

    test('should return error if amount-received is not an array - 2', () => {
      const input = {
        'uuid': 'interface-001',
        'former-most-recent-period-end-time': '2026-07-02T01:15:00Z',
        'new-most-recent-period-end-time': '2026-07-02T01:15:00Z',
        'amount-received': {}
      };

      const res = p1CalculateInterfacePmDataQuality(input);
      expect(res).toBe(ERRORS.AMOUNT_RECV_INVALID);
    });


    test('should return error - expected amount could not be calculated', () => {
      const input = {
        'uuid': 'interface-001',
        'former-most-recent-period-end-time': '2026-07-02T01:15:00Z',
        'new-most-recent-period-end-time': '2026-07-02T01:15:00Z',
        'amount-received': []
      };

      const res = p1CalculateInterfacePmDataQuality(input);
      expect(res).toBe(ERRORS.EXP_AMOUNT_COULDNT_CALC);
    });

    // interfacePmDataQuality could not be calculated
  });


  describe("p1CalculateInterfacePmDataQuality - Content data", () => {

    test('Dummy data - 1 Day', () => {
      const input = {
        'uuid': 'interface-001',
        'former-most-recent-period-end-time': '2026-01-01T00:00:00+01:00',
        'new-most-recent-period-end-time': '2026-01-02T00:00:00+01:00',
        'amount-received': [
          {
            'date': '2026/01/01',
            'count': 40
          }
        ]
      };

      const result = p1CalculateInterfacePmDataQuality(input);

      expect(result["interface-pm-data-quality"]["quality"][0]).toEqual({
        "date": "2026/01/01",
        "received": 40,
        "expected": 96
      });
    });

    test('Dummy data - 2 Days', () => {
      const input = {
        'uuid': 'interface-001',
        'former-most-recent-period-end-time': '2026-07-01T21:30:00Z',
        'new-most-recent-period-end-time': '2026-07-02T01:15:00Z',
        'amount-received': [
          {
            'date': '2026/07/01',
            'count': 5
          },
          {
            'date': '2026/07/02',
            'count': 4
          }
        ]
      };

      const result = p1CalculateInterfacePmDataQuality(input);
      expect(result["interface-pm-data-quality"]["quality"][0]).toEqual({
        "date": "2026/07/01",
        "received": 5,
        "expected": 2
      });

      expect(result["interface-pm-data-quality"]["quality"][1]).toEqual({
        "date": "2026/07/02",
        "received": 4,
        "expected": 13
      });
    });

  });
});
