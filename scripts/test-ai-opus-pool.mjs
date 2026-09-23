import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAiAllowance,aiAllowanceConfig,AI_JOIN_CUTOFF,aiModelAllowed} from '../lib/ai-allowance.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';
const model='anthropic/claude-opus-5.5',other='deepseek/deepseek-v4.1-flash',day=86400000;
let time=Date.parse('2026-09-28T12:00:00Z');
const db=memoryFirestore(),allowance=createAiAllowance({db,config:aiAllowanceConfig({}),now:()=>time});
const actor={uid:'premium-opus',premium:true,createdAt:AI_JOIN_CUTOFF+1,requestedModel:model};
const key='nyxAiAllowance/models-'+createHash('sha256').update(actor.uid).digest('hex');
const pool=()=>db.records.get(key).pool;
const payload=m=>({model:m,messages:[{role:'user',content:'Hi'}],max_tokens:20});
function seed(used,opus55Tokens){db.records.set(key,{month:new Date(time).toISOString().slice(0,7),tokens:{},pool:{start:time,resetAt:time+4*day,period:'four-days',used,images:0,opus55Tokens}});}
async function request(who=actor,usage={input:30,output:20},refund=false){
  const session=await allowance.begin(who);
  try {const r=await allowance.reserve(session,'shared',payload(who.requestedModel));await allowance.settle(r,usage,refund);return r;}
  finally{await allowance.finish(session,!refund);time+=61000;}
}
assert.equal(aiModelAllowed(model,{modelRules:[{model,access:'allow'}]}),false);
await assert.rejects(allowance.begin({...actor,premium:false}),e=>e.status===403);
const rejected=await allowance.begin({...actor,uid:'forged-opus',premium:false,requestedModel:'openai/gpt-6-luna'});
try{await assert.rejects(allowance.reserve(rejected,'shared',payload(model)),e=>e.status===403);}finally{await allowance.finish(rejected,false);}
await request();assert.equal(pool().used,50);assert.equal(pool().opus55Tokens,50);
await request(actor,null,true);assert.equal(pool().used,50);assert.equal(pool().opus55Tokens,50);
const established={...actor,createdAt:AI_JOIN_CUTOFF-1,requestedModel:other};
await request(established);assert.equal(pool().used,100);assert.equal(pool().opus55Tokens,50,'Other models preserve Luna usage');
seed(4900,4900);await assert.rejects(request(),/Claude Opus 5.5 allowance/);
await assert.rejects(request({...actor,modelRules:[{model,access:'allow'}]}),/Claude Opus 5.5 allowance/,'Allow cannot bypass subcap');
seed(49900,0);await assert.rejects(request(),/shared 50,000-token pool/);
seed(3800,3800);
const sessions=[await allowance.begin(actor),await allowance.begin({...actor,apiVerified:true})];
const results=await Promise.allSettled(sessions.map(s=>allowance.reserve(s,'shared',payload(model))));
assert.equal(results.filter(r=>r.status==='fulfilled').length,1,'Transactions serialize the shared Luna subcap');
const reserved=results.find(r=>r.status==='fulfilled').value;
await allowance.settle(reserved,null,true);await allowance.settle(reserved,null,true);
assert.equal(pool().used,3800);assert.equal(pool().opus55Tokens,3800,'Refunds are idempotent');
for(const s of sessions)await allowance.finish(s,false);
time+=61000;seed(0,0);
const pending=await allowance.begin(actor),late=await allowance.reserve(pending,'shared',payload(model));await allowance.finish(pending);
const oldStart=pool().start;time+=4*day+1;
await request();assert(pool().start>oldStart);assert.equal(pool().used,50);assert.equal(pool().opus55Tokens,50);
await allowance.settle(late,null,true);assert.equal(pool().used,50);assert.equal(pool().opus55Tokens,50,'Late refund cannot alter the new window');
time+=61000;seed(0,0);await request({...actor,requestedModel:'openai/gpt-6-luna'});await request();assert.equal(pool().used,100);assert.equal(pool().luna6Tokens,50);assert.equal(pool().opus55Tokens,50,'Luna and Opus maintain independent subcaps within one pool');
console.log('PASS premium Opus: role gate, nested 5k/50k limits, concurrent reservations, refunds and four-day reset.');
