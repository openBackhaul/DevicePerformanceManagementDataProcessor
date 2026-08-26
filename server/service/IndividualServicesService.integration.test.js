jest.mock('../genericFunctions/p1DocumentFunction/P1DocumentFunction', () =>
    jest.fn()
);

const path = require('path');
const p1DocumentFunction = require('../genericFunctions/p1DocumentFunction/P1DocumentFunction');
const p1LoadParameters = require('../genericFunctions/p1LoadParameters/P1LoadParameters');
const { loadFunctionParameters, getParamFromFunction } = require('../utils/functionTree');

const { documentPmDataProcessing } = require('./IndividualServicesService');

describe('Integration - documentPmDataProcessing with real config', () => {
    const realConfig = require('../database/config.json');

    let functionNameToDocument;
    let p1LoadParametersSpy;

    beforeAll(() => {
        global.databasePath = path.resolve(__dirname, '../database/config.json');
    });

    beforeEach(() => {
        jest.clearAllMocks();

        const ownFunctionParameters = loadFunctionParameters(realConfig, 'documentPmDataProcessing');
        functionNameToDocument = getParamFromFunction(
            ownFunctionParameters,
            'documentPmDataProcessing',
            'nameOfToBeDocumentedFunction'
        );

        p1DocumentFunction.mockReturnValue(`- ${functionNameToDocument}`);
        p1LoadParametersSpy = jest.spyOn(p1LoadParameters, 'run');
    });

    afterEach(() => {
        p1LoadParametersSpy.mockRestore();
    });

    const baseArgs = {
        body: {},
        user: 'user',
        originator: 'originator',
        xCorrelator: 'x-correlator',
        traceIndicator: 'trace-indicator',
        customerJourney: 'customer-journey'
    };

    it('loads the real config.json and documents the function referenced by nameOfToBeDocumentedFunction', async () => {
        const result = await documentPmDataProcessing(
            baseArgs.body,
            baseArgs.user,
            baseArgs.originator,
            baseArgs.xCorrelator,
            baseArgs.traceIndicator,
            baseArgs.customerJourney
        );

        expect(p1LoadParametersSpy).toHaveBeenCalledTimes(2);

        expect(p1LoadParametersSpy).toHaveBeenNthCalledWith(1, {
            functionName: 'documentPmDataProcessing'
        });

        expect(p1LoadParametersSpy).toHaveBeenNthCalledWith(2, {
            functionName: functionNameToDocument,
            configFile: expect.any(Object)
        });

        // 4. p1DocumentFunction viene chiamata con la struttura corretta
        expect(p1DocumentFunction).toHaveBeenCalledTimes(1);
        expect(p1DocumentFunction).toHaveBeenCalledWith({
            "parameters-of-to-be-documented-function": expect.objectContaining({
                "function-name": functionNameToDocument,
                "is-active": true
            })
        });

        expect(result).toBe(`- ${functionNameToDocument}`);
    });
});