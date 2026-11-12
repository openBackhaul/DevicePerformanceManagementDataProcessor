const onfAdapter = require('../onf/onfAdapter');

function schemaError(index, incompatibleFields) {
  const error = new Error(
    'Incompatible DPMDP datastore mapping for "' + index + '": ' +
    incompatibleFields.join(', ') + '. Requires indexing disabled for stored bodies and _source retained. ' +
    'Existing index was not changed; use a compatible datastore or plan a migration/fresh start.'
  );
  error.stage = 'storageOptimization';
  error.reason = 'DATASTORE_MAPPING_INCOMPATIBLE';
  error.retryable = false;
  error.details = { index, incompatibleFields };
  return error;
}

// Validate existing data without mutating mappings or deleting indexes.
async function prepareStorage(config, service, logger) {
  const client = await onfAdapter.getEsClient(false, config.uuid, config, logger);
  const mappings = (await client.indices.getMapping({ index: config['index-alias'] })).body;
  if (!mappings || !Object.keys(mappings).length) {
    throw schemaError(config['index-alias'], ['mapping missing']);
  }
  for (const [index, value] of Object.entries(mappings)) {
    const mapping = value.mappings;
    const fields = {
      payload: mapping?.properties?.payload,
      'batch.resultCc': mapping?.properties?.batch?.properties?.resultCc,
      'processing-data': mapping?.properties?.['processing-data'],
      'result-data.result-cc': mapping?.properties?.['result-data']?.properties?.['result-cc']
    };
    const incompatible = Object.entries(fields)
      .filter(([, field]) => field?.enabled !== false)
      .map(([name]) => name + '.enabled must be false');
    if (mapping?._source?.enabled === false) incompatible.push('_source must be enabled');
    if (incompatible.length) throw schemaError(index, incompatible);
  }
}
module.exports = { prepareStorage };
