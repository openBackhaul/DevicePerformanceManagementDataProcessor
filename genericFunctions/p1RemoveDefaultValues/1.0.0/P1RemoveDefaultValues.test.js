const p1RemoveDefaultValues = require('./P1RemoveDefaultValues');
const ERRORS = require ('./ErrorsEnum');

describe('p1RemoveDefaultValues Suite 1', () => {

  test('Passing null, return general error', () => {
    expect(p1RemoveDefaultValues(null))
    .toBe(ERRORS.GENERAL_ERROR);
  });

  test('Passing undefined, return general error', () => {
    expect(p1RemoveDefaultValues(undefined))
    .toBe(ERRORS.GENERAL_ERROR);
  });

  test('Passing empty object, return general error', () => {
    expect(p1RemoveDefaultValues({}))
    .toBe(ERRORS.GENERAL_ERROR);
  });

  test('Passing both undefined, return general error', () => {
    expect(p1RemoveDefaultValues({
      'parameters': undefined,
      'input-object': undefined,
    }))
    .toBe(ERRORS.GENERAL_ERROR);
  });

  test('Passing only parameters property, return input object not provided', () => {
    expect(p1RemoveDefaultValues({
      'parameters': {},
      // 'input-object': // something,
    }))
    .toBe(ERRORS.INPUTOBJ_NOT_PROVIDED);
  });

  test('Passing only input-object property, return parameter not provided', () => {
    expect(p1RemoveDefaultValues({
      // 'parameters': // something,
      'input-object': {},
    }))
    .toBe(ERRORS.PARAMS_NOT_PROVIDED);
  });

  test('Passing properties but both empty objects, return general error', () => {
    expect(p1RemoveDefaultValues({
      'parameters': {},
      'input-object': {},
    }))
    .toBe(ERRORS.GENERAL_ERROR);
  });

  test('Passing only input-object property, return input object not provided', () => {
    expect(p1RemoveDefaultValues({
      'parameters': { 'abc-parameter': 0,},
      'input-object': {},
    }))
    .toBe(ERRORS.INPUTOBJ_INVALID);
  });

  test('Passing only input-object and empty parameters, return parameter invalid', () => {
    expect(p1RemoveDefaultValues({
      'parameters': {},
      'input-object': { 'abc-parameter': 0,},
    }))
    .toBe(ERRORS.PARAMS_INVALID);
  });

  test('Passing parameters and input-object property, return cleaned-object as empty object', () => {
    expect(p1RemoveDefaultValues({
      'parameters': { 'abc-parameter': 0 },
      'input-object': { 'abc-parameter': 0}
    }))
    .toStrictEqual({
      "cleaned-object": {}
    });
  });

  test('Passing parameters and input-object property, return cleaned object without "default-paramer"', () => {
    expect(p1RemoveDefaultValues({
      'parameters': {
        'abc-parameter': 10,
        '123-parameter': 20,
        'xyz-parameter': 30,
        'other-parameter': "SIAE",
        'default-parameter': "Milano"
      },
      'input-object': {
        'abc-parameter': 1,
        '123-parameter': 2,
        'xyz-parameter': 3,
        'other-parameter': "Lorenzo",
        'default-parameter': "Milano"
      }
    }))
    .toStrictEqual({
      "cleaned-object": {
        'abc-parameter': 1,
        '123-parameter': 2,
        'xyz-parameter': 3,
        'other-parameter': "Lorenzo"
        // 'default-parameter': "Milano"
      }
    });
  });

  test('Passing parameters and input-object property, return cleaned object without "default-paramer"', () => {
    expect(p1RemoveDefaultValues({
      'parameters': {
        'abc-parameter': 10,
        '123-parameter': 20,
        'xyz-parameter': 30,
        'other-parameter': "SIAE",
        'default-parameter': "Milano"
      },
      'input-object': {
        'abc-parameter': 1,
        '123-parameter': 2,
        'xyz-parameter': 3,
        'other-parameter': "SIAE",
        'default-parameter': "Milano"
      }
    }))
    .toStrictEqual({
      "cleaned-object": {
        'abc-parameter': 1,
        '123-parameter': 2,
        'xyz-parameter': 3,
        // 'other-parameter': "SIAE"
        // 'default-parameter': "Milano"
      }
    });
  });

  test('Passing parameters and input-object property, return cleaned-object without "default-paramer"', () => {
    expect(p1RemoveDefaultValues({
      'parameters': {
        'abc-parameter': 10,
        '123-parameter': 20,
        'xyz-parameter': 30,
        'other-parameter': "SIAE",
        'default-parameter': "Milano"
      },
      'input-object': {
        'abc-parameter': 10,
        '123-parameter': 20,
        'xyz-parameter': 30,
        'other-parameter': "SIAE",
        'default-parameter': "Milano"
      }
    }))
    .toStrictEqual({
      "cleaned-object": {
        // 'abc-parameter': 10,
        // '123-parameter': 20,
        // 'xyz-parameter': 30,
        // 'other-parameter': "SIAE"
        // 'default-parameter': "Milano"
      }
    });
  });
});

