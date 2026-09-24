jest.mock('perf_hooks',()=>({performance:{now:()=>Date.now()}}));
jest.mock('../infra/redis/redisClient',()=>({getRedisClient:jest.fn()}));
describe('p1 function diagnostics',()=>{
  let timing,rows,batch;
  beforeEach(()=>{
    jest.resetModules();jest.useFakeTimers();jest.setSystemTime(100000);
    timing=require('./p1FunctionTiming');rows=[];
    batch={xAdd:jest.fn((key,id,fields)=>rows.push(fields)),execAsPipeline:jest.fn().mockResolvedValue([])};
    require('../infra/redis/redisClient').getRedisClient.mockResolvedValue({multi:()=>batch});
    timing.configure({p1DiagnosticsEnabled:true,flushIntervalMs:60000});
  });
  afterEach(()=>{timing.configure({enabled:false});jest.useRealTimers();});
  const msg={id:'1-0',message:{mountName:'cc'}};
  test('aggregates synchronous slice calls and preserves inclusive parent totals',async()=>{
    const slice=timing.wrap('p1IterateAiPmSlices',input=>{jest.setSystemTime(Date.now()+10);return input;});
    const parent=timing.wrap('p1CreateResultCc',()=>{
      for(let i=0;i<4;i++) slice({'historical-performance-data-list':[{},{}]});
      jest.setSystemTime(Date.now()+5);return {ok:true};
    });
    await timing.device(msg,{updateId:'shared'},()=>expect(parent()).toEqual({ok:true}));
    await timing.flush();
    expect(rows).toHaveLength(1);expect(rows[0].updateId).toBe('shared');
    const f=JSON.parse(rows[0].functions);
    expect(f.find(x=>x.functionName==='p1IterateAiPmSlices')).toMatchObject({callCount:4,inputSliceCount:8,successfulOutputSliceCount:8,totalSeconds:.04,parentFunction:'p1CreateResultCc'});
    expect(f.find(x=>x.functionName==='p1CreateResultCc').totalSeconds).toBe(.045);
  });
  test('records returned error strings and preserves thrown error identity',async()=>{
    const error=new Error('service unavailable');
    const returned=timing.wrap('p1FormattingOutputApt',()=> 'bad input');
    const thrown=timing.wrap('p1Storing',async()=>{throw error;});
    await expect(timing.device(msg,null,()=>{expect(returned()).toBe('bad input');return thrown();})).rejects.toBe(error);
    await timing.flush();expect(rows[0].outcome).toBe('FAILED');
    expect(JSON.parse(rows[0].functions).map(f=>f.failedCalls)).toEqual([1,1]);
  });
  test('parallel updates do not mix contexts; no state or rows when disabled/sampled out',async()=>{
    const fn=timing.wrap('p1LoadRawCc',async()=>{await Promise.resolve();return timing.metadata();});
    const result=await Promise.all(['a','b'].map(updateId=>timing.device(msg,{updateId},fn)));
    expect(result).toEqual([{functionTimingUpdateId:'a'},{functionTimingUpdateId:'b'}]);
    await timing.flush();expect(rows.map(r=>r.updateId).sort()).toEqual(['a','b']);
    timing.configure({p1DiagnosticsEnabled:true,p1DiagnosticsSampleRate:0});
    expect(await timing.device(msg,null,fn)).toEqual({});
    timing.configure({enabled:false});expect(await fn()).toEqual({});
  });
  test('Kafka shares send-call timing and carries exact originating update ID',async()=>{
    const send=timing.wrap('p1TransmittingKafka',async()=>{jest.setSystemTime(Date.now()+25);return {ok:true};});
    const messages=['a','b'].map((id)=>({id,message:{functionTimingUpdateId:id,mountName:'cc',targetConsumer:'APT'}}));
    await timing.kafka(messages,send);await timing.flush();
    expect(rows).toHaveLength(2);expect(rows[0].sharedSendCallId).toBe(rows[1].sharedSendCallId);
    expect(rows[0].updateId).toBe('a');expect(rows[1].updateId).toBe('b');
    expect(JSON.parse(rows[0].functions)[0]).toMatchObject({functionName:'p1TransmittingKafka',totalSeconds:.025});
  });
  test('buffer is bounded and Redis failures are best effort',async()=>{
    timing.configure({p1DiagnosticsEnabled:true,bufferMaxEntries:1});
    const fn=timing.wrap('p1Storing',()=>42);
    await timing.device(msg,null,fn);await timing.device(msg,null,fn);
    expect(timing._test.stats()).toEqual({buffered:1,dropped:1});
    batch.execAsPipeline.mockRejectedValue(new Error('Redis down'));
    await expect(timing.flush()).resolves.toBeUndefined();
    expect(timing._test.stats().dropped).toBe(2);
  });
  test('fetch timings are submeasurements and returned results are unchanged',async()=>{
    const fetch=timing.wrap('p1LoadRawCc.replicaFetch',async()=>{jest.setSystemTime(Date.now()+50);return {data:1};});
    const load=timing.wrap('p1LoadRawCc',async()=>{const r=await fetch();jest.setSystemTime(Date.now()+20);return r;});
    expect(await timing.device(msg,null,load)).toEqual({data:1});await timing.flush();
    expect(JSON.parse(rows[0].functions)).toEqual(expect.arrayContaining([
      expect.objectContaining({functionName:'p1LoadRawCc.replicaFetch',totalSeconds:.05,parentFunction:'p1LoadRawCc'}),
      expect.objectContaining({functionName:'p1LoadRawCc',totalSeconds:.07})]));
  });
});
