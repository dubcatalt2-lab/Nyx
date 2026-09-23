import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAiAllowance,aiAllowanceConfig,AI_JOIN_CUTOFF} from '../lib/ai-allowance.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';
const model='openai/gpt-6-luna',other='deepseek/deepseek-v4.1-flash',day=86400000;
let time=Date.parse('2026-09-28T12:00:00Z');
const db=memoryFirestore(),allowance=createAiAllowance({db,config:aiAllowanceConfig({}),now:()=>time});
const actor={uid:'public-luna',createdAt:AI_JOIN_CUTOFF+1,requestedModel:model};
const key='nyxAiAllowance/models-'+createHash('sha256').update(actor.uid).digest('hex');
const pool=()=>db.records.get(key).pool;
const payload=m=>({model:m,messages:[{role:'user',content:'Hi'}],max_tokens:20});
function seed(used,luna6Tokens){db.records.set(key,{month:new Date(time).toISOString().slice(0,7),tokens:{},pool:{start:time,resetAt:time+4*day,period:'four-days',used,images:0,luna6Tokens}});}
async function request(who=actor,usage={input:30,output:20},refund=false){
  const session=await allowance.begin(who);
  try {const r=await allowance.reserve(session,'shared',payload(who.requestedModel));await allowance.settle(r,usage,refund);return r;}
  finally{await allowance.finish(session,!refund);time+=61000;}
}
await request();assert.equal(pool().used,50);assert.equal(pool().luna6Tokens,50);
await request(actor,null,true);assert.equal(pool().used,50);assert.equal(pool().luna6Tokens,50);
const established={...actor,createdAt:AI_JOIN_CUTOFF-1,requestedModel:other};
await request(established);assert.equal(pool().used,100);assert.equal(pool().luna6Tokens,50,'Other models preserve Luna usage');
seed(4900,4900);await assert.rejects(request(),/GPT-6 Luna allowance/);
await assert.rejects(request({...actor,modelRules:[{model,access:'allow'}]}),/GPT-6 Luna allowance/,'Allow cannot bypass subcap');
seed(9900,0);await assert.rejects(request(),/shared 10,000-token pool/);
seed(3800,3800);
const sessions=[await allowance.begin(actor),await allowance.begin({...actor,apiVerified:true})];
const results=await Promise.allSettled(sessions.map(s=>allowance.reserve(s,'shared',payload(model))));
assert.equal(results.filter(r=>r.status==='fulfilled').length,1,'Transactions serialize the shared Luna subcap');
const reserved=results.find(r=>r.status==='fulfilled').value;
await allowance.settle(reserved,null,true);await allowance.settle(reserved,null,true);
assert.equal(pool().used,3800);assert.equal(pool().luna6Tokens,3800,'Refunds are idempotent');
for(const s of sessions)await allowance.finish(s,false);
time+=61000;seed(0,0);
const pending=await allowance.begin(actor),late=await allowance.reserve(pending,'shared',payload(model));await allowance.finish(pending);
const oldStart=pool().start;time+=4*day+1;
await request();assert(pool().start>oldStart);assert.equal(pool().used,50);assert.equal(pool().luna6Tokens,50);
await allowance.settle(late,null,true);assert.equal(pool().used,50);assert.equal(pool().luna6Tokens,50,'Late refund cannot alter the new window');
seed(0,0);await request({...actor,requestedModel:'openai/gpt-6-luna-pro'});assert.equal(pool().luna6Tokens,50);
seed(4900,4900);await assert.rejects(request({...actor,requestedModel:'openai/gpt-6-luna-pro'}),/GPT-6 Luna allowance/,'Pro shares the Luna cap');
const premium={...actor,premium:true};seed(4900,4900);await request(premium);assert.equal(pool().luna6Tokens,4950);
seed(8000,8000);await request({...premium,requestedModel:'openai/gpt-6-luna-pro'});assert.equal(pool().used,8050,'New Premium uses the existing larger shared pool without a Luna subcap');
await assert.rejects(request(actor),/GPT-6 Luna allowance/,'Downgrade restores the public cap without resetting usage');
seed(49900,0);await assert.rejects(request(premium),/shared 50,000-token pool/);
console.log('PASS public Luna access; nested 5k/10k limits, other-model preservation, concurrent reservations, refunds and synchronized four-day reset.');
