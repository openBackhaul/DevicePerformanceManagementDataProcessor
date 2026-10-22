jest.mock('../onf/onfAdapter', () => ({ getEsClient: jest.fn() }));
const adapter = require('../onf/onfAdapter');
const { prepareStorage } = require('./storageOptimization');
const { ensureIndicesAndMappings } = require('./esBootstrap');
const store = require('./kafkaPayloadStore');
let client;
beforeEach(() => {
  client = { indices: { exists: jest.fn().mockResolvedValue({ body: false }), create: jest.fn().mockResolvedValue({}),
    getMapping: jest.fn().mockResolvedValue({ body: { ds: { mappings: { properties: {
      payload: { type: 'object', enabled: false }, batch: { properties: { resultCc: { type: 'object', enabled: false } } }
    } } } } }) },
    index: jest.fn().mockResolvedValue({}), get: jest.fn().mockResolvedValue({ body: { _source: { payload: { a: 1 } } } }),
    delete: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}) };
  adapter.getEsClient.mockResolvedValue(client);
});
test('fresh datastore disables both object bodies and retains processing metadata', async () => {
  const config = { uuid: 'es', 'index-alias': 'ds' };
  await ensureIndicesAndMappings({ mwdiReplicaEsClient: config, loggingEsClient: config, dataStoreEsClient: config }, {});
  const mapping = client.indices.create.mock.calls[2][0].body.mappings;
  expect(mapping.properties.payload).toEqual({ type: 'object', enabled: false });
  expect(mapping.properties.batch.properties.resultCc).toEqual({ type: 'object', enabled: false });
  expect(mapping.properties['interface-metadata-list']).toBeDefined();
  await expect(prepareStorage(config, {})).resolves.toBeUndefined();
});
test('payload writes, reads, evidence and cleanup all use the same datastore', async () => {
  const request = { dataStoreEsClient: { uuid: 'es', 'index-alias': 'ds' }, payloadRefId: 'p', payload: { a: 1 } };
  await store.storeKafkaPayload(request);
  expect(await store.loadKafkaPayload(request)).toEqual({ a: 1 });
  await store.markKafkaPayloadAsOversizedEvidence(request);
  await store.deleteKafkaPayload(request);
  for (const operation of ['index', 'get', 'update', 'delete']) expect(client[operation].mock.calls[0][0].index).toBe('ds');
});
test.each(['payload', 'resultCc', 'source', 'empty'])('rejects incompatible %s mapping without changing data', async kind => {
  const body = { ds: { mappings: { properties: { payload: { enabled: false }, batch: { properties: { resultCc: { enabled: false } } } } } } };
  if (kind === 'payload') body.ds.mappings.properties.payload = { type: 'object' };
  if (kind === 'resultCc') body.ds.mappings.properties.batch.properties.resultCc = { type: 'object' };
  if (kind === 'source') body.ds.mappings._source = { enabled: false };
  client.indices.getMapping.mockResolvedValue({ body: kind === 'empty' ? {} : body });
  await expect(prepareStorage({ 'index-alias': 'ds' }, {})).rejects.toThrow();
  expect(client.indices.create).not.toHaveBeenCalled();
});
