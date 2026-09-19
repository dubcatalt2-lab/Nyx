import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAiAllowance,aiAllowanceConfig,aiModelAllowed,aiMonthlyModelCap} from '../lib/ai-allowance.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';
const deepseek='deepseek/deepseek-v4.1-flash',sol='openai/gpt-5.6-sol-pro';
const db=memoryFirestore();let time=Date.parse('2026-09-14T12:00:00Z');
const allowance=createAiAllowance({db,config:aiAllowanceConfig({}),now:()=>time});
const member={uid:'member',createdAt:Date.parse('2026-08-01T00:00:00Z')},premium={...member,uid:'premium',premium:true},owner={...member,uid:'owner',owner:true};
const record=actor=>'nyxAiAllowance/models-'+createHash('sha256').update(actor.uid).digest('hex');
const payload=model=>({model,messages:[{role:'user',content:'Hello'}],max_tokens:100});
const seed=(actor,model,used)=>db.records.set(record(actor),{month:'2026-09',tokens:{[model]:used}});
async function call(actor,model,usage={input:20,output:30},notSent=false){const session=await allowance.begin(actor);try{const r=await allowance.reserve(session,'shared',payload(model));await allowance.settle(r,usage,notSent);return r;}finally{await allowance.finish(session);time+=61000;}}
for(const actor of [member,premium,{...member,trusted:true},{...member,apiVerified:true}]){
 assert.equal(aiModelAllowed(sol,actor),false);
 await assert.rejects(call(actor,sol),/owner only/);
}
assert.equal(aiModelAllowed(sol,owner),true);
assert.equal(aiMonthlyModelCap(deepseek,member),10000);
assert.equal(aiMonthlyModelCap(deepseek,premium),50000);
assert.equal(aiMonthlyModelCap(deepseek,owner),null);
for(const [actor,model,cap] of [[member,deepseek,10000],[premium,deepseek,50000],[owner,sol,100000]]){
 seed(actor,model,cap);
 await assert.rejects(call(actor,model),/exceeds your/);
 seed(actor,model,0);await call(actor,model);
 assert.equal(db.records.get(record(actor)).tokens[model],50);
 await call(actor,model,null,true);
 assert.equal(db.records.get(record(actor)).tokens[model],50,'Unsent request refunded');
}
assert.equal(db.records.has('nyxAiAllowance/premium-'+createHash('sha256').update(premium.uid).digest('hex')),false,'DeepSeek does not alter Luna/Gemini or legacy counters');
seed(owner,deepseek,999999);await call(owner,deepseek);assert.equal(db.records.get(record(owner)).tokens[deepseek],999999,'Owner DeepSeek exempt');
seed(premium,deepseek,48500);
const a=await allowance.begin(premium),b=await allowance.begin({...premium,apiVerified:true});
const results=await Promise.allSettled([allowance.reserve(a,'shared',payload(deepseek)),allowance.reserve(b,'shared',payload(deepseek))]);
assert.equal(results.filter(r=>r.status==='fulfilled').length,1,'Shared user counter serializes concurrent reservations');
for(const result of results)if(result.status==='fulfilled'){await allowance.settle(result.value,null,true);await allowance.settle(result.value,null,true);}
assert.equal(db.records.get(record(premium)).tokens[deepseek],48500,'Refund is idempotent');
await allowance.finish(a);await allowance.finish(b);
time=Date.parse('2026-09-30T23:58:00Z');seed(owner,sol,0);const late=await allowance.begin(owner),r=await allowance.reserve(late,'shared',payload(sol));await allowance.finish(late);
time=Date.parse('2026-10-01T00:01:00Z');await call(owner,sol);await allowance.settle(r,null,true);
assert.deepEqual(db.records.get(record(owner)),{month:'2026-10',tokens:{[sol]:50}},'Month resets; old refund cannot debit new month');
const paid=createAiAllowance({db:memoryFirestore(),config:aiAllowanceConfig({NYX_AI_DAILY_BUDGET_USD:'10'}),now:()=>time});
const session=await paid.begin(owner),request=payload(sol),reservation=await paid.reserve(session,'shared',request);
assert.deepEqual(request.provider.max_price,{prompt:4,completion:20});
await paid.settle(reservation,null,true);await paid.finish(session);
console.log('PASS: shared 10k/50k/owner exemption; owner-only Sol 100k; separate counters, concurrency, refunds, UTC rollover and routing price bounds');
