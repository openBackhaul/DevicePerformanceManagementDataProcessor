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
jest.mock('./LoggingService.js', () => ({
    getLogger: jest.fn(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }))
}));

const p1LoadParameters = require('../genericFunctions/p1LoadParameters/P1LoadParameters');
const p1DocumentFunction = require('../genericFunctions/p1DocumentFunction/P1DocumentFunction');
const p1ResolveEsAddress = require('../genericFunctions/p1ResolveEsAddress/P1ResolveEsAddress');
const p1ReadDataStoreDeviceData = require('../genericFunctions/p1ReadDataStoreDeviceData/P1ReadDataStoreDeviceData');
const { getParamFromFunction, findFunctionNode } = require('../utils/functionTree');

const { documentPmDataProcessing, provideDeviceDataStoreDump, initiatePmDataUpdate } = require('./IndividualServicesService');
const { ERRORS } = require('./IndividualServicesService');
const path = require('path');

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
describe('IndividualServicesService - initiatePmDataUpdate', () => {
    let mockAppState;
    let mockFetch;
    let mockP1LoadParameters;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Setup appState mock
        mockAppState = {};

        // Setup fetch mock
        mockFetch = jest.fn();
        global.fetch = mockFetch;

        // Setup p1LoadParameters mock
        mockP1LoadParameters = require('../genericFunctions/p1LoadParameters/P1LoadParameters');
        mockP1LoadParameters.run = jest.fn().mockResolvedValue({
            parameters: {
                parameter: [
                    { 'parameter-name': 'waitTimeForSending', value: '0' }
                ]
            }
        });

        // Setup functionTree mocks: the service captures them at module load
        // (IndividualServicesService.js:15), so reset the shared factory mocks
        // instead of reassigning module properties (the service would not see them).
        getParamFromFunction.mockReturnValue(0);
    });

    afterEach(() => {
        delete global.fetch;
    });

    test('all devices outdated -> should return 204', async () => {
        const body = {
            'mount-names': ['CO18302', 'CO18303']
        };

        const mwdiResponse = [
            {
                'mount-name': 'CO18302',
                'connection-status': 'connected',
                'last-successful-complete-control-construct-update-time': '2026-08-06T08:00:00.000Z' // 2 hours ago
            },
            {
                'mount-name': 'CO18303',
                'connection-status': 'connected',
                'last-successful-complete-control-construct-update-time': '2026-08-06T08:30:00.000Z' // 1.5 hours ago
            }
        ];

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mwdiResponse
        });
        // one control-construct GET per outdated mount (cache CC)
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

        const result = await initiatePmDataUpdate(
            body,
            'user',
            'originator',
            'x-correlator',
            'trace-indicator',
            'customer-journey'
        );

        expect(result).toHaveProperty('status', 'success');
        expect(result).not.toHaveProperty('already-up-to-date-mount-names');
    });

    test('one device up-to-date -> should return 200 with already-up-to-date-mount-names', async () => {
        const body = {
            'mount-names': ['CO18302', 'CO18303']
        };

        const now = new Date();
        const fiveMinutesAgo = new Date(now - 5 * 60 * 1000).toISOString();
        const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();

        const mwdiResponse = [
            {
                'mount-name': 'CO18302',
                'connection-status': 'connected',
                'last-successful-complete-control-construct-update-time': fiveMinutesAgo // up-to-date
            },
            {
                'mount-name': 'CO18303',
                'connection-status': 'connected',
                'last-successful-complete-control-construct-update-time': twoHoursAgo // outdated
            }
        ];

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mwdiResponse
        });
        // only CO18303 is outdated -> single control-construct GET (cache CC)
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

        const result = await initiatePmDataUpdate(
            body,
            'user',
            'originator',
            'x-correlator',
            'trace-indicator',
            'customer-journey'
        );

        expect(result).toHaveProperty('already-up-to-date-mount-names');
        expect(result['already-up-to-date-mount-names']).toEqual(['CO18302']);
        expect(result).toHaveProperty('status', 'success');
    });

    test('all devices up-to-date -> should return 200 with all mount names', async () => {
        const body = {
            'mount-names': ['CO18302', 'CO18303']
        };

        const now = new Date();
        const fiveMinutesAgo = new Date(now - 5 * 60 * 1000).toISOString();

        const mwdiResponse = [
            {
                'mount-name': 'CO18302',
                'connection-status': 'connected',
                'last-successful-complete-control-construct-update-time': fiveMinutesAgo
            },
            {
                'mount-name': 'CO18303',
                'connection-status': 'connected',
                'last-successful-complete-control-construct-update-time': fiveMinutesAgo
            }
        ];

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mwdiResponse
        });

        const result = await initiatePmDataUpdate(
            body,
            'user',
            'originator',
            'x-correlator',
            'trace-indicator',
            'customer-journey'
        );

        expect(result).toHaveProperty('already-up-to-date-mount-names');
        expect(result['already-up-to-date-mount-names']).toHaveLength(2);
        expect(result['already-up-to-date-mount-names']).toContain('CO18302');
        expect(result['already-up-to-date-mount-names']).toContain('CO18303');
    });

    test('missing device -> should throw error 533', async () => {
        const body = {
            'mount-names': ['CO18302', 'CO18303']
        };

        const mwdiResponse = [
            {
                'mount-name': 'CO18302',
                'connection-status': 'connected'
            }
            // CO18303 is missing
        ];

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mwdiResponse
        });

        await expect(
            initiatePmDataUpdate(
                body,
                'user',
                'originator',
                'x-correlator',
                'trace-indicator',
                'customer-journey'
            )
        ).rejects.toMatchObject({
            code: 533,
            'missing-mount-names': ['CO18303']
        });
    });

    test('disconnected device -> should throw error 532', async () => {
        const body = {
            'mount-names': ['CO18302', 'CO18303']
        };

        const mwdiResponse = [
            {
                'mount-name': 'CO18302',
                'connection-status': 'connected'
            },
            {
                'mount-name': 'CO18303',
                'connection-status': 'disconnected'
            }
        ];

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mwdiResponse
        });

        await expect(
            initiatePmDataUpdate(
                body,
                'user',
                'originator',
                'x-correlator',
                'trace-indicator',
                'customer-journey'
            )
        ).rejects.toMatchObject({
            code: 532,
            'unconnected-mount-names': ['CO18303']
        });
    });

    test('should update only mounts whose last update was more than 15 minutes ago', async () => {
        const body = {
            'mount-names': ['CO18302', 'CO18303']
        };

        const tenMinutesAgo = new Date(
            Date.now() - 10 * 60 * 1000
        ).toISOString();

        const twentyMinutesAgo = new Date(
            Date.now() - 20 * 60 * 1000
        ).toISOString();

        const mwdiResponse = [
            {
                'mount-name': 'CO18302',
                'connection-status': 'connected',
                'last-successful-complete-control-construct-update-time':
                    tenMinutesAgo
            },
            {
                'mount-name': 'CO18303',
                'connection-status': 'connected',
                'last-successful-complete-control-construct-update-time':
                    twentyMinutesAgo
            }
        ];

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mwdiResponse
        });

        // Only CO18303 is outdated -> only one control-construct GET.
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({})
        });

        const result = await initiatePmDataUpdate(
            body,
            'user',
            'originator',
            'x-correlator',
            'trace-indicator',
            'customer-journey'
        );

        expect(result).toHaveProperty('status', 'success');
        expect(result).toHaveProperty(
            'already-up-to-date-mount-names',
            ['CO18302']
        );

        expect(mockFetch).toHaveBeenCalledTimes(2);

        expect(mockFetch).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('CO18303'),
            expect.objectContaining({
                method: 'GET'
            })
        );

        expect(mockFetch).not.toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('CO18302'),
            expect.anything()
        );
    });

    test('devices with no previous update time -> should be considered outdated', async () => {
        const body = {
            'mount-names': ['CO18302']
        };

        const mwdiResponse = [
            {
                'mount-name': 'CO18302',
                'connection-status': 'connected',
                'last-successful-complete-control-construct-update-time': null
            }
        ];

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mwdiResponse
        });
        // outdated (no previous update time) -> single control-construct GET (cache CC)
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

        const result = await initiatePmDataUpdate(
            body,
            'user',
            'originator',
            'x-correlator',
            'trace-indicator',
            'customer-journey'
        );

        expect(result).toHaveProperty('status', 'success');
        expect(result).not.toHaveProperty('already-up-to-date-mount-names');
    });

    test('device updated exactly 15 minutes ago -> should be considered outdated (boundary >= 15 min)', async () => {
        const body = {
            'mount-names': ['CO18302']
        };

        const now = new Date();
        const exactlyFifteenMinutesAgo = new Date(now - 15 * 60 * 1000).toISOString();

        const mwdiResponse = [
            {
                'mount-name': 'CO18302',
                'connection-status': 'connected',
                'last-successful-complete-control-construct-update-time': exactlyFifteenMinutesAgo
            }
        ];

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mwdiResponse
        });
        // exactly 15 minutes -> timeSinceLastUpdate is not < 15 min -> outdated -> single control-construct GET (cache CC)
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

        const result = await initiatePmDataUpdate(
            body,
            'user',
            'originator',
            'x-correlator',
            'trace-indicator',
            'customer-journey'
        );

        expect(result).toHaveProperty('status', 'success');
        expect(result).not.toHaveProperty('already-up-to-date-mount-names');
    });

    test('live CC returns 532 -> should throw error 532 with unconnected mount', async () => {
        const body = {
            'mount-names': ['CO18302']
        };

        // 1st call: MWDI provide-device-status-metadata (all connected, no last update -> outdated)
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => [
                {
                    'mount-name': 'CO18302',
                    'connection-status': 'connected',
                    'last-successful-complete-control-construct-update-time': null
                }
            ]
        });
        // 2nd call: live control-construct -> upstream not responding
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 532,
            json: async () => ({
                code: 532,
                message: 'Bad Gateway. Upstream server not responding.'
            })
        });

        await expect(
            initiatePmDataUpdate(
                body,
                'user',
                'originator',
                'x-correlator',
                'trace-indicator',
                'customer-journey'
            )
        ).rejects.toMatchObject({
            code: 532,
            message: 'Bad Gateway. Upstream server not responding.',
            'unconnected-mount-names': ['CO18302']
        });
    });

    test('live CC returns 502 -> should throw error 532 with unconnected mount', async () => {
        const body = {
            'mount-names': ['CO18302']
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => [
                {
                    'mount-name': 'CO18302',
                    'connection-status': 'connected',
                    'last-successful-complete-control-construct-update-time': null
                }
            ]
        });
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 502,
            json: async () => ({
                code: 502,
                message: 'Bad Gateway'
            })
        });

        await expect(
            initiatePmDataUpdate(
                body,
                'user',
                'originator',
                'x-correlator',
                'trace-indicator',
                'customer-journey'
            )
        ).rejects.toMatchObject({
            code: 532,
            'unconnected-mount-names': ['CO18302']
        });
    });

    test('live CC returns 533 -> should throw error 533 with missing mount', async () => {
        const body = {
            'mount-names': ['CO18302']
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => [
                {
                    'mount-name': 'CO18302',
                    'connection-status': 'connected',
                    'last-successful-complete-control-construct-update-time': null
                }
            ]
        });
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: async () => ({
                code: 533,
                message: 'Resource unknown. The resource for the connected device does not exist at the Controller'
            })
        });

        await expect(
            initiatePmDataUpdate(
                body,
                'user',
                'originator',
                'x-correlator',
                'trace-indicator',
                'customer-journey'
            )
        ).rejects.toMatchObject({
            code: 533,
            'missing-mount-names': ['CO18302']
        });
    });

    test('invalid input -> should throw error 400 with mountNames not provided', async () => {
        await expect(
            initiatePmDataUpdate(
                {},
                'user',
                'originator',
                'x-correlator',
                'trace-indicator',
                'customer-journey'
            )
        ).rejects.toMatchObject({
            code: 400,
            message: ERRORS.MOUNT_NAME_LIST_NOT_PROVIDED
        });

        // input validation short-circuits before contacting MWDI
        expect(mockFetch).not.toHaveBeenCalled();
    });

    test('invalid input -> should throw error 400 with mountNames invalid', async () => {
        await expect(
            initiatePmDataUpdate(
                { 'mount-names': [] },
                'user',
                'originator',
                'x-correlator',
                'trace-indicator',
                'customer-journey'
            )
        ).rejects.toMatchObject({
            code: 400,
            message: ERRORS.MOUNT_NAME_LIST_EMPTY
        });
    });
});


/////////////////////////////////////////////////////////////////
// Integration Tests
/////////////////////////////////////////////////////////////////


describe('Integration - documentPmDataProcessing with real config', () => {

    const realConfig = require('../database/config.json');
    const { loadFunctionParameters, getParamFromFunction: realGetParamFromFunction } =
        jest.requireActual('../utils/functionTree');

    let documentPmDataProcessingReal;
    let p1LoadParametersReal;
    let p1DocumentFunctionMock;
    let functionNameToDocument;
    let p1LoadParametersSpy;
    let previousDatabasePath;

    beforeAll(() => {
        previousDatabasePath = global.databasePath;
        global.databasePath = path.resolve(__dirname, '../database/config.json');

        // Svuota il registry: altrimenti isolateModules riusa i mock gia' creati in cima al file
        jest.resetModules();

        jest.isolateModules(() => {
            jest.doMock('../genericFunctions/p1LoadParameters/P1LoadParameters', () =>
                jest.requireActual('../genericFunctions/p1LoadParameters/P1LoadParameters')
            );
            jest.doMock('../utils/functionTree', () =>
                jest.requireActual('../utils/functionTree')
            );
            jest.doMock('../genericFunctions/p1DocumentFunction/P1DocumentFunction', () =>
                jest.fn()
            );

            p1LoadParametersReal = require('../genericFunctions/p1LoadParameters/P1LoadParameters');
            p1DocumentFunctionMock = require('../genericFunctions/p1DocumentFunction/P1DocumentFunction');
            ({ documentPmDataProcessing: documentPmDataProcessingReal } = require('./IndividualServicesService'));
        });
    });

    afterAll(() => {
        if (previousDatabasePath === undefined) {
            delete global.databasePath;
        } else {
            global.databasePath = previousDatabasePath;
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();

        const ownFunctionParameters = loadFunctionParameters(realConfig, 'documentPmDataProcessing');
        functionNameToDocument = realGetParamFromFunction(
            ownFunctionParameters,
            'documentPmDataProcessing',
            'nameOfToBeDocumentedFunction'
        );

        p1DocumentFunctionMock.mockReturnValue(`- ${functionNameToDocument}`);
        p1LoadParametersSpy = jest.spyOn(p1LoadParametersReal, 'run');
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

        const result = await documentPmDataProcessingReal(
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

        // p1DocumentFunction viene chiamata con la struttura corretta
        expect(p1DocumentFunctionMock).toHaveBeenCalledTimes(1);
        expect(p1DocumentFunctionMock).toHaveBeenCalledWith({
            'parameters-of-to-be-documented-function': expect.objectContaining({
                'function-name': functionNameToDocument,
                'is-active': true
            })
        });

        expect(result).toBe(`- ${functionNameToDocument}`);
    });
});