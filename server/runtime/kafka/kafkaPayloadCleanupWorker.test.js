jest.mock('../../infra/redis/redisClient', () => ({ getRedisClient: jest.fn() }));
jest.mock('../../infra/onf/onfAdapter', () => ({ getEsClient: jest.fn() }));
const { getRedisClient } = require('../../infra/redis/redisClient');
const adapter = require('../../infra/onf/onfAdapter');
const cleanup = require('./kafkaPayloadCleanupWorker');
let redis, client, context;
const job = id => JSON.stringify({ index: 'payloads', id, messageId: `${id}-0` });
beforeEach(() => {
  redis = { set: jest.fn().mockResolvedValue('OK'), eval: jest.fn().mockResolvedValue(1),
    zRangeByScore: jest.fn().mockResolvedValue([job('1'), job('2')]), zRem: jest.fn(), zAdd: jest.fn(),
    zCard: jest.fn().mockResolvedValue(2), xRange: jest.fn().mockResolvedValue([]) };
  client = { bulk: jest.fn().mockResolvedValue({ body: { items: [{ delete: { status: 200 } }, { delete: { status: 404, result: 'not_found' } }] } }) };
  getRedisClient.mockResolvedValue(redis); adapter.getEsClient.mockResolvedValue(client);
  context = { dataStoreEsClient: { uuid: 'es', 'index-alias': 'legacy' }, cleanupBatchSize: 100, cleanupMaxBacklog: 2,
    consumerName: 'worker', logger: { info: jest.fn(), error: jest.fn() } };
});
test('bulk deletes successful jobs and treats absent documents idempotently', async () => {
  await cleanup.cleanupBatch(context);
  expect(client.bulk.mock.calls[0][0].body).toHaveLength(2);
  expect(redis.zRem).toHaveBeenCalledTimes(2);
});
test('partial failure retains and delays only failed cleanup', async () => {
  client.bulk.mockResolvedValue({ body: { items: [{ delete: { status: 200 } }, { delete: { status: 429 } }] } });
  await cleanup.cleanupBatch(context);
  expect(redis.zRem).toHaveBeenCalledTimes(1);
  expect(redis.zAdd.mock.calls[0][1][0].value).toBe(job('2'));
});
test('transport failure retains all durable jobs and releases lock', async () => {
  client.bulk.mockRejectedValue(new Error('timeout'));
  await expect(cleanup.cleanupBatch(context)).rejects.toThrow('timeout');
  expect(redis.zRem).not.toHaveBeenCalled(); expect(redis.eval).toHaveBeenCalled();
});
test('does not clean an outbound entry left by an incomplete handoff', async () => {
  redis.xRange.mockResolvedValue([{}]);
  await cleanup.cleanupBatch(context);
  expect(client.bulk).not.toHaveBeenCalled(); expect(redis.zRem).not.toHaveBeenCalled();
});
test('backpressure and legacy index handoff', async () => {
  expect(await cleanup.isBacklogged(context)).toBe(true);
  await cleanup.handoff({ id: '1-0', message: { payloadRefId: 'p' } }, context);
  expect(JSON.parse(redis.eval.mock.calls[0][1].arguments[4])).toEqual({ index: 'legacy', id: 'p', messageId: '1-0' });
});
