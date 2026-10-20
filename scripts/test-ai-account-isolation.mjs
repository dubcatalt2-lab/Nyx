import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {memoryFirestore} from './test-ai-allowance.mjs';
import {createAiAllowance,aiAllowanceConfig} from '../lib/ai-allowance.mjs';
import {fableTrialStart,fableTrialId} from '../lib/ai-fable-trial.mjs';
const now=fableTrialStart+3600000,day=new Date(now).toISOString().slice(0,10),month=day.slice(0,7);
const db=memoryFirestore(),config=aiAllowanceConfig({NYX_AI_DAILY_BUDGET_USD:'1',NYX_AI_MONTHLY_BUDGET_USD:'1',NYX_AI_DAILY_REQUEST_BUDGET:'10'});
const create=()=>createAiAllowance({db,config,now:()=>now});let a=create();
const globalKey='nyxAiAllowance/global';
db.records.set(globalKey,{day,month,newcomerMoney:1000000,monthMoney:1000000,newcomerRequests:10});
db.records.set(`nyxAiAllowance/${fableTrialId}-global`,{reserved:1500000});
const model='deepseek/deepseek-v4.1-flash';
const actor=uid=>({uid,requestedModel:model,createdAt:now,network:'same-school'});
const payload=()=>({model,messages:[{role:'user',content:'Make a small game'}],max_tokens:1500});
for(const uid of ['first','second']) {
 const s=await a.begin(actor(uid));const r=await a.reserve(s,'shared',payload());
 await a.settle(r,{input:100,output:200,cost:.00027});await a.finish(s,true);
 assert.equal((await a.usage(actor(uid))).fableTrial.messagesRemaining,5);
 a=create();
}
assert.equal(db.records.get(`nyxAiAllowance/${fableTrialId}-global`).reserved,1500000,'Normal AI never charges Fable');
const accountKey='nyxAiAllowance/models-'+createHash('sha256').update('first').digest('hex');
const ledger=db.records.get(accountKey);ledger.pool.used=7000;db.records.set(accountKey,ledger);
const exhausted=await a.begin(actor('first'));await assert.rejects(a.reserve(exhausted,'shared',payload()),/account.*allowance/);await a.finish(exhausted);
const another=await a.begin(actor('third'));await a.reserve(another,'shared',payload());await a.finish(another);
await assert.rejects(a.begin({...actor('external'),app:'tutsi'}),/shared AI allowance/);
console.log('PASS regular AI: independent account allowances across restart/shared network, exhausted general and Fable budgets do not block DeepSeek; other app budget retained');
