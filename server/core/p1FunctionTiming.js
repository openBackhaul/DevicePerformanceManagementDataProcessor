// Bounded diagnostic evidence only. Never serializes CC payloads or changes p1 contracts.
const { AsyncLocalStorage } = require('async_hooks');
const { performance } = require('perf_hooks');
const { randomUUID } = require('crypto');
const store = new AsyncLocalStorage();
const STREAM = 'dpmdp:stream:p1-function-timing';
const parents = {
  p1LoadRawCc: '', p1CreateResultCc: '', p1FormattingOutputApt: '',
  p1FormattingOutputOnf: '', p1Storing: '', p1TransmittingKafka: '',
  p1IterateAiPmSlices: 'p1CreateResultCc', p1IterateEcPmSlices: 'p1CreateResultCc',
  'p1LoadRawCc.replicaFetch': 'p1LoadRawCc',
  'p1LoadRawCc.metadataFetch': 'p1LoadRawCc'
};
let options = {enabled:false}, buffer=[], timer, flushing=false, dropped=0, logger;
function configure(config={}, log) {
  const positive=(v,d)=>Number.isInteger(Number(v)) && Number(v)>0 ? Number(v) : d;
  options={enabled:config.enabled!==false && config.p1DiagnosticsEnabled===true,
    sampleRate: Number.isFinite(Number(config.p1DiagnosticsSampleRate)) ? Math.min(1,Math.max(0,Number(config.p1DiagnosticsSampleRate))) : 1,
    maxBuffer:positive(config.bufferMaxEntries,2000),maxLen:positive(config.streamMaxLen,200000)};
  logger=log; clearInterval(timer);
  if(options.enabled) {timer=setInterval(flush,positive(config.flushIntervalMs,1000));timer.unref();}
  else buffer=[];
}
function metadata() {
  const context=store.getStore();
  return context?.stage==='device' ? {functionTimingUpdateId:context.updateId} : {};
}
function push(record) {
  if(!options.enabled) return;
  if(buffer.length>=options.maxBuffer) {
    dropped++;
    if(dropped===1 || dropped%100===0) logger?.warn?.({dropped},'p1 timing buffer full; diagnostics dropped');
    return;
  }
  buffer.push(record);
}
function finish(context,outcome, messages) {
  const functions=Object.values(context.functions).map(f=>({
    ...f, totalSeconds:Number((f.totalMs/1000).toFixed(6)),
    maxCallSeconds:Number((f.maxMs/1000).toFixed(6)),totalMs:undefined,maxMs:undefined
  }));
  const load=functions.find(f=>f.functionName==='p1LoadRawCc');
  if(load) load.otherElapsedSeconds=Number(Math.max(0,load.totalSeconds-
    (functions.find(f=>f.functionName==='p1LoadRawCc.replicaFetch')?.totalSeconds||0)-
    (functions.find(f=>f.functionName==='p1LoadRawCc.metadataFetch')?.totalSeconds||0)).toFixed(6));
  if(!functions.length) return;
  const fields={stage:context.stage,attemptId:context.attemptId,outcome,
    timingScope:context.stage==='device'?'inclusive function wall time; child timings overlap parents':'shared p1 send-call wall time; not individual acknowledgement latency',
    functions:JSON.stringify(functions)};
  if(messages) {
    for(const msg of messages) if(msg.message?.functionTimingUpdateId) push({...fields,
      mountName:String(msg.message.mountName||''),updateId:msg.message.functionTimingUpdateId,
      sourceEntryId:String(msg.id),targetConsumer:String(msg.message.targetConsumer||''),
      sharedSendCallId:context.attemptId,sharedMessageCount:String(messages.length)});
  } else push({...fields,mountName:context.mountName,updateId:context.updateId,sourceEntryId:context.sourceId});
}
async function scope(context,callback,messages) {
  let outcome='FAILED';
  try {return await store.run(context,async()=>{const value=await callback();outcome='SUCCESS';return value;});}
  finally {finish(context,outcome,messages);}
}
function device(message,combined,callback) {
  if(!options.enabled || Math.random()>=options.sampleRate) return callback();
  return scope({stage:'device',updateId:combined?.updateId||randomUUID(),attemptId:randomUUID(),
    mountName:String(message.message?.mountName||''),sourceId:String(message.id),functions:{}},callback);
}
function kafka(messages,callback) {
  if(!options.enabled || !messages.some(m=>m.message?.functionTimingUpdateId)) return callback();
  return scope({stage:'kafka',attemptId:randomUUID(),functions:{}},callback,messages);
}
function wrap(name,fn) {
  return function(...args) {
    const context=store.getStore();
    if(!context || !options.enabled || !(name in parents)) return fn.apply(this,args);
    const started=performance.now();
    const slices=name==='p1IterateAiPmSlices'||name==='p1IterateEcPmSlices';
    const inputCount=slices && Array.isArray(args[0]?.['historical-performance-data-list']) ? args[0]['historical-performance-data-list'].length : 0;
    const complete=(value,failed)=>{
      const ms=Math.max(0,performance.now()-started);
      const item=context.functions[name] ||= {functionName:name,parentFunction:parents[name],callCount:0,failedCalls:0,totalMs:0,maxMs:0,
        ...(slices?{inputSliceCount:0,successfulOutputSliceCount:0}:{})};
      item.callCount++; item.failedCalls+=failed?1:0; item.totalMs+=ms; item.maxMs=Math.max(item.maxMs,ms);
      if(slices) {item.inputSliceCount+=inputCount;
        if(!failed && Array.isArray(value?.['historical-performance-data-list'])) item.successfulOutputSliceCount+=value['historical-performance-data-list'].length;}
    };
    try {
      const value=fn.apply(this,args);
      if(value && typeof value.then==='function') return value.then(result=>{complete(result,typeof result==='string');return result;},error=>{complete(null,true);throw error;});
      complete(value,typeof value==='string');return value;
    } catch(error) {complete(null,true);throw error;}
  };
}
async function flush() {
  if(flushing || !buffer.length) return;
  flushing=true; const entries=buffer.splice(0,100);
  try {
    const redis=await require('../infra/redis/redisClient').getRedisClient(logger);
    const batch=redis.multi();
    for(const fields of entries) batch.xAdd(STREAM,'*',fields,{TRIM:{strategy:'MAXLEN',strategyModifier:'~',threshold:options.maxLen}});
    await batch.execAsPipeline();
  } catch(error) {dropped+=entries.length;logger?.warn?.({error:error.message,dropped},'p1 diagnostics could not be saved; processing unaffected');}
  finally {flushing=false;}
}
module.exports={configure,wrap,device,kafka,metadata,flush,_test:{stats:()=>({buffered:buffer.length,dropped})}};
