jest.mock("perf_hooks", () => ({ performance: { now: () => Date.now() } }));
jest.mock("../infra/redis/redisClient", () => ({ getRedisClient: jest.fn() }));

describe("combined processing evidence", () => {
  let timing, events, pipeline, log;
  beforeEach(() => {
    jest.resetModules(); jest.useFakeTimers(); jest.setSystemTime(1000000);
    timing = require("./combinedProcessingTiming");
    events = [];
    pipeline = { eval: jest.fn((script, args) => events.push({script,...args})), execAsPipeline: jest.fn().mockResolvedValue([]) };
    require("../infra/redis/redisClient").getRedisClient.mockResolvedValue({multi: () => pipeline});
    log = {warn: jest.fn()};
    timing.configure({combinedStreamEnabled:true,flushIntervalMs:60000},log);
  });
  afterEach(() => { timing.configure({enabled:false}); jest.useRealTimers(); });
  const message = {id:"1-0",message:{mountName:"same-device"}};
  test("tracks repeated mounts as independent attempts without changing a p1 request", async () => {
    const first = timing.start(message), second = timing.start(message);
    expect(first.updateId).not.toBe(second.updateId);
    await Promise.all([first,second].map(state => timing.run(state, async () => {
      await Promise.resolve();
      for (const targetConsumer of ['APT','MYCOM','NETEXPLORER']) {
        const meta = timing.attach({messageType:'PERFORMANCE_OUTPUT',targetConsumer});
        expect(meta.processingUpdateId).toBe(state.updateId);
      }
      expect(timing.attach({messageType:'DATA_QUALITY'})).toEqual({});
    })));
    expect(first.expected).toHaveLength(3);
    expect(second.expected).toHaveLength(3);
    expect(timing.attach({messageType:'PERFORMANCE_OUTPUT'})).toEqual({});
    jest.setSystemTime(1001200);
    timing.completeDevice(first); timing.completeDevice(second);
    await timing.flush();
    expect(events).toHaveLength(2);
    expect(JSON.parse(events[0].arguments[0]).seconds).toBe(1.2);
    expect(events[0].keys[0]).not.toBe(events[1].keys[0]);
  });
  test("Kafka excludes queue age; early Kafka completion and device completion share tracking key", async () => {
    const state = timing.start(message);
    const meta = timing.run(state, () => timing.attach({messageType:'PERFORMANCE_OUTPUT'}));
    const outbound = {id:'1-2',message:{...meta,targetConsumer:'APT'}};
    jest.setSystemTime(1010000); // ten seconds waiting is not part of Kafka timing
    const clock = Date.now();
    jest.setSystemTime(1011500);
    timing.completeKafka(outbound,{clock},true);
    timing.completeDevice(state);
    await timing.flush();
    expect(events[0].keys).toEqual(events[1].keys);
    expect(JSON.parse(events[0].arguments[0]).seconds).toBe(1.5);
    expect(JSON.parse(events[1].arguments[0]).expected).toEqual([meta.processingPartId]);
  });
  test("no acknowledgement, legacy messages and untracked attempts cannot complete a total", async () => {
    const state=timing.start(message);
    const meta=timing.run(state,()=>timing.attach({messageType:'PERFORMANCE_OUTPUT'}));
    timing.completeKafka({id:'1',message:meta},{clock:Date.now()},false);
    timing.completeKafka(message,{clock:Date.now()},true);
    timing.completeDevice(timing.start(message));
    await timing.flush();
    expect(events).toHaveLength(0);
  });
  test("bounded evidence buffer and failures cannot throw into processing", async () => {
    timing.configure({combinedStreamEnabled:true,bufferMaxEntries:1},log);
    const state=timing.start(message);
    timing.run(state,()=>timing.attach({messageType:'PERFORMANCE_OUTPUT'}));
    timing.completeDevice(state); timing.completeDevice(state);
    expect(timing._test.stats()).toEqual({buffered:1,dropped:1});
    pipeline.execAsPipeline.mockRejectedValue(new Error('offline'));
    await expect(timing.flush()).resolves.toBeUndefined();
    expect(timing._test.stats().dropped).toBe(2);
    expect(log.warn).toHaveBeenCalled();
  });
  test("opt-out and success evidence switch are independent", () => {
    timing.configure({combinedStreamEnabled:false,kafkaSuccessStreamEnabled:false});
    expect(timing.start(message)).toBeNull();
    expect(timing.successStreamEnabled()).toBe(false);
    timing.configure({combinedStreamEnabled:true});
    expect(timing.successStreamEnabled()).toBe(true);
  });
});
