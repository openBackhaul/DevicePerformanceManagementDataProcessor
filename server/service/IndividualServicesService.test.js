jest.mock('../genericFunctions/p1LoadParameters/P1LoadParameters', () => ({
    run: jest.fn()
}));

jest.mock('../genericFunctions/p1DocumentFunction/P1DocumentFunction', () =>
    jest.fn()
);

jest.mock('../utils/functionTree', () => ({
    getParamFromFunction: jest.fn()
}));

const p1LoadParameters = require('../genericFunctions/p1LoadParameters/P1LoadParameters');
const p1DocumentFunction = require('../genericFunctions/p1DocumentFunction/P1DocumentFunction');
const { getParamFromFunction } = require('../utils/functionTree');

const { documentPmDataProcessing } = require('./IndividualServicesService');

describe('documentPmDataProcessing', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const baseArgs = {
        body: {},
        user: 'user',
        originator: 'originator',
        xCorrelator: 'x-correlator',
        traceIndicator: 'trace-indicator',
        customerJourney: 'customer-journey'
    };

    it('returns documentation when configuration is valid', async () => {
        const ownFunctionParameters = {
            'function-name': 'documentPmDataProcessing',
            'is-active': true,
            parameter: [
                {
                    'parameter-name': 'nameOfToBeDocumentedFunction',
                    value: 'someFunctionName'
                }
            ],
            'sub-function': []
        };

        const documentedFunctionParameters = {
            'function-name': 'someFunctionName',
            'is-active': true,
            parameter: [],
            'sub-function': []
        };

        p1LoadParameters.run
            .mockResolvedValueOnce({
                parameters: ownFunctionParameters,
                configFile: { 'config-file': true }
            })
            .mockResolvedValueOnce({
                parameters: documentedFunctionParameters,
                configFile: { 'config-file': true }
            });

        getParamFromFunction.mockReturnValue('someFunctionName');
        p1DocumentFunction.mockReturnValue('- someFunctionName');

        const result = await documentPmDataProcessing(
            baseArgs.body,
            baseArgs.user,
            baseArgs.originator,
            baseArgs.xCorrelator,
            baseArgs.traceIndicator,
            baseArgs.customerJourney
        );

        expect(p1LoadParameters.run).toHaveBeenCalledTimes(2);
        expect(p1LoadParameters.run).toHaveBeenNthCalledWith(1, {
            functionName: 'documentPmDataProcessing'
        });
        expect(getParamFromFunction).toHaveBeenCalledWith(
            ownFunctionParameters,
            'documentPmDataProcessing',
            'nameOfToBeDocumentedFunction'
        );
        expect(p1LoadParameters.run).toHaveBeenNthCalledWith(2, {
            functionName: 'someFunctionName',
            configFile: { 'config-file': true }
        });
        expect(p1DocumentFunction).toHaveBeenCalledWith({
            "parameters-of-to-be-documented-function": documentedFunctionParameters
        });
        expect(result).toBe('- someFunctionName');
    });

    it('rejects when nameOfToBeDocumentedFunction is missing', async () => {
        const ownFunctionParameters = {
            'function-name': 'documentPmDataProcessing',
            'is-active': true,
            parameter: [],
            'sub-function': []
        };

        p1LoadParameters.run.mockResolvedValueOnce({
            parameters: ownFunctionParameters,
            configFile: { 'config-file': true }
        });

        getParamFromFunction.mockReturnValue(undefined);

        await expect(
            documentPmDataProcessing(
                baseArgs.body,
                baseArgs.user,
                baseArgs.originator,
                baseArgs.xCorrelator,
                baseArgs.traceIndicator,
                baseArgs.customerJourney
            )
        ).rejects.toEqual({
            code: 500,
            message: 'Missing nameOfToBeDocumentedFunction in documentPmDataProcessing configuration'
        });

        expect(p1LoadParameters.run).toHaveBeenCalledTimes(1);
        expect(p1DocumentFunction).not.toHaveBeenCalled();
    });

    it('rejects with an error when p1LoadParameters fails', async () => {
        p1LoadParameters.run.mockRejectedValueOnce(new Error('boom'));

        await expect(
            documentPmDataProcessing(
                baseArgs.body,
                baseArgs.user,
                baseArgs.originator,
                baseArgs.xCorrelator,
                baseArgs.traceIndicator,
                baseArgs.customerJourney
            )
        ).rejects.toEqual({
            code: 500,
            message: 'boom'
        });
    });

    it('rejects with a generic message when the error has no message', async () => {
        p1LoadParameters.run.mockRejectedValueOnce(new Error());

        await expect(
            documentPmDataProcessing(
                baseArgs.body,
                baseArgs.user,
                baseArgs.originator,
                baseArgs.xCorrelator,
                baseArgs.traceIndicator,
                baseArgs.customerJourney
            )
        ).rejects.toEqual({
            code: 500,
            message: 'Failed to create PM data processing documentation'
        });
    });
});