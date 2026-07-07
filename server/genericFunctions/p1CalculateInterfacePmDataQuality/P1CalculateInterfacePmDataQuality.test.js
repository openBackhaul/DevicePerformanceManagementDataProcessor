const p1CalculateInterfacePmDataQuality = require('./P1CalculateInterfacePmDataQuality');
const ERRORS = require('./ErrorsEnum');
const fs = require('fs');

describe("p1CalculateInterfacePmDataQuality", () => {

  test('should return error if input is missing', () => {
    expect(p1CalculateInterfacePmDataQuality(null))
      .toBe(ERRORS.GENERAL_ERROR);
  });

  test('Dummy data', () => {
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

    console.log(result);

    // Expected
//     {
//   "interface-pm-data-quality": {
//     uuid: "interface-001",
//     quality: [
//       {
//         date: "2026/07/01",
//         received: 5,
//         expected: 6
//       },
//       {
//         date: "2026/07/02",
//         received: 4,
//         expected: 5
//       }
//     ]
//   }
// }
  });
});
