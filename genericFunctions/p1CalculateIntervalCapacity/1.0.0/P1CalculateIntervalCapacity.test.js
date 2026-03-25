const p1CalculateIntervalCapacity = require('./P1CalculateIntervalCapacity');
const ERRORS = require('./ErrorsEnum');

describe('p1CalculateIntervalCapacity', () => {

  test('should return error if input is missing', () => {
    expect(p1CalculateIntervalCapacity(null))
    .toBe(ERRORS.GENERAL_ERROR);
  });


});
