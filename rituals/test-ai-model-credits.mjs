import assert from 'node:assert/strict';
import {aiModelAllowed,createAiAllowance,aiAllowanceConfig} from '../scripture/ai-allowance.mjs';
import {addModelCredits,modelCreditRef} from '../scripture/ai-model-credits.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';
const expensive={inputPerMillion:.2,outputPerMillion:3.01},cheap={inputPerMillion:3,outputPerMillion:3};
for(const app of [null,'nyx'])for(const extra of [{},{premium:true},{coOwner:true},{trusted:true},{apiVerified:true}]){
 const actor={uid:'member',app,...extra};
 for(const model of ['openai/gpt-6-astra','~openai/gpt-astra-latest','anthropic/claude-opus-5.5','anthropic/claude-sonnet-4.5']){
  assert(!aiModelAllowed(model,{...actor,modelRules:[{model,access:'allow'}]},cheap));
  assert(aiModelAllowed(model,{owner:true},cheap));
 }
 assert(!aiModelAllowed('google/gemini-test',actor,expensive));
 assert(aiModelAllowed('google/gemini-test',actor,cheap));
}
assert(aiModelAllowed('anthropic/claude-haiku-4.5',{premium:true},{inputPerMillion:1,outputPerMillion:5}));
const db=memoryFirestore(),model='openai/gpt-6-luna',uid='credits-user';let now=Date.now();
const a=createAiAllowance({db,config:aiAllowanceConfig({}),now:()=>now});
const grant={model,credits:1000,requestId:'credit-request-0001'};
await Promise.all([addModelCredits(db,uid,grant),addModelCredits(db,uid,grant)]);
assert.equal((await modelCreditRef(db,uid).get()).data().credits[model],1000);
await assert.rejects(addModelCredits(db,uid,{...grant,credits:2}),e=>e.status===409);
await assert.rejects(addModelCredits(db,uid,{...grant,credits:-1}),e=>e.status===400);
const actor={uid,requestedModel:model,createdAt:now};
async function reserve(who=actor){const session=await a.begin(who);const r=await a.reserve(session,'shared',{model,messages:[{role:'user',content:'Hi'}],max_tokens:200});return {session,r};}
let {session,r}=await reserve();assert((await modelCreditRef(db,uid).get()).data().credits[model]<1000);
await a.settle(r,{input:10,output:20});await a.finish(session,true);now+=61000;
let data=(await modelCreditRef(db,uid).get()).data();assert.equal(data.credits[model],970);assert.equal(data.pool.used,0);
await a.settle(r,{input:10,output:20});assert.equal((await modelCreditRef(db,uid).get()).data().credits[model],970);
({session,r}=await reserve());await a.settle(r,null,true);await a.finish(session);now+=61000;
assert.equal((await modelCreditRef(db,uid).get()).data().credits[model],970);
({session,r}=await reserve({...actor,uid:'another-user'}));await a.settle(r,{input:10,output:20});await a.finish(session);now+=61000;
assert.equal((await modelCreditRef(db,'another-user').get()).data().pool.used,30);
const ref=modelCreditRef(db,uid);await db.runTransaction(async tx=>{const old=(await tx.get(ref)).data();tx.set(ref,{...old,credits:{[model]:10}});});
({session,r}=await reserve());await a.settle(r,{input:10,output:20});await a.finish(session);
data=(await ref.get()).data();assert.equal(data.credits[model],0);assert.equal(data.pool.used,20);
console.log('PASS owner-only model matrix, Haiku exception, atomic/idempotent model credits, per-user isolation, refunds and shared-pool split');
