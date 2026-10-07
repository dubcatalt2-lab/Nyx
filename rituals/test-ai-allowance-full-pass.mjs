import assert from 'node:assert/strict';
import {createAiAllowance,aiAllowanceConfig} from '../scripture/ai-allowance.mjs';
import {aiBudgetResponse} from '../scripture/ai-budget-response.mjs';
import {collectModelVoice} from '../scripture/model-voice.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';

const DAY=86400000,model='google/gemini-fixture';
const price={inputPerMillion:1,outputPerMillion:2};
function fixture(premium=false){
  const db=memoryFirestore();let time=Date.parse('2026-10-03T12:00:00Z');
  const allowance=createAiAllowance({db,now:()=>time,config:aiAllowanceConfig({NYX_AI_DAILY_BUDGET_USD:'1',NYX_AI_NEW_DAILY_REQUESTS:'1',NYX_AI_ESTABLISHED_DAILY_REQUESTS:'1',NYX_AI_MODEL_PRICES_JSON:JSON.stringify({['shared:'+model]:price})})});
  return {db,a:allowance,actor:{uid:'member',premium,trusted:true,requestedModel:model},advance:ms=>time+=ms,payload:()=>({model,messages:[{role:'user',content:'Hello'}],max_tokens:1200})};
}
for(const premium of [false,true]){
  const f=fixture(premium),{a,actor}=f;
  const initial=await a.usage(actor);assert.equal(initial.resetAt,null);assert.equal(initial.tokens.limit,premium?50000:7000);
  for(let i=0;i<20;i++){
    const s=await a.begin(actor);
    // Old daily counts and hidden per-account dollars must not block chat.
    const account=f.db.records.get(s.refs.account.path);account.requests=2000;account.money=150000;
    const r=await a.reserve(s,'shared',f.payload(),price);
    const pending=await a.usage(actor);assert.equal(pending.tokens.used,i*20);assert.equal(pending.tokens.pending,r.tokens);
    await a.settle(r,{input:10,output:10});await a.finish(s,true);f.advance(61000);
  }
  const settled=await a.usage(actor);assert.equal(settled.tokens.used,400);assert.equal(settled.tokens.pending,0);
  const changed=await a.usage({...actor,premium:!premium});assert.equal(changed.tokens.used,400);assert.equal(changed.resetAt,settled.resetAt);
  assert.equal(changed.tokens.limit,premium?7000:50000);
  f.advance(4*DAY);assert.equal((await a.usage(actor)).tokens.used,0);
  assert.equal((await a.usage(actor)).resetAt,null,'An expired pool starts its next window on the next request, not a balance read');
}
{
  const {a,actor,payload,advance,db}=fixture();
  const s=await a.begin(actor),r=await a.reserve(s,'shared',payload(),price);
  await a.settle(r,null);await a.finish(s,false);
  let view=await a.usage(actor);assert.equal(view.tokens.pending,r.tokens);assert.equal(view.tokens.uncertain,r.tokens);assert.equal(view.pendingCostsUsd,r.reserved/1e6);
  advance(240000);
  const next=await a.begin(actor),second=await a.reserve(next,'shared',payload(),price);
  assert(db.records.get(s.refs.account.path).receipts.some(item=>item.id===r.id),'Expired timeout must not delete an unsettled receipt');
  await a.settle(r,{input:10,output:5});await a.settle(r,{input:10,output:5});
  await a.settle(second,null,true);await a.finish(next,false);
  view=await a.usage(actor);assert.equal(view.tokens.used,15);assert.equal(view.tokens.pending,0);assert.equal(view.pendingCostsUsd,0);
  assert.equal(db.records.get('nyxAiAllowance/global').establishedRequests,0,'Failed requests do not consume global daily allowance');
}
{
  const {a,actor,payload,advance,db}=fixture();
  const s=await a.begin(actor),r=await a.reserve(s,'shared',payload(),price);
  const wire='data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":"stop"}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":17,"completion_tokens":3}}\n\ndata: [DONE]\n\n';
  const bytes=new TextEncoder().encode(wire);let offset=0;
  const response=new Response(new ReadableStream({pull(c){if(offset===bytes.length)return c.close();const end=Math.min(bytes.length,offset+3);c.enqueue(bytes.slice(offset,end));offset=end;}}),{headers:{'content-type':'text/event-stream'}});
  await aiBudgetResponse(response,(usage)=>a.settle(r,usage)).text();await a.finish(s,true);
  assert.equal((await a.usage(actor)).tokens.used,20,'Trailing streaming usage replaces the maximum output reservation');
  for(let i=0;i<3;i++){const request=await a.begin(actor);await a.finish(request,true);}
  await assert.rejects(a.begin(actor),e=>e.reason==='cooldown'&&e.retryAfter===60);
  advance(61000);
  const busy=await a.begin(actor);await assert.rejects(a.begin(actor),e=>e.reason==='capacity');await a.finish(busy,false);
  const cap=await a.begin(actor);db.records.get(cap.refs.models.path).pool.used=7000;
  await assert.rejects(a.reserve(cap,'shared',payload(),price),e=>e.reason==='token_limit');await a.finish(cap,false);
}
{
  const {a,actor,payload,db}=fixture(true);
  const s=await a.begin(actor);Object.assign(db.records.get('nyxAiAllowance/global'),{month:'2026-10',monthMoney:30000000});
  await assert.rejects(a.reserve(s,'shared',payload(),price),e=>e.reason==='shared_budget');await a.finish(s,false);
}
{
  const {a,actor,payload}=fixture(true),first={...actor,app:'nook',device:'shared-workspace'},second={...first,uid:'second-member'};
  const s=await a.begin(first),r=await a.reserve(s,'shared',payload(),price);
  assert.equal((await a.usage(second)).tokens.pending,r.tokens,'Nook pending totals include other accounts using the same workspace pool');
  await a.settle(r,null);assert.equal((await a.usage(second)).tokens.uncertain,r.tokens);
  await a.settle(r,{input:10,output:10});await a.finish(s,true);
  const view=await a.usage(second);assert.equal(view.tokens.used,20);assert.equal(view.tokens.pending,0);assert.equal(view.tokens.uncertain,0);
}
{
  const {a,actor,payload}=fixture(true),s=await a.begin(actor),r=await a.reserve(s,'shared',payload(),price);
  const audio=Buffer.alloc(2*1024*1024).toString('base64');
  const wire='data: '+JSON.stringify({choices:[{delta:{audio:{data:audio,transcript:'Voice response'}}}]})+'\n\ndata: {"usage":{"prompt_tokens":20,"completion_tokens":40}}\n\ndata: [DONE]\n\n';
  const response=aiBudgetResponse(new Response(wire,{headers:{'content-type':'text/event-stream'}}),usage=>a.settle(r,usage),16*1024*1024);
  const voice=await collectModelVoice(response);assert.equal(voice.usage.completion_tokens,40);await a.finish(s,true);
  assert.equal((await a.usage(actor)).tokens.used,60,'Native audio beyond the text-only response bound settles actual usage');
}
console.log('PASS 20-message regular/premium conversations, removed hidden caps, live balances, tier changes/reset, late settlement, trailing SSE/audio usage, pacing and distinct quota reasons');
