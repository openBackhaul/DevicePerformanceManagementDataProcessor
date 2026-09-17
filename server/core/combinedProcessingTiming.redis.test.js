// Opt-in only: use a disposable LOCAL test Redis, never a production URL.
const url = process.env.COMBINED_TIMING_TEST_REDIS_URL;
const run = url ? test : test.skip;
run('real Redis join handles reordering, duplicates, missing topics and expiration', async () => {
  const {createClient} = require('redis');
  const {randomUUID} = require('crypto');
  const {JOIN} = require('./combinedProcessingTiming')._test;
  const redis = createClient({url});
  const prefix = `test:combined:${randomUUID()}`;
  const keys = [prefix+':state',prefix+':summary',prefix+':details'];
  redis.on('error',()=>{});
  await redis.connect();
  const expires = Math.floor(Date.now()/1000)+120;
  const send = e => redis.eval(JOIN,{keys,arguments:[JSON.stringify(e),String(expires),'100']});
  try {
    const d={part:'device',mountName:'cc',updateId:'update',sourceId:'1-0',seconds:1.2,expected:['a','b','c']};
    expect(await send({part:'a',seconds:1,targetConsumer:'APT'})).toBe(0);
    expect(await send(d)).toBe(0);
    expect(await send({part:'b',seconds:1.4,targetConsumer:'MYCOM'})).toBe(0);
    expect(await redis.xLen(keys[1])).toBe(0);
    expect(await send({part:'c',seconds:1.5,targetConsumer:'NETEXPLORER'})).toBe(1);
    expect(await send(d)).toBe(0);
    expect(await send({part:'a',seconds:99})).toBe(0);
    const rows=await redis.xRange(keys[1],'-','+');
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toEqual({mountName:'cc',combinedProcessingSeconds:'5.100'});
    expect((await redis.xRange(keys[2],'-','+'))[0].id).toBe(rows[0].id);
    expect(await redis.ttl(keys[0])).toBeGreaterThan(0);
    await redis.del(keys[0]);
    expect(await redis.eval(JOIN,{keys,arguments:[JSON.stringify(d),'1','100']})).toBe(0);
    expect(await redis.exists(keys[0])).toBe(0);
  } finally { await redis.del(keys); await redis.quit(); }
},15000);
