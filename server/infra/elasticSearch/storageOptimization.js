const onfAdapter = require('../onf/onfAdapter');

// Fresh-start schema: validate, never delete or silently modify existing data.
async function prepareStorage(config, service, logger) {
  const client = await onfAdapter.getEsClient(false, config.uuid, config, logger);
  const mappings = (await client.indices.getMapping({ index: config['index-alias'] })).body;
  if (!mappings || !Object.keys(mappings).length) throw new Error('DPMDP datastore mapping is missing');
  for (const value of Object.values(mappings)) {
    const mapping = value.mappings;
    if (mapping?._source?.enabled === false ||
        mapping?.properties?.payload?.enabled !== false ||
        mapping?.properties?.batch?.properties?.resultCc?.enabled !== false) {
      throw new Error('Fresh-start DPMDP datastore requires payload.enabled=false and batch.resultCc.enabled=false with _source retained. Existing index was not changed.');
    }
  }
}
module.exports = { prepareStorage };
