jest.mock('../genericFunctions/p1LoadParameters/P1LoadParameters', () => ({
    run: jest.fn()
}));

jest.mock('../genericFunctions/p1DocumentFunction/P1DocumentFunction', () =>
    jest.fn()
);

jest.mock('../genericFunctions/p1ResolveEsAddress/P1ResolveEsAddress', () => ({
    run: jest.fn()
}));

jest.mock('../genericFunctions/p1ReadDataStoreDeviceData/P1ReadDataStoreDeviceData', () =>
    jest.fn()
);

jest.mock('../utils/functionTree', () => ({
    getParamFromFunction: jest.fn(),
    findFunctionNode: jest.fn()
}));

const p1LoadParameters = require('../genericFunctions/p1LoadParameters/P1LoadParameters');
const p1DocumentFunction = require('../genericFunctions/p1DocumentFunction/P1DocumentFunction');
const p1ResolveEsAddress = require('../genericFunctions/p1ResolveEsAddress/P1ResolveEsAddress');
const p1ReadDataStoreDeviceData = require('../genericFunctions/p1ReadDataStoreDeviceData/P1ReadDataStoreDeviceData');
const { getParamFromFunction, findFunctionNode } = require('../utils/functionTree');

const { documentPmDataProcessing, provideDeviceDataStoreDump } = require('./IndividualServicesService');

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
    it('rejects when loading the function to be documented fails', async () => {
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

        p1LoadParameters.run
            .mockResolvedValueOnce({
                parameters: ownFunctionParameters,
                configFile: { 'config-file': true }
            })
            .mockRejectedValueOnce(new Error('failed to load documented function'));

        getParamFromFunction.mockReturnValue('someFunctionName');

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
            message: 'failed to load documented function'
        });

        expect(p1LoadParameters.run).toHaveBeenCalledTimes(2);
        expect(p1LoadParameters.run).toHaveBeenNthCalledWith(1, {
            functionName: 'documentPmDataProcessing'
        });
        expect(p1LoadParameters.run).toHaveBeenNthCalledWith(2, {
            functionName: 'someFunctionName',
            configFile: { 'config-file': true }
        });
        expect(p1DocumentFunction).not.toHaveBeenCalled();
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
describe('provideDeviceDataStoreDump', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const baseArgs = {
        body: { 'mount-name': '100250001' },
        user: 'user',
        originator: 'originator',
        xCorrelator: 'x-correlator',
        traceIndicator: 'trace-indicator',
        customerJourney: 'customer-journey'
    };

    const mockParameters = {
        'function-name': 'provideDeviceDataStoreDump',
        'is-active': true,
        parameter: [],
        'sub-function': [
            {
                'function-name': 'p1ResolveEsAddress',
                'is-active': true,
                parameter: [
                    {
                        'parameter-name': 'dataStoreEsClient',
                        value: 'dpmdp-1-1-0-es-c-es-1-0-0-021'
                    }
                ],
                'sub-function': []
            }
        ]
    };

    const mockEsAddress = {
        uuid: 'dpmdp-1-1-0-es-c-es-1-0-0-021',
        url: 'http://127.0.0.1:9200',
        'index-alias': '22',
        'api-key': 'API key not yet defined.'
    };

    const mockDevicePmData = [
        {
            'batch-timestamp': '2026-07-07T10:00:00.000Z',
            'result-cc': {
                'control-construct': [
                    { uuid: 'air-interface-1', 'historical-performance-data-list': [] }
                ]
            }
        }
    ];

    it('returns the device PM data when the flow succeeds', async () => {
        p1LoadParameters.run.mockResolvedValue({
            parameters: mockParameters,
            configFile: { 'core-model-1-4:control-construct': true }
        });
        findFunctionNode.mockReturnValue(mockParameters['sub-function'][0]);
        p1ResolveEsAddress.run.mockResolvedValue({ esAddress: mockEsAddress });
        p1ReadDataStoreDeviceData.mockResolvedValue({
            'device-pm-data': mockDevicePmData
        });

        const result = await provideDeviceDataStoreDump(
            baseArgs.body,
            baseArgs.user,
            baseArgs.originator,
            baseArgs.xCorrelator,
            baseArgs.traceIndicator,
            baseArgs.customerJourney
        );

        expect(p1LoadParameters.run).toHaveBeenCalledWith({
            functionName: 'provideDeviceDataStoreDump'
        });
        expect(findFunctionNode).toHaveBeenCalledWith(
            mockParameters,
            'p1ResolveEsAddress'
        );
        expect(p1ResolveEsAddress.run).toHaveBeenCalledWith({
            parameters: mockParameters['sub-function'][0],
            configFile: { 'core-model-1-4:control-construct': true },
            esName: 'dataStoreEsClient'
        });
        expect(p1ReadDataStoreDeviceData).toHaveBeenCalledWith({
            'data-store-es-client': mockEsAddress,
            'mount-name': '100250001'
        });
        expect(result).toEqual({ 'device-pm-data': mockDevicePmData });
    });

    it('rejects with 400 when mount-name is missing', async () => {
        await expect(
            provideDeviceDataStoreDump(
                {},
                baseArgs.user,
                baseArgs.originator,
                baseArgs.xCorrelator,
                baseArgs.traceIndicator,
                baseArgs.customerJourney
            )
        ).rejects.toEqual({
            code: 400,
            message: 'mountName not provided'
        });

        expect(p1LoadParameters.run).not.toHaveBeenCalled();
    });

    it('rejects with 400 when the body is null', async () => {
        await expect(
            provideDeviceDataStoreDump(
                null,
                baseArgs.user,
                baseArgs.originator,
                baseArgs.xCorrelator,
                baseArgs.traceIndicator,
                baseArgs.customerJourney
            )
        ).rejects.toEqual({
            code: 400,
            message: 'mountName not provided'
        });

        expect(p1LoadParameters.run).not.toHaveBeenCalled();
    });

    it('rejects with 400 when the body is not an object', async () => {
        await expect(
            provideDeviceDataStoreDump(
                'not-an-object',
                baseArgs.user,
                baseArgs.originator,
                baseArgs.xCorrelator,
                baseArgs.traceIndicator,
                baseArgs.customerJourney
            )
        ).rejects.toEqual({
            code: 400,
            message: 'mountName not provided'
        });

        expect(p1LoadParameters.run).not.toHaveBeenCalled();
    });

    it('rejects with 400 when mount-name is empty', async () => {
        await expect(
            provideDeviceDataStoreDump(
                { 'mount-name': '' },
                baseArgs.user,
                baseArgs.originator,
                baseArgs.xCorrelator,
                baseArgs.traceIndicator,
                baseArgs.customerJourney
            )
        ).rejects.toEqual({
            code: 400,
            message: 'mountName not provided'
        });
    });

    it('rejects with 400 when mount-name is not a string', async () => {
        await expect(
            provideDeviceDataStoreDump(
                { 'mount-name': 100250001 },
                baseArgs.user,
                baseArgs.originator,
                baseArgs.xCorrelator,
                baseArgs.traceIndicator,
                baseArgs.customerJourney
            )
        ).rejects.toEqual({
            code: 400,
            message: 'mountName invalid'
        });
    });
it('rejects with 404 when the mount name is not found in the DataStore', async () => {
        p1LoadParameters.run.mockResolvedValue({
            parameters: mockParameters,
            configFile: { 'core-model-1-4:control-construct': true }
        });
        findFunctionNode.mockReturnValue(mockParameters['sub-function'][0]);
        p1ResolveEsAddress.run.mockResolvedValue({ esAddress: mockEsAddress });
        p1ReadDataStoreDeviceData.mockResolvedValue('mountName not found in DataStore');

        await expect(
            provideDeviceDataStoreDump(
                baseArgs.body,
                baseArgs.user,
                baseArgs.originator,
                baseArgs.xCorrelator,
                baseArgs.traceIndicator,
                baseArgs.customerJourney
            )
        ).rejects.toEqual({
            code: 404,
            message: 'mountName not found in DataStore'
        });
    });

    it('rejects with 400 when the DataStore URL is invalid', async () => {
        p1LoadParameters.run.mockResolvedValue({
            parameters: mockParameters,
            configFile: { 'core-model-1-4:control-construct': true }
        });
        findFunctionNode.mockReturnValue(mockParameters['sub-function'][0]);
        p1ResolveEsAddress.run.mockResolvedValue({ esAddress: mockEsAddress });
        p1ReadDataStoreDeviceData.mockResolvedValue('dataStoreUrl invalid');

        await expect(
            provideDeviceDataStoreDump(
                baseArgs.body,
                baseArgs.user,
                baseArgs.originator,
                baseArgs.xCorrelator,
                baseArgs.traceIndicator,
                baseArgs.customerJourney
            )
        ).rejects.toEqual({
            code: 400,
            message: 'dataStoreUrl invalid'
        });
    });

    it('rejects with 500 when reading from ElasticSearch fails', async () => {
        p1LoadParameters.run.mockResolvedValue({
            parameters: mockParameters,
            configFile: { 'core-model-1-4:control-construct': true }
        });
        findFunctionNode.mockReturnValue(mockParameters['sub-function'][0]);
        p1ResolveEsAddress.run.mockResolvedValue({ esAddress: mockEsAddress });
        p1ReadDataStoreDeviceData.mockResolvedValue('ElasticSearch read error');

        await expect(
            provideDeviceDataStoreDump(
                baseArgs.body,
                baseArgs.user,
                baseArgs.originator,
                baseArgs.xCorrelator,
                baseArgs.traceIndicator,
                baseArgs.customerJourney
            )
        ).rejects.toEqual({
            code: 500,
            message: 'ElasticSearch read error'
        });
    });

    it('rejects with 500 when p1LoadParameters fails', async () => {
        p1LoadParameters.run.mockRejectedValue(new Error('Function profile not found for provideDeviceDataStoreDump'));

        await expect(
            provideDeviceDataStoreDump(
                baseArgs.body,
                baseArgs.user,
                baseArgs.originator,
                baseArgs.xCorrelator,
                baseArgs.traceIndicator,
                baseArgs.customerJourney
            )
        ).rejects.toEqual({
            code: 500,
            message: 'Function profile not found for provideDeviceDataStoreDump'
        });
    });

    it('rejects with 500 and a generic message when the error has no message', async () => {
        p1LoadParameters.run.mockRejectedValue(new Error());

        await expect(
            provideDeviceDataStoreDump(
                baseArgs.body,
                baseArgs.user,
                baseArgs.originator,
                baseArgs.xCorrelator,
                baseArgs.traceIndicator,
                baseArgs.customerJourney
            )
        ).rejects.toEqual({
            code: 500,
            message: 'General processing error'
        });
    });
});