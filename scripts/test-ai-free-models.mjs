import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {memoryFirestore} from './test-ai-allowance.mjs';
import {createAiAllowance,aiAllowanceConfig} from '../lib/ai-allowance.mjs';
import {freeAiModels} from '../lib/ai-free-models.mjs';
const db=memoryFirestore();let now=Date.now();
const config=aiAllowanceConfig({NYX_AI_DAILY_BUDGET_USD:1});
const allowance=createAiAllowance({db,config,now:()=>now});
const actor={uid:'free-user',createdAt:now,freeModel:freeAiModels[0]};
const account='nyxAiAllowance/account-'+createHash('sha256').update(actor.uid).digest('hex');
const models='nyxAiAllowance/models-'+createHash('sha256').update(actor.uid).digest('hex');
db.records.set(account,{day:new Date(now).toISOString().slice(0,10),requests:9999,tokens:999999});
db.records.set(models,{pool:{used:999999,start:now,resetAt:now+86400000}});
for(let i=0;i<12;i++){
 const session=await allowance.begin(actor);
 const payload={model:actor.freeModel,messages:[{role:'user',content:'Hello'}],max_tokens:200};
 const receipt=await allowance.reserve(session,'shared',payload);
 assert.deepEqual(receipt.price,{inputRate:0,outputRate:0,fixed:0});
 await allowance.settle(receipt,{input:100,output:100});await allowance.finish(session,true);now+=61000;
}
assert.equal(db.records.get(account).requests,9999);assert.equal(db.records.get(account).tokens,999999);assert.equal(db.records.get(models).pool.used,999999);
const session=await allowance.begin(actor);
await assert.rejects(allowance.reserve(session,'shared',{model:'inception/mercury-2.5',messages:[],max_tokens:10}),/selected free text model/);
await allowance.finish(session);
await assert.rejects(allowance.begin({...actor,blocked:true}),/restricted/);
await assert.rejects(allowance.begin({...actor,uid:'new-paid',freeModel:null}),/Premium/);
console.log('Free models: new-account access, no daily/token debit, zero prices, paid escape blocked, restrictions retained');
