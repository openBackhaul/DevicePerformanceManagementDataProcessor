jest.mock('../../infra/redis/redisClient',()=>({getRedisClient:jest.fn()}));
jest.mock('../../infra/onf/onfAdapter',()=>({getEsClient:jest.fn()}));
jest.mock('../../infra/redis/redisStreamQueue',()=>({ensureGroup:jest.fn(),enqueueMountNames:jest.fn()}));
const {run,readMode,CHECKPOINT}=require('./directMwdiDiscovery');
const redisModule=require('../../infra/redis/redisClient');
const adapter=require('../../infra/onf/onfAdapter');
const queue=require('../../infra/redis/redisStreamQueue');
describe('direct MWDI discovery',()=>{
 let redis,client,request;
 beforeEach(()=>{
  jest.clearAllMocks();jest.spyOn(Date,'now').mockReturnValue(Date.parse('2026-09-27T12:00:00Z'));
  redis={get:jest.fn().mockResolvedValue(null),set:jest.fn().mockResolvedValue('OK')};
  client={search:jest.fn().mockResolvedValue({body:{_scroll_id:'s1',hits:{hits:[{_id:'a'},{_id:'b'}]}}}),
   scroll:jest.fn().mockResolvedValue({body:{_scroll_id:'s2',hits:{hits:[]}}}),clearScroll:jest.fn().mockResolvedValue({})};
  redisModule.getRedisClient.mockResolvedValue(redis);adapter.getEsClient.mockResolvedValue(client);
  queue.enqueueMountNames.mockResolvedValue({enqueued:2,skipped:0,failed:0});
  request={mwdiEsClient:{uuid:'source', 'index-alias':'mwdi'},runtimeConfig:{},logger:{info:jest.fn(),warn:jest.fn()}};
 });
 afterEach(()=>jest.restoreAllMocks());
 test('default stays replica and invalid mode fails',()=>{
  expect(readMode()).toBe('replica');expect(readMode({service:{mwdiReadMode:'direct'}})).toBe('direct');
  expect(()=>readMode({service:{mwdiReadMode:'typo'}})).toThrow();
 });
 test('IDs only, paginated search, source client and independent checkpoint',async()=>{
  const result=await run(request);
  expect(result.updatedMountNames).toEqual(['a','b']);
  expect(client.search.mock.calls[0][0]).toMatchObject({index:'mwdi',body:{_source:false}});
  expect(result.timestamp).toBe('2026-09-27T11:59:50.000Z');
  expect(redis.set).toHaveBeenCalledWith(CHECKPOINT,JSON.stringify({source:'source:mwdi',timestamp:result.timestamp}));
  expect(client.clearScroll).toHaveBeenCalledWith({scroll_id:'s2'});
  expect(queue.enqueueMountNames.mock.invocationCallOrder[0]).toBeLessThan(redis.set.mock.invocationCallOrder[0]);
 });
 test('restart resumes old direct checkpoint without a catch-up cap',async()=>{
  redis.get.mockImplementation(async key=>key===CHECKPOINT?JSON.stringify({source:'source:mwdi',timestamp:'2026-09-26T12:00:00Z'}):null);
  await run(request);
  expect(client.search.mock.calls[0][0].body.query.bool.filter[1].range['last-complete-control-construct-update-time'].gt).toBe('2026-09-26T11:59:00.000Z');
 });
 test.each(['scroll','partial','enqueue','persist'])('fails safely on %s failure',async stage=>{
  if(stage==='scroll')client.scroll.mockRejectedValue(new Error('offline'));
  if(stage==='partial')client.search.mockResolvedValue({body:{_scroll_id:'s1',timed_out:true,hits:{hits:[]}}});
  if(stage==='enqueue')queue.enqueueMountNames.mockResolvedValue({enqueued:1,skipped:0,failed:1});
  if(stage==='persist')redis.set.mockRejectedValue(new Error('offline'));
  await expect(run(request)).rejects.toThrow();
  if(stage!=='persist')expect(redis.set).not.toHaveBeenCalled();
  expect(client.clearScroll).toHaveBeenCalled();
 });
 test('active reindex blocks direct scan without clearing its state',async()=>{
  redis.get.mockResolvedValue('active');await expect(run(request)).rejects.toThrow('Finish the active replica');
  expect(client.search).not.toHaveBeenCalled();expect(redis.set).not.toHaveBeenCalled();
 });
 test('changed source cannot reuse a checkpoint',async()=>{
  redis.get.mockImplementation(async key=>key===CHECKPOINT?JSON.stringify({source:'other',timestamp:'2026-09-26T12:00:00Z'}):null);
  await expect(run(request)).rejects.toThrow('source mismatch');expect(client.search).not.toHaveBeenCalled();
 });
 test('empty result advances checkpoint without inventing mount names',async()=>{
  client.search.mockResolvedValue({body:{hits:{hits:[]}}});queue.enqueueMountNames.mockResolvedValue({enqueued:0,skipped:0,failed:0});
  expect((await run(request)).updatedMountNames).toEqual([]);expect(redis.set).toHaveBeenCalled();
 });
});
