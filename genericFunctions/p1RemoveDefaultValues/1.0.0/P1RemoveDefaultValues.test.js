const p1RemoveDefaultValues = require('./P1RemoveDefaultValues');
const ERRORS = require ('./ErrorsEnum');

describe('Error Cases @negative', () => {

  test('Passing null, return general error @negative', () => {
    expect(p1RemoveDefaultValues(null))
    .toBe(ERRORS.GENERAL_ERROR);
  });

  test('Passing undefined, return general error @negative', () => {
    expect(p1RemoveDefaultValues(undefined))
    .toBe(ERRORS.GENERAL_ERROR);
  });

  test('Passing empty object, return general error @negative', () => {
    expect(p1RemoveDefaultValues({}))
    .toBe(ERRORS.GENERAL_ERROR);
  });

  test('Passing both undefined, return general error @negative', () => {
    expect(p1RemoveDefaultValues({
      'parameters': undefined,
      'input-object': undefined,
    }))
    .toBe(ERRORS.GENERAL_ERROR);
  });

  test('Passing only parameters property, return input object not provided @negative', () => {
    expect(p1RemoveDefaultValues({
      'parameters': {}
    }))
    .toBe(ERRORS.INPUTOBJ_NOT_PROVIDED);
  });

  test('Passing only input-object property, return parameter not provided @negative', () => {
    expect(p1RemoveDefaultValues({
      'input-object': {}
    }))
    .toBe(ERRORS.PARAM_NOT_PROVIDED);
  });

  test('Passing properties but both empty objects, return general error @negative', () => {
    expect(p1RemoveDefaultValues({
      'parameters': {},
      'input-object': {},
    }))
    .toBe(ERRORS.GENERAL_ERROR);
  });

  test('Passing only input-object property, return input object not provided @negative', () => {
    expect(p1RemoveDefaultValues({
      'parameters': { 'abc-parameter': 0,},
      'input-object': {},
    }))
    .toBe(ERRORS.INPUTOBJ_INVALID);
  });

  test('Passing only input-object and empty parameters, return parameter invalid @negative', () => {
    expect(p1RemoveDefaultValues({
      'parameters': {},
      'input-object': { 'abc-parameter': 0,},
    }))
    .toBe(ERRORS.PARAM_INVALID);
  });
});

describe('Positive Tests @positive', () => {

  test('Passing parameters and input-object property, return cleaned-object as empty object @positive', () => {
    expect(p1RemoveDefaultValues({
      'parameters': { 'abc-parameter': 0 },
      'input-object': { 'abc-parameter': 0}
    }))
    .toStrictEqual({
      "cleaned-object": {}
    });
  });

  test('Passing parameters and input-object property, return cleaned object without "default-parameter" @positive', () => {
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
      }
    });
  });

  test('Passing parameters and input-object property, return cleaned object without "default-parameter" @positive', () => {
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
        'xyz-parameter': 3
      }
    });
  });

  test('Passing parameters and input-object property, return cleaned-object without "default-parameter" @positive', () => {
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
      "cleaned-object": {}
    });
  });
});

describe('Mutation Detection Tests @mutation', () => {

  test('Should NOT mutate original input-object @mutation', () => {
    const original = {
      'default-parameter': 'value',
      'other-parameter': 'keep'
    };

    const result = p1RemoveDefaultValues({
      parameters: { 'default-parameter': 'value' },
      'input-object': original
    });

    expect(original['default-parameter']).toBe('value');
    expect(original['other-parameter']).toBe('keep');
  });

  test('Should NOT mutate original input-object when no removal @mutation', () => {
    const original = {
      'different-parameter': 'value'
    };

    const result = p1RemoveDefaultValues({
      parameters: { 'default-parameter': 'value' },
      'input-object': original
    });

    expect(original).toStrictEqual({ 'different-parameter': 'value' });
  });
});

describe('Falsy Value Tests @falsy', () => {

  test('Should remove falsy value 0 @falsy', () => {
    expect(p1RemoveDefaultValues({
      parameters: { 'count': 0 },
      'input-object': { 'count': 0 }
    }))
    .toStrictEqual({
      "cleaned-object": {}
    });
  });

  test('Should remove falsy value false @falsy', () => {
    expect(p1RemoveDefaultValues({
      parameters: { 'flag': false },
      'input-object': { 'flag': false }
    }))
    .toStrictEqual({
      "cleaned-object": {}
    });
  });

  test('Should remove empty string @falsy', () => {
    expect(p1RemoveDefaultValues({
      parameters: { 'empty': '' },
      'input-object': { 'empty': '' }
    }))
    .toStrictEqual({
      "cleaned-object": {}
    });
  });
});

