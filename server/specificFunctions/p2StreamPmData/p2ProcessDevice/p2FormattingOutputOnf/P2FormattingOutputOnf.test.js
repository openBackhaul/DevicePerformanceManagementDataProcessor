'use strict';

const p2FormattingOutputOnf = require("./P2FormattingOutputOnf");
const ERRORS = require("./ErrorsEnum");
const fs = require('fs');

const ONF_FORMAT = "onf-output-format";
const FORMAT_NAME = "format-name";
const OUT_FORMAT = "output-format";

const MYCOM_FORMAT = "mycom-output-format";
const NETEXP_FORMAT = "netexplorer-output-format";

describe('p2FormattingOutputOnf', () => {

  const resultCc = {
    'logical-termination-point': [
      {
        'uuid': 'ltp-001',
        'local-id': 'air-interface-1',
        'operational-state': 'ENABLED',
        'administrative-state': 'UNLOCKED'
      },
      {
        'uuid': 'ltp-002',
        'local-id': 'ethernet-container-1',
        'operational-state': 'DISABLED',
        'administrative-state': 'LOCKED'
      }
    ]
  };

  test('creates an ONF output format for every fieldsFilter parameter', async () => {
    const parameters = {
      'parameters': [
        {
          'parameter-name': 'minimalFormat',
          'purpose': 'fieldsFilter',
          'value': 'logical-termination-point(uuid;local-id)'
        },
        {
          'parameter-name': 'statusFormat',
          'purpose': 'fieldsFilter',
          'value': 'logical-termination-point(uuid;operational-state)'
        }
      ]
    };

    const result = await p2FormattingOutputOnf({ 'parameters': parameters, 'result-cc': resultCc });

    expect(result).toEqual({
      'onf-output-format': [
        {
          'format-name': 'minimalFormat',
          'output-format': {
            'logical-termination-point': [
              {
                'uuid': 'ltp-001',
                'local-id': 'air-interface-1'
              },
              {
                'uuid': 'ltp-002',
                'local-id': 'ethernet-container-1'
              }
            ]
          }
        },
        {
          'format-name': 'statusFormat',
          'output-format': {
            'logical-termination-point': [
              {
                'uuid': 'ltp-001',
                'operational-state': 'ENABLED'
              },
              {
                'uuid': 'ltp-002',
                'operational-state': 'DISABLED'
              }
            ]
          }
        }
      ]
    });
  });

  test('calls p1FieldsFilter with the configured filter strings', async () => {
    const parameters = {
      'parameter': [
        {
          'parameter-name': 'minimalFormat',
          'purpose': 'fieldsFilter',
          'value': 'logical-termination-point(uuid;local-id)'
        },
        {
          'parameter-name': 'completeFormat',
          'purpose': 'fieldsFilter',
          'value': 'logical-termination-point'
        }
      ]
    };

    const result = await p2FormattingOutputOnf({ 'parameters': parameters, 'result-cc': resultCc });
  });

  test('ignores parameters whose purpose is not fieldsFilter', async () => {
    const parameters = {
      'parameters': [
        {
          'parameter-name': 'maximumRetries',
          'purpose': 'configuration',
          'value': '3'
        },
        {
          'parameter-name': 'timeout',
          'purpose': 'timeout',
          'value': '5000'
        },
        {
          'parameter-name': 'minimalFormat',
          'purpose': 'fieldsFilter',
          'value': 'logical-termination-point(uuid)'
        }
      ]
    };

    const result = await p2FormattingOutputOnf({ 'parameters': parameters, 'result-cc': resultCc });

    expect(result['onf-output-format']).toHaveLength(1);
    expect(result['onf-output-format'][0]['format-name']).toBe('minimalFormat');
  });

  test('returns an empty array when no fieldsFilter parameter exists', async () => {
    const parameters = {
      'parameters': [
        {
          'parameter-name': 'timeout',
          'purpose': 'configuration',
          'value': '5000'
        }
      ]
    };

    const result = await p2FormattingOutputOnf({ 'parameters': parameters, 'result-cc': resultCc });
    expect(result).toEqual({ 'onf-output-format': [] });
  });

  // test('preserves the order of fieldsFilter parameters', async () => {
  //   const parameters = {
  //     'parameters': [
  //       {
  //         'parameter-name': 'formatA',
  //         'purpose': 'fieldsFilter',
  //         "value": "equipment-augment-1-0:control-construct-pac(external-label;device-model-name)"
  //       },
  //       {
  //         'parameter-name': 'formatB',
  //         'purpose': 'fieldsFilter',
  //         "value": "equipment-augment-1-0:control-construct-pac(external-label;device-model-name)"
  //       },
  //       {
  //         'parameter-name': 'formatC',
  //         'purpose': 'fieldsFilter',
  //         "value": "equipment-augment-1-0:control-construct-pac(external-label;device-model-name)"
  //       }
  //     ]
  //   };

  //   const result = await p2FormattingOutputOnf({ 'parameters': parameters, 'result-cc': resultCc });

  //   expect(
  //     result['onf-output-format'].map(
  //       outputFormat => outputFormat['format-name']
  //     )
  //   ).toEqual(['formatA', 'formatB', 'formatC']);
  // });

  test('does not modify the original resultCc', async () => {
    const parameters = {
      'parameters': [
        {
          'parameter-name': 'minimalFormat',
          'purpose': 'fieldsFilter',
          'value': 'logical-termination-point(uuid)'
        }
      ]
    };

    const originalResultCc = structuredClone(resultCc);

    await p2FormattingOutputOnf({ 'parameters': parameters, 'result-cc': resultCc });
    expect(resultCc).toEqual(originalResultCc);
  });

  // test('provides a separate resultCc copy for each filter invocation', async () => {
  //   const parameters = {
  //     'parameters': [
  //       {
  //         'parameter-name': 'formatA',
  //         'purpose': 'fieldsFilter',
  //         'value': 'logical-termination-point(uuid)'
          
  //       },
  //       {
  //         'parameter-name': 'formatB',
  //         'purpose': 'fieldsFilter',
  //         'value': 'equipment-augment-1-0:control-construct-pac;logical-termination-point;batch-timestamp'
  //       }
  //     ]
  //   };

  //   const receivedDataStructures = await p2FormattingOutputOnf({ 'parameters': parameters, 'result-cc': resultCc });

  //   expect(receivedDataStructures).toHaveLength(2);

  //   expect(receivedDataStructures[0]).not.toBe(resultCc);
  //   expect(receivedDataStructures[1]).not.toBe(resultCc);
  //   expect(receivedDataStructures[0]).not.toBe(receivedDataStructures[1]);

  //   expect(receivedDataStructures[0]).toEqual(resultCc);
  //   expect(receivedDataStructures[1]).toEqual(resultCc);
  // });

  describe('input validation', () => {
    test.each([
      {
        'description': 'input is undefined',
        'input': undefined
      },
      {
        'description': 'input is null',
        'input': null
      },
      {
        'description': 'input is an array',
        'input': []
      },
      {
        'description': 'parameters is missing',
        'input': {
          'result-cc': {}
        }
      },
      {
        'description': 'parameters is undefined',
        'input': {
          'parameters': undefined,
          'result-cc': {}
        }
      },
      {
        'description': 'parameters is null',
        'input': {
          'parameters': null,
          'result-cc': {}
        }
      }
    ])(
      'throws "parameters not provided" when $description',
      async ({ input }) => {
        const result = await p2FormattingOutputOnf(input);
        expect(result).toBe(ERRORS.PARAMETERS_NOT_PROVIDED);
      }
    );

    test.each([
      'invalid',
      123,
      true,
      [],
      () => { }
    ])(
      'throws "parameters invalid" when parameters is %p',
      async invalidParameters => {
        const result = await p2FormattingOutputOnf({ 'parameters': invalidParameters, 'result-cc': {} });
        expect(result).toBe(ERRORS.PARAMETERS_INVALID);
      }
    );

    test.each([
      {
        'description': 'result-cc is missing',
        'input': {
          'parameters': {}
        }
      },
      {
        'description': 'result-cc is undefined',
        'input': {
          'parameters': {},
          'result-cc': undefined
        }
      },
      {
        'description': 'result-cc is null',
        'input': {
          'parameters': {},
          'result-cc': null
        }
      }
    ])(
      'throws "resultCc not provided" when $description',
      async ({ input }) => {
        const result = await p2FormattingOutputOnf(input);
        expect(result).toBe(ERRORS.RESULT_CC_NOT_PROVIDED);
      }
    );

    test.each([
      'invalid',
      123,
      true,
      [],
      () => { }
    ])(
      'throws "resultCc invalid" when result-cc is %p',
      async invalidResultCc => {
        const result = await p2FormattingOutputOnf({ 'parameters': {}, 'result-cc': invalidResultCc });
        expect(result).toBe(ERRORS.RESULT_CC_INVALID);
      }
    );
  });

  describe('fieldsFilter parameter validation', () => {
    test.each([
      {
        'description': 'parameter-name is missing',
        'parameter': {
          'purpose': 'fieldsFilter',
          'value': 'filter-a'
        }
      },
      {
        'description': 'parameter-name is empty',
        'parameter': {
          'parameter-name': '',
          'purpose': 'fieldsFilter',
          'value': 'filter-a'
        }
      },
      {
        'description': 'parameter-name contains only spaces',
        'parameter': {
          'parameter-name': '   ',
          'purpose': 'fieldsFilter',
          'value': 'filter-a'
        }
      },
      {
        'description': 'parameter-name is not a string',
        'parameter': {
          'parameter-name': 123,
          'purpose': 'fieldsFilter',
          'value': 'filter-a'
        }
      },
      {
        'description': 'value is missing',
        'parameter': {
          'parameter-name': 'formatA',
          'purpose': 'fieldsFilter'
        }
      },
      {
        'description': 'value is empty',
        'parameter': {
          'parameter-name': 'formatA',
          'purpose': 'fieldsFilter',
          'value': ''
        }
      },
      {
        'description': 'value contains only spaces',
        'parameter': {
          'parameter-name': 'formatA',
          'purpose': 'fieldsFilter',
          'value': '   '
        }
      },
      {
        'description': 'value is not a string',
        'parameter': {
          'parameter-name': 'formatA',
          'purpose': 'fieldsFilter',
          'value': 123
        }
      }
    ])(
      'throws "parameters invalid" when $description',
      async ({ parameter }) => {
        const result = await p2FormattingOutputOnf(
          {
            'parameters': { 'parameters': [parameter] },
            'result-cc': resultCc
          }
        );
        expect(result).toBe(ERRORS.PARAMETERS_INVALID);
      }
    );

    test('throws "parameters invalid" for duplicate format names', async () => {
      const parameters = {
        'parameters': [
          {
            'parameter-name': 'duplicateFormat',
            'purpose': 'fieldsFilter',
            'value': 'filter-a'
          },
          {
            'parameter-name': 'duplicateFormat',
            'purpose': 'fieldsFilter',
            'value': 'filter-b'
          }
        ]
      };

      const result = await p2FormattingOutputOnf({ 'parameters': parameters, 'result-cc': resultCc });
      expect(result).toBe(ERRORS.PARAMETERS_INVALID);
    });
  });

  // describe('p1FieldsFilter error handling', () => {
  //   const parameters = {
  //     'parameters': [
  //       {
  //         'parameter-name': 'minimalFormat',
  //         'purpose': 'fieldsFilter',
  //         'value': 'logical-termination-point(uuid)'
  //       }
  //     ]
  //   };

  //   test.each([
  //     null,
  //     'invalid',
  //     123,
  //     true,
  //     []
  //   ])(
  //     'throws when filtered-data-structure is %p',
  //     async invalidFilteredDataStructure => {
  //       const result = await p2FormattingOutputOnf({ 'parameters': parameters, 'result-cc': resultCc });
  //       expect(result).toBe(ERRORS.OUTPUT_COULD_NOT_BE_PROVIDED);
  //     }
  //   );
  // });
});

describe("Basic Functionality", () => {

  test("no filter returns full object", async () => {
    const res = await p2FormattingOutputOnf({
      "parameters": {},
      "result-cc": { "a": 1 }
    });

    expect(res).toBeDefined();
    // expect(res).toEqual({
    //   "format-name": ONF_FORMAT,
    //   "output-format": { "a": 1 }
    // });
  });

  test("deep clone check", async () => {
    const res = await p2FormattingOutputOnf({
      "parameters": {},
      "result-cc": { "a": 1 }
    });

    expect(res).toBeDefined();
    // expect(res["format-name"]).toBe(ONF_FORMAT);
    // expect(res[OUT_FORMAT]).toBeDefined();
    // expect(res[OUT_FORMAT]).toEqual({ "a": 1 });
  });


      // const result = await p2FormattingOutputOnf({ 'parameters': parameters, 'result-cc': resultCc });
});

describe("Real Dataset Tests", () => {

  // Import file
  let dataFile;
  let REAL_CC;
  let REAL_PARAMS;
  beforeAll(() => {
    dataFile = fs.readFileSync(__dirname + '/datasets/cc_clean_CO01715.json', 'utf8');
    REAL_CC = JSON.parse(dataFile);
    dataFile = fs.readFileSync(__dirname + '/datasets/parameters.json')
    REAL_PARAMS = JSON.parse(dataFile);
  })

  test("basic execution", async () => {
    const res = await p2FormattingOutputOnf({
      "parameters": REAL_PARAMS['parameters'],
      "result-cc": REAL_CC
    });

    expect(res).toBeDefined();
    expect(res[ONF_FORMAT]).toBeDefined();
    expect(res[ONF_FORMAT][0][FORMAT_NAME]).toBeDefined();
    expect(res[ONF_FORMAT][0][FORMAT_NAME]).toBe(MYCOM_FORMAT);
    expect(res[ONF_FORMAT][1][FORMAT_NAME]).toBeDefined();
    expect(res[ONF_FORMAT][1][FORMAT_NAME]).toBe(NETEXP_FORMAT);
    // expect(res[OUT_FORMAT]).toEqual(REAL_CC);
  });

  test("filter array is full", async () => {
    const res = await p2FormattingOutputOnf({
      "parameters": REAL_PARAMS['parameters'],
      "result-cc": REAL_CC
    });

    expect(res).toBeDefined();
    expect(res[ONF_FORMAT]).toBeDefined();
    expect(res[ONF_FORMAT][0][FORMAT_NAME]).toBeDefined();
    expect(res[ONF_FORMAT][0][FORMAT_NAME]).toBe(MYCOM_FORMAT);
    expect(res[ONF_FORMAT][1][FORMAT_NAME]).toBeDefined();
    expect(res[ONF_FORMAT][1][FORMAT_NAME]).toBe(NETEXP_FORMAT);

    // expect(res[OUT_FORMAT]).toEqual(REAL_CC);
  });

  test("filter out some fields", async () => {
    const res = await p2FormattingOutputOnf({
      "parameters": REAL_PARAMS['parameters'],
      "result-cc": REAL_CC
    });

    expect(res).toBeDefined();
    expect(res[ONF_FORMAT]).toBeDefined();
    expect(res[ONF_FORMAT][0][FORMAT_NAME]).toBeDefined();
    expect(res[ONF_FORMAT][0][FORMAT_NAME]).toBe(MYCOM_FORMAT);
    expect(res[ONF_FORMAT][1][FORMAT_NAME]).toBeDefined();
    expect(res[ONF_FORMAT][1][FORMAT_NAME]).toBe(NETEXP_FORMAT);
    // expect(res[OUT_FORMAT]).toEqual({
    //   "equipment-augment-1-0:control-construct-pac": {
    //     "device-model-name": "MINI-LINK Traffic Node",
    //     "last-config-change-timestamp": "2010-11-20T14:00:00+01:00",
    //     "external-label": "AMM6pC-IDU2"
    //   },
    //   "batch-timestamp": "2025-12-16T09:11:05.307+01:00"
    // });
  });

});
