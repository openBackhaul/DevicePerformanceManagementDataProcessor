const p1RemoveDefaultValues = require('./P1RemoveDefaultValues');
const ERRORS = require ('./ErrorsEnum');

describe('p1RemoveDefaultValues', () => {

  test('Passing null, return general error', () => {
    expect(p1RemoveDefaultValues(null))
    .toBe(ERRORS.GENERAL_ERROR);
  });

});
