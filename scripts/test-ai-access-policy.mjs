import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {memoryFirestore} from './test-ai-allowance.mjs';
import {AI_JOIN_CUTOFF,aiAllowanceConfig,createAiAllowance} from '../lib/ai-allowance.mjs';

const key=uid=>`nyxAiAllowance/account-${createHash('sha256').update(uid).digest('hex')}`;
function fixture() {
  const db=memoryFirestore();let time=Date.parse('2026-09-10T12:00:00Z');
  const config=aiAllowanceConfig({NYX_AI_ESTABLISHED_DAILY_REQUESTS:'40'});
  const create=()=>createAiAllowance({db,config,now:()=>time});
  const actor={uid:'member',createdAt:AI_JOIN_CUTOFF-1,premium:false,device:'device',network:'school'};
  return {db,create,actor,advance:(n=61000)=>time+=n};
}
const payload=()=>({model:'test',messages:[{role:'user',content:'Hello'}],max_tokens:1000});
const denied=p=>assert.rejects(p,e=>e.code==='ai_allowance');
{
  const f=fixture(),a=f.create();
  for(const createdAt of [AI_JOIN_CUTOFF,AI_JOIN_CUTOFF+1,NaN]) {
    for(const extras of [{},{trusted:true}]) {
      await assert.rejects(a.begin({...f.actor,createdAt,...extras}),e=>e.status===403);
    }
  }
  assert.equal(f.db.records.size,0,'Ineligible accounts must not consume quota or acquire slots');
  await a.finish(await a.begin(f.actor));
  const premium={...f.actor,uid:'premium',createdAt:AI_JOIN_CUTOFF+1,premium:true};
  await a.finish(await a.begin(premium));
  await denied(a.begin({...premium,premium:false}));
  await denied(a.begin({...premium,blocked:true}));
}
{
  const f=fixture();
  for(let i=0;i<10;i++) {
    const a=f.create(),s=await a.begin({...f.actor,trusted:true});
    const r=await a.reserve(s,'shared',payload());
    await a.settle(r,{input:50,output:50});
    await a.finish(s,true);f.advance();
  }
  assert.equal(f.db.records.get(key('member')).tokens,1000);
  await denied(f.create().begin(f.actor));
  f.advance(86400000);const a=f.create();await a.finish(await a.begin(f.actor));
  assert.equal(f.db.records.get(key('member')).tokens,0,'UTC rollover resets tokens');
}
{
  const f=fixture();
  for(let i=0;i<5;i++) {
    const a=f.create(),s=await a.begin(f.actor),r=await a.reserve(s,'shared',payload());
    await a.settle(r,{input:1300,output:700});await a.finish(s);f.advance();
  }
  assert.equal(f.db.records.get(key('member')).requests,5);
  await denied(f.create().begin(f.actor));
}
{
  const f=fixture(),a=f.create();
  for(let i=0;i<5;i++) {
    const s=await a.begin(f.actor),r=await a.reserve(s,'shared',payload());
    await a.settle(r,null);await a.finish(s);f.advance();
  }
  const tokens=f.db.records.get(key('member')).tokens;
  const s=await a.begin(f.actor);
  await assert.rejects(a.reserve(s,'shared',payload()),/exceeds your shared|extra message would exceed/);
  assert.equal(f.db.records.get(key('member')).tokens,tokens,'Rejected bonus must not reserve more tokens');
  await a.finish(s);
}
{
  const f=fixture(),a=f.create(),s=await a.begin(f.actor),r=await a.reserve(s,'shared',payload());
  await a.settle(r,null,true);assert.equal(f.db.records.get(key('member')).tokens,0);
  await a.settle(r,{input:9000,output:9000});assert.equal(f.db.records.get(key('member')).tokens,0,'Settlement remains idempotent');
  await a.finish(s);
}
console.log('PASS: exact Pacific signup cutoff, Premium eligibility, no role/trust bypass, 5 standard/10 maximum, bonus token reservations, unknown usage, refunds and rollover');

{
  const db=memoryFirestore(),config=aiAllowanceConfig({});
  assert.equal(config.globalConcurrent,30);
  const a=createAiAllowance({db,config});
  const actor=i=>({uid:'concurrency-'+i,trusted:true,createdAt:AI_JOIN_CUTOFF-1,device:'device-'+i,network:'same-school'});
  const sessions=[];
  for(let i=0;i<29;i++)sessions.push(await a.begin(actor(i)));
  await assert.rejects(a.begin(actor(29)),e=>e.status===429);
  sessions.push(await a.begin({...actor(30),premium:true}));
  await assert.rejects(a.begin({...actor(31),owner:true}),e=>e.status===429);
  await a.finish(sessions.pop());
  await a.finish(await a.begin({...actor(32),owner:true}));
  for(const session of sessions)await a.finish(session);
}
{
  const f=fixture(),a=f.create();
  for(const extra of [{},{trusted:true},{apiVerified:true}]) {
    const session=await a.begin({...f.actor,...extra});
    await assert.rejects(a.reserve(session,'shared',{...payload(),model:'openai/gpt-5.6-luna'}),e=>e.status===403);
    await a.finish(session);
  }
}
console.log('PASS: thirty total slots with priority reserve, release/reuse and Luna denial for non-Premium/trusted/API members');
