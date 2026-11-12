const crypto = require('crypto');
const { getRedisClient } = require('../../infra/redis/redisClient');
const onfAdapter = require('../../infra/onf/onfAdapter');
const { sleep } = require('../../utils/retry');
const KEY = 'dpmdp:kafka-payload-cleanup';
const LOCK = `${KEY}:lock`;
// Validate types before mutation. Record cleanup BEFORE acknowledgement: if Redis
// fails, retaining a reference is preferable to losing a required cleanup job.
const HANDOFF = `
local t = redis.call('TYPE', KEYS[2]).ok
if t ~= 'none' and t ~= 'zset' then return redis.error_reply('cleanup key must be zset') end
local p = redis.call('XPENDING', KEYS[1], ARGV[1], ARGV[2], ARGV[2], 1)
if #p == 0 or p[1][2] ~= ARGV[3] then return 0 end
redis.call('ZADD', KEYS[2], 'NX', ARGV[4], ARGV[5])
local n = redis.call('XACK', KEYS[1], ARGV[1], ARGV[2])
if n == 1 then redis.call('XDEL', KEYS[1], ARGV[2]) end
return n`;
async function handoff(msg, context) {
  const fields = msg.message;
  const redis = await getRedisClient(context.logger);
  return Number(await redis.eval(HANDOFF, {
    keys: ['dpmdp:stream:kafka-outbound', KEY],
    arguments: ['dpmdp:group:kafka-outbound', msg.id, context.consumerName, String(Date.now()),
      JSON.stringify({ index: context.dataStoreEsClient['index-alias'], id: fields.payloadRefId, messageId: msg.id })]
  }));
}
async function isBacklogged(context) {
  const redis = await getRedisClient(context.logger);
  return await redis.zCard(KEY) >= context.cleanupMaxBacklog;
}
async function cleanupBatch(context) {
  const redis = await getRedisClient(context.logger);
  const token = crypto.randomUUID();
  if (await redis.set(LOCK, token, { NX: true, PX: 120000 }) !== 'OK') return;
  try {
    const jobs = await redis.zRangeByScore(KEY, 0, Date.now(), { LIMIT: { offset: 0, count: context.cleanupBatchSize } });
    if (!jobs.length) return;
    const refs = jobs.map(job => JSON.parse(job));
    // A Redis script runtime error does not roll back earlier writes. Never
    // delete a body if a partially completed handoff left its outbound entry.
    const eligible = [];
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      if (typeof ref.index !== 'string' || typeof ref.id !== 'string' || typeof ref.messageId !== 'string') {
        context.logger.error({ job: jobs[i] }, 'Invalid cleanup reference; retained for operator review');
        await redis.zAdd(KEY, [{ score: Date.now() + 60000, value: jobs[i] }], { XX: true });
        continue;
      }
      const entries = await redis.xRange('dpmdp:stream:kafka-outbound', ref.messageId, ref.messageId);
      if (entries.length) {
        await redis.zAdd(KEY, [{ score: Date.now() + 60000, value: jobs[i] }], { XX: true });
      } else eligible.push(i);
    }
    if (!eligible.length) return;
    const client = await onfAdapter.getEsClient(false, context.dataStoreEsClient.uuid, context.dataStoreEsClient, context.logger);
    const result = await client.bulk({ refresh: false, body: eligible.map(i => ({ delete: { _index: refs[i].index, _id: refs[i].id } })) }, { requestTimeout: 30000 });
    const items = result.body?.items;
    if (!Array.isArray(items) || items.length !== eligible.length) throw new Error('Invalid ES cleanup bulk response');
    for (let j = 0; j < eligible.length; j++) {
      const i = eligible[j];
      const item = items[j].delete;
      if (item && (item.status === 200 || (item.status === 404 && item.result === 'not_found'))) {
        await redis.zRem(KEY, jobs[i]);
      } else {
        // Retain failures, including permissions/missing-index errors, for recovery.
        await redis.zAdd(KEY, [{ score: Date.now() + 60000, value: jobs[i] }], { XX: true });
        context.logger.error({ payloadRefId: refs[i].id, status: item?.status, error: item?.error }, 'Kafka cleanup failed; reference retained');
      }
    }
    context.logger.info({ count: jobs.length, remaining: await redis.zCard(KEY) }, 'Kafka payload cleanup batch completed');
  } finally {
    await redis.eval("if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0", { keys: [LOCK], arguments: [token] });
  }
}
async function start(context) {
  while (!context.appState.isShuttingDown) {
    let delay = 1000;
    try { await cleanupBatch(context); }
    catch (error) { delay = 10000; context.logger.error({ error: error.message }, 'Kafka cleanup retry; durable references retained'); }
    await sleep(delay);
  }
}
module.exports = { handoff, isBacklogged, start, cleanupBatch, KEY, HANDOFF };
