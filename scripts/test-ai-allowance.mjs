import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAiAllowance, aiAllowanceConfig} from '../lib/ai-allowance.mjs';
import {aiBudgetResponse} from '../lib/ai-budget-response.mjs';

// Serialized transactions with staged writes, including Firestore's read-before-write rule.
export function memoryFirestore() {
  const records=new Map();let tail=Promise.resolve();
  const reference=path=>({path,async get(){const value=records.get(path);return {exists:value!==undefined,data:()=>structuredClone(value)};}});
  return {records,collection:name=>({doc:id=>reference(`${name}/${id}`)}),
    runTransaction(callback) {
      const run=tail.then(async()=>{
        const writes=[];
        const result=await callback({get:r=>{assert.equal(writes.length,0,'Firestore reads must precede writes');return r.get();},set(r,value,options){writes.push([r.path,structuredClone(value),options]);}});
        for(const [path,value,options] of writes)records.set(path,options?.merge?{...records.get(path),...value}:value);
        return result;
      });
      tail=run.catch(()=>{});return run;
    }};
}
const DAY=86400000;
const key=uid=>`nyxAiAllowance/account-${createHash('sha256').update(uid).digest('hex')}`;
function fixture(env={}) {
  const db=memoryFirestore(),config=aiAllowanceConfig(env);
  let time=Date.parse('2026-09-10T12:00:00Z');
  const create=()=>createAiAllowance({db,config,now:()=>time});
  return {db,config,allowance:create(),create,advance:n=>time+=n,
    actor:(uid,extra={})=>({uid,device:uid,network:'school',createdAt:Date.parse('2026-08-01T00:00:00Z'),...extra})};
}
const payload=()=>({model:'test',messages:[{role:'user',content:'Hello'}],max_tokens:1000});
const rejected=(p,pattern)=>assert.rejects(p,error=>error.code==='ai_allowance'&&pattern.test(error.message));

async function run() {
  {
    const f=fixture(),a=f.allowance;
    await rejected(a.begin({}),/Sign in/);
    const newcomer=await a.begin(f.actor('new'));
    assert.equal(newcomer.tier,'newcomer','Age alone must not grant trust');
    await rejected(f.create().begin(f.actor('new')),/busy/);
    await rejected(a.begin(f.actor('other-new')),/busy/);
    const established=await a.begin(f.actor('trusted',{trusted:true}));
    await rejected(a.begin(f.actor('other-trusted',{trusted:true})),/busy/);
    const owner=await a.begin(f.actor('owner',{owner:true}));
    assert.equal(owner.tier,'reserve');
    await a.finish(newcomer,true);await a.finish(established);await a.finish(owner);
    assert.equal(f.db.records.get(key('new')).activeDays.length,1);
    f.advance(61000);
    const again=await f.create().begin(f.actor('new'));
    assert.equal(f.db.records.get(key('new')).requests,2,'Restart must retain request counters');
    await a.finish(again);
    await rejected(a.begin(f.actor('blocked',{blocked:true,owner:true})),/restricted/);
    f.db.records.set(key('history'),{activeDays:['2026-09-07','2026-09-08','2026-09-09']});
    const historical=await a.begin(f.actor('history'));assert.equal(historical.tier,'established');await a.finish(historical);
  }
  {
    const f=fixture({NYX_AI_DAILY_REQUEST_BUDGET:'80'}),a=f.allowance;
    for(let n=0;n<2;n++)await a.finish(await a.begin(f.actor(`n${n}`)));
    await rejected(a.begin(f.actor('burst')),/resting/);
    const t=await a.begin(f.actor('trusted',{trusted:true}));await a.finish(t);
    f.advance(DAY/16+1);
    await a.finish(await a.begin(f.actor('released')));
    // Exhaust only the new-account partition; other pools remain usable.
    const global=f.db.records.get('nyxAiAllowance/global');global.newcomerRequests=16;
    await rejected(a.begin(f.actor('exhausted')),/used for today/);
    await a.finish(await a.begin(f.actor('owner',{owner:true})));
    await a.finish(await a.begin(f.actor('established',{trusted:true})));
  }
  {
    const f=fixture({NYX_AI_NEW_DAILY_REQUESTS:'1'}),a=f.allowance;
    for(let n=0;n<3;n++)await a.finish(await a.begin(f.actor(`device${n}`,{device:'same-browser'})));
    await a.finish(await a.begin(f.actor('device4',{device:'same-browser'})));
    await rejected(a.begin(f.actor('device0')),/resets/);
    f.advance(DAY);
    await a.finish(await a.begin(f.actor('device0',{device:'same-browser'})));
    for(let n=0;n<3;n++)await a.register('signup-device','school');
    await rejected(f.create().register('signup-device','school'),/creation limit/);
    for(let n=0;n<97;n++)await a.register(`school-device-${n}`,'school');
    await rejected(a.register('school-overflow','school'),/network/);
    f.advance(3600001);await a.register('school-overflow','school');
    let cookie='';const req={headers:{},secure:true},res={append(_name,value){cookie=value;}};
    const id=await a.device(req,res);assert.match(cookie,/HttpOnly; SameSite=Lax/);assert.match(cookie,/Secure$/);
    req.headers.cookie=cookie.split(';')[0];assert.equal(await f.create().device(req,res),id);
    req.headers.cookie=req.headers.cookie.slice(0,-1)+(req.headers.cookie.endsWith('0')?'1':'0');
    assert.notEqual(await a.device(req,res),id,'Forged cookies must not be trusted');
  }
  {
    const env={NYX_AI_DAILY_BUDGET_USD:'1',NYX_AI_MONTHLY_BUDGET_USD:'1',NYX_AI_MODEL_PRICES_JSON:JSON.stringify({'shared:test':{inputPerMillion:1,outputPerMillion:2}})};
    const f=fixture(env),a=f.allowance,s=await a.begin(f.actor('money'));
    const body=payload(),r=await a.reserve(s,'shared',body);
    assert.equal(body.max_tokens,700);assert.equal(r.reserved,2493,'Byte estimate and output reservation must be finite');
    const paid=f.db.records.get('nyxAiAllowance/global');assert.equal(paid.monthMoney,2493);
    await a.settle(r,{input:10,output:20});assert.equal(paid.monthMoney,2493,'Mock snapshots must be independent');
    assert.equal(f.db.records.get('nyxAiAllowance/global').monthMoney,50);
    await a.settle(r,{input:0,output:0});assert.equal(f.db.records.get('nyxAiAllowance/global').monthMoney,50,'Settlement must be idempotent');
    const uncertain=await a.reserve(s,'shared',payload());await a.settle(uncertain,null);
    assert.equal(f.db.records.get('nyxAiAllowance/global').monthMoney,2543,'Unknown usage must retain its reservation');
    await rejected(a.reserve(s,'shared',{...payload(),model:'unpriced'}),/model is not available/);
    await a.finish(s);f.advance(DAY);
    const next=await a.begin(f.actor('new-day'));
    assert.equal(f.db.records.get('nyxAiAllowance/global').monthMoney,2543,'Daily reset must preserve monthly spend');
    f.db.records.get('nyxAiAllowance/global').monthMoney=999999;
    await rejected(a.reserve(next,'shared',payload()),/spending allowance/);
    await a.finish(next);
    f.advance(31*DAY);
    const newMonth=await a.begin(f.actor('new-month'));await a.reserve(newMonth,'shared',payload());
    assert.equal(f.db.records.get('nyxAiAllowance/global').monthMoney,2493);
  }
  {
    const f=fixture({NYX_AI_DAILY_BUDGET_USD:'1',NYX_AI_MODEL_PRICES_JSON:JSON.stringify({'shared:test':{inputPerMillion:1,outputPerMillion:2}})}),a=f.allowance;
    const x=await a.begin(f.actor('x',{trusted:true})),y=await a.begin(f.actor('y',{trusted:true}));
    f.db.records.get('nyxAiAllowance/global').establishedMoney=696000;
    const results=await Promise.allSettled([a.reserve(x,'shared',payload()),f.create().reserve(y,'shared',payload())]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1,'Concurrent reservations cannot overspend a pool');
    const r=results.find(r=>r.status==='fulfilled').value;
    await a.settle(r,{input:1,output:1,cost:0.01});
    assert.equal(f.db.records.get('nyxAiAllowance/global').establishedMoney,706000,'Unexpected provider cost must stop further spend');
    await rejected(a.reserve(y,'shared',payload()),/spending allowance/);
  }
  {
    const f=fixture(),a=f.allowance,s=await a.begin(f.actor('limits'));
    await rejected(a.reserve(s,'shared',{...payload(),tools:[{}]}),/request type/);
    await rejected(a.reserve(s,'shared',{...payload(),messages:[{role:'user',content:'x'.repeat(100001)}]}),/too large/);
    await rejected(a.reserve(s,'shared',{...payload(),messages:Array.from({length:25},()=>({role:'user',content:'x'}))}),/too long/);
    await a.reserve(s,'shared',payload());
    await rejected(a.reserve(s,'shared',payload()),/processing limit/);
    await a.finish(s);
    assert.throws(()=>aiAllowanceConfig({NYX_AI_MODEL_PRICES_JSON:'bad'}));
    assert.throws(()=>aiAllowanceConfig({NYX_AI_DAILY_BUDGET_USD:'bad'}));
  }
  {
    const text='data: {"choices":[{"delta":{"content":"hello"}}]}\n\ndata: {"usage":{"prompt_tokens":12,"completion_tokens":6,"cost":0.0001}}\n\ndata: [DONE]\n\n';
    const bytes=new TextEncoder().encode(text);let cursor=0,result;
    const input=new Response(new ReadableStream({pull(c){if(cursor>=bytes.length)return c.close();c.enqueue(bytes.slice(cursor,cursor+=7));}}),{headers:{'content-type':'text/event-stream'}});
    const forwarded=aiBudgetResponse(input,(usage,success)=>{result={usage,success};});
    assert.equal(await forwarded.text(),text);assert.deepEqual(result,{usage:{input:12,output:6,cost:.0001},success:true});
    let cancelled=false;
    const partial=aiBudgetResponse(new Response(new ReadableStream({pull(c){c.enqueue(new TextEncoder().encode('data: {"usage":{"prompt_tokens":1,"completion_tokens":1}}\n\n'));},cancel(){cancelled=true;}}),{headers:{'content-type':'text/event-stream'}}),(usage,success)=>{result={usage,success};});
    const reader=partial.body.getReader();await reader.read();await reader.cancel();assert.ok(cancelled);assert.deepEqual(result,{usage:null,success:false});
    const error=aiBudgetResponse(new Response('{"error":"unavailable","usage":{"prompt_tokens":0,"completion_tokens":0}}',{status:502}),(usage,success)=>{result={usage,success};});
    await error.text();assert.deepEqual(result,{usage:null,success:false});
    const groq=aiBudgetResponse(new Response('{"x_groq":{"usage":{"prompt_tokens":8,"completion_tokens":2}}}'),(usage,success)=>{result={usage,success};});
    await groq.text();assert.equal(result.usage.output,2);
    const large=aiBudgetResponse(new Response('x'.repeat(2*1024*1024+1)),(usage,success)=>{result={usage,success};});
    await assert.rejects(large.text(),/size limit/);assert.deepEqual(result,{usage:null,success:false});
  }
  console.log('PASS: durable AI partitions, concurrency, pacing, signup/cookies, pricing reservations, rollover, disconnects and usage parsing');
}
if(process.argv[1]?.endsWith('test-ai-allowance.mjs'))await run();
