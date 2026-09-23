import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {memoryFirestore} from './test-ai-allowance.mjs';
import {aiModelAllowed,createAiAllowance,aiAllowanceConfig,aiOwnerClaudeUsage} from '../lib/ai-allowance.mjs';
import {freeAiModels} from '../lib/ai-free-models.mjs';
const opus='anthropic/claude-opus-5.5',luna='openai/gpt-6-luna',gemini='google/gemini-2.5-flash-lite',free=freeAiModels[0];
const publicModels=[luna,gemini,'google/gemini-2.5-flash-image','deepseek/deepseek-v4.1-flash',...freeAiModels];
const premiumModels=['openai/gpt-6-luna-pro','openai/gpt-5.6-luna','inception/mercury-2.5','qwen/qwen3.7-flash',opus];
const sols=['openai/gpt-6-sol','openai/gpt-5.6-sol-pro'];
for(const model of publicModels)assert(aiModelAllowed(model,{}),model);
for(const model of premiumModels){assert(!aiModelAllowed(model,{}),model);assert(aiModelAllowed(model,{premium:true}),model);}
for(const model of sols){assert(!aiModelAllowed(model,{premium:true,modelRules:[{model,access:'allow'}]}));assert(aiModelAllowed(model,{owner:true}));}
let time=Date.parse('2026-09-23T12:00:00Z');const day=86400000,db=memoryFirestore();
const allowance=createAiAllowance({db,config:aiAllowanceConfig({}),now:()=>time});
const key=uid=>'nyxAiAllowance/models-'+createHash('sha256').update(uid).digest('hex');
const actor={uid:'public',createdAt:time};
const payload=model=>({model,messages:[{role:'user',content:'hi'}],max_tokens:10});
async function call(who,model,{refund=false,usage={input:30,output:20}}={}){
 const session=await allowance.begin({...who,requestedModel:model,freeModel:freeAiModels.includes(model)?model:null});
 try{const r=await allowance.reserve(session,'shared',payload(model));await allowance.settle(r,usage,refund);return r;}
 finally{await allowance.finish(session,!refund);time+=61000;}
}
for(const model of [luna,gemini,free])await call(actor,model);
assert.equal(db.records.get(key(actor.uid)).pool.used,150,'Paid and free models share one counter');
await call(actor,free,{refund:true});assert.equal(db.records.get(key(actor.uid)).pool.used,150);
db.records.get(key(actor.uid)).pool.used=9900;
await assert.rejects(call(actor,free),/shared 10,000-token pool/);
await call({...actor,premium:true},free);assert.equal(db.records.get(key(actor.uid)).pool.used,9950,'Upgrade retains usage');
db.records.get(key(actor.uid)).pool.used=49900;await assert.rejects(call({...actor,premium:true},free),/shared 50,000-token pool/);
time+=4*day;await call(actor,free);assert.equal(db.records.get(key(actor.uid)).pool.used,50);
const owner={uid:'owner',owner:true,createdAt:time};
for(const model of [...sols,luna,opus])await call(owner,model);
assert.equal(db.records.get(key(owner.uid)).ownerClaudePool.used,50,'Only owner Opus is capped');
await call(owner,opus,{refund:true});assert.equal(db.records.get(key(owner.uid)).ownerClaudePool.used,50);
db.records.get(key(owner.uid)).ownerClaudePool.used=49900;
await assert.rejects(call(owner,opus),/50,000-token Claude Opus/);
for(const model of sols)await call(owner,model,{usage:{input:100000,output:100000}});
assert.equal(db.records.get(key(owner.uid)).ownerClaudePool.used,49900);
// Concurrent chat/API reservations cannot exceed the owner Opus cap.
db.records.get(key(owner.uid)).ownerClaudePool.used=48800;
const sessions=[await allowance.begin({...owner,requestedModel:opus}),await allowance.begin({...owner,requestedModel:opus,apiVerified:true})];
const results=await Promise.allSettled(sessions.map(s=>allowance.reserve(s,'shared',payload(opus))));
assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
const receipt=results.find(r=>r.status==='fulfilled').value;
await allowance.settle(receipt,null,true);await allowance.settle(receipt,null,true);
assert.equal(db.records.get(key(owner.uid)).ownerClaudePool.used,48800);
for(const session of sessions)await allowance.finish(session);
time+=61000;
db.records.get(key(owner.uid)).ownerClaudePool.used=0;
const pending=await allowance.begin({...owner,requestedModel:opus}),late=await allowance.reserve(pending,'shared',payload(opus));await allowance.finish(pending);
time+=4*day;await call(owner,opus);await allowance.settle(late,null,true);
assert.equal(db.records.get(key(owner.uid)).ownerClaudePool.used,50,'Late refund cannot change a new window');
assert.equal(aiOwnerClaudeUsage({month:new Date(time).toISOString().slice(0,7),tokens:{[opus]:123,[luna]:999}},time).used,123,'Existing recorded Opus usage migrates conservatively');
console.log('PASS public/Premium/owner model matrix, shared free/paid token pools, upgrade/reset/refund, owner Opus concurrency and unlimited Sol.');
