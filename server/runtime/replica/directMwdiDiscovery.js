// Optional runtime experiment. Does not copy or modify the MWDI source index.
const { getRedisClient } = require('../../infra/redis/redisClient');
const onfAdapter = require('../../infra/onf/onfAdapter');
const queue = require('../../infra/redis/redisStreamQueue');
const { getParamFromFunction } = require('../../utils/functionTree');
const CHECKPOINT = 'dpmdp:direct-mwdi:checkpoint';
const ACTIVE_REINDEX = 'dpmdp:replica:active-reindex-task';

function readMode(config = {}) {
  const mode = config.service?.mwdiReadMode ?? 'replica';
  if (!['replica', 'direct'].includes(mode)) throw new Error('mwdiReadMode must be replica or direct');
  return mode;
}
function numberSetting(service, name, fallback, minimum = 0) {
  const value = Number(service[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`Invalid ${name}`);
  return value;
}
async function run({ mwdiEsClient, runtimeConfig = {}, parameters, logger }) {
  const redis = await getRedisClient(logger);
  if (await redis.get(ACTIVE_REINDEX)) {
    throw new Error('Finish the active replica task before enabling direct MWDI mode; do not delete its state');
  }
  const service = runtimeConfig.service || {};
  const initial = numberSetting(service, 'directMwdiInitialLookbackMs', 480000, 1);
  const delay = numberSetting(service, 'directMwdiSafetyDelayMs', 10000);
  const overlap = numberSetting(service, 'directMwdiOverlapMs', 60000);
  const pageSize = numberSetting(service, 'directMwdiPageSize', 500, 1);
  const source = `${mwdiEsClient.uuid}:${mwdiEsClient['index-alias']}`;
  const saved = await redis.get(CHECKPOINT);
  const state = saved ? JSON.parse(saved) : null;
  if (state && (state.source !== source || !Number.isFinite(Date.parse(state.timestamp)))) {
    throw new Error('Direct MWDI checkpoint source mismatch or invalid timestamp');
  }
  const end = Date.now() - delay;
  const previous = state ? Date.parse(state.timestamp) : null;
  if (previous !== null && previous > end) throw new Error('Direct MWDI checkpoint is ahead of the safe query end');
  // Never silently discard older unread windows after downtime in this mode.
  const start = previous === null ? end - initial : previous - overlap;
  const periodStartTime = new Date(start).toISOString();
  const periodEndTime = new Date(end).toISOString();
  const field = getParamFromFunction(parameters, 'p1UpdateMwdiReplica',
    'lastUpdatedField', 'last-complete-control-construct-update-time');
  const client = await onfAdapter.getEsClient(false, mwdiEsClient.uuid, mwdiEsClient, logger);
  const names = new Set();
  let scrollId;
  const started = Date.now();
  try {
    let response = await client.search({
      index: mwdiEsClient['index-alias'], scroll: '2m', size: pageSize,
      body: { _source: false, sort: ['_doc'], query: { bool: { filter: [
        { exists: { field: 'core-model-1-4:control-construct' } },
        { range: { [field]: { gt: periodStartTime, lte: periodEndTime } } }
      ] } } }
    });
    while (true) {
      const body = response.body || response;
      scrollId = body._scroll_id || scrollId;
      if (body.timed_out || Number(body._shards?.failed || 0) > 0) throw new Error('Incomplete direct MWDI search');
      if (!Array.isArray(body.hits?.hits)) throw new Error('Invalid direct MWDI search response');
      const hits = body.hits.hits;
      for (const hit of hits) {
        if (typeof hit._id !== 'string' || !hit._id) throw new Error('MWDI hit has no mount-name document ID');
        names.add(hit._id);
      }
      if (!hits.length) break;
      if (!scrollId) throw new Error('Direct MWDI search returned hits without a scroll ID');
      response = await client.scroll({ scroll_id: scrollId, scroll: '2m' });
    }
  } finally {
    if (scrollId) await client.clearScroll({scroll_id: scrollId}).catch(error =>
      logger?.warn?.({error: error.message}, 'Failed to clear direct MWDI scroll'));
  }
  const updatedMountNames = [...names];
  await queue.ensureGroup(logger);
  const result = await queue.enqueueMountNames(updatedMountNames, {
    batchSize: runtimeConfig.redis?.enqueueBatchSize || 500,
    pauseMs: runtimeConfig.redis?.enqueuePauseMs ?? 50,
    clearRetryAndDeadLetterBeforeEnqueue: false,
    resetRetryEligibilityBeforeEnqueue: true
  }, logger);
  if (!result || result.failed > 0 || result.enqueued + result.skipped !== names.size) {
    throw new Error('Direct MWDI enqueue incomplete; checkpoint not advanced');
  }
  // Redis errors propagate: retry the same window instead of losing updates.
  await redis.set(CHECKPOINT, JSON.stringify({source, timestamp: periodEndTime}));
  logger?.info?.({label:'directMwdiDiscovery.completed', mode:'direct',
    periodStartTime, periodEndTime, mountNameCount:names.size,
    durationMs:Date.now()-started, ...result}, 'Direct MWDI discovery completed (no reindex)');
  return {updatedMountNames, timestamp:periodEndTime};
}
module.exports = {run, readMode, CHECKPOINT};
