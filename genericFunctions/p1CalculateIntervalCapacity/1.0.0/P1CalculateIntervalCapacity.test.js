const p1CalculateIntervalCapacity = require('./P1CalculateIntervalCapacity');

describe('p1CalculateIntervalCapacity', () => {

  test('should return error if input is missing', () => {
    expect(p1CalculateIntervalCapacity(null))
      .toMatchObject({
        "error": 'General processing error'
      });
  });


});
