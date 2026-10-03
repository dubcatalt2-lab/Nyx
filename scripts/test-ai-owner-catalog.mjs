import {hasAppAiAllowance,dropModelIsExpensive} from '../lib/ai-allowance.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
import {createAiAllowance,aiAllowanceConfig,aiModelAllowed} from '../lib/ai-allowance.mjs';
import {hasFullAiCatalog,fullCatalogUid,dailyOwnerModels,aiCatalogPrice} from '../lib/ai-owner-catalog.mjs';
import {isFreeAiModel} from '../lib/ai-free-models.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';
const [astra,fable]=dailyOwnerModels;
for(const model of [...dailyOwnerModels,'~openai/gpt-astra-latest','~anthropic/claude-fable-latest']){
 for(const actor of [{},{uid:'other',modelRules:[{model,access:'allow'}]}])assert(!aiModelAllowed(model,actor));
 assert(aiModelAllowed(model,{uid:fullCatalogUid}));assert(aiModelAllowed(model,{uid:'premium',premium:true}));assert(aiModelAllowed(model,{uid:'owner',owner:true}));
}
const price=aiCatalogPrice({pricing:{prompt:'0.00001',completion:'0.00005'}});
assert.deepEqual(price,{inputPerMillion:10,outputPerMillion:50,requestUsd:0,imageTokens:8192});
assert.equal(aiCatalogPrice({pricing:{prompt:'-1',completion:'-1'}}),null);
assert.equal(aiCatalogPrice({pricing:{prompt:'oops',completion:0}}),null);

const source=readFileSync('server.js','utf8'),ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
const declaration=name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(n.start,n.end)};
const context=vm.createContext({hasAppAiAllowance,dropModelIsExpensive,hasFullAiCatalog,aiCatalogPrice,aiAllowanceConfig,isFreeAiModel,URL,process:{env:{NYX_AI_DAILY_BUDGET_USD:'100'}},nyxAiEndpoint:()=> 'https://openrouter.ai/api/v1/chat/completions',freeModelHealth:{available:()=>true}});
vm.runInContext(declaration('nyxAiBudgetCatalog'),context);
const catalog=[{id:astra,text:true,pricing:{prompt:'.00001',completion:'.00005'}},{id:fable,text:true,pricing:{prompt:'.00001',completion:'.00005'}},{id:'new-vendor/new-chat',text:true,pricing:{prompt:'.000001',completion:'.000002'}},{id:'audio-only',text:false,pricing:{prompt:'.000001',completion:'.000002'}},{id:'unpriced-router',text:true,pricing:{prompt:-1,completion:-1}},{id:'openai/gpt-6-sol',text:true,pricing:{prompt:'.000002',completion:'.00001'}}];
assert.deepEqual(Array.from(context.nyxAiBudgetCatalog(catalog,false,null,{uid:fullCatalogUid}),x=>x.id),catalog.map(x=>x.id));
assert.deepEqual(Array.from(context.nyxAiBudgetCatalog(catalog,false,null,{uid:'other',owner:true}),x=>x.id),[astra,fable,'new-vendor/new-chat','openai/gpt-6-sol']);

let time=Date.parse('2026-09-26T12:00:00Z');
const db=memoryFirestore(),config=aiAllowanceConfig({NYX_AI_DAILY_BUDGET_USD:'0.001',NYX_AI_MONTHLY_BUDGET_USD:'0.001',NYX_AI_DAILY_REQUEST_BUDGET:'1'});
const allowance=createAiAllowance({db,config,now:()=>time});
const actor={uid:fullCatalogUid,owner:true,requestedModel:astra,modelRules:[{model:astra,access:'deny',messages:0,periodDays:4}]};
const key='nyxAiAllowance/models-'+createHash('sha256').update(fullCatalogUid).digest('hex');
db.records.set(key,{ownerDailyPool:{day:'2026-09-26',used:100000},ownerClaudePool:{start:time,used:100000}});
const payload=model=>({model,messages:[{role:'user',content:'hello'}],max_tokens:8000});
const sessions=[];
for(const model of [astra,fable,'~openai/gpt-astra-latest','~anthropic/claude-fable-latest','anthropic/claude-opus-5.5','new-vendor/new-chat']){
 const session=await allowance.begin({...actor,requestedModel:model});sessions.push(session);
 const body=payload(model),reservation=await allowance.reserve(session,'shared',body,price);
 assert.equal(body.max_tokens,8000,'Exact UID avoids shared output cap');
 await allowance.settle(reservation,{input:10000,output:5000,cost:1});
}
for(const session of sessions)await allowance.finish(session,true);
assert.equal(db.records.get(key).ownerDailyPool.used,100000,'Retired owner daily cap is no longer consumed');
assert.equal(db.records.get(key).ownerClaudePool.used,100000,'Exact UID no longer consumes Claude quota');
const other={uid:'other-owner',owner:true,requestedModel:'openai/gpt-6-sol'};
await assert.rejects(allowance.begin(other),/shared AI allowance has been used/);
assert(aiModelAllowed(astra,other));
const account=db.records.get('nyxAiAllowance/account-'+createHash('sha256').update(fullCatalogUid).digest('hex'));
assert(account.money>0&&account.tokens>0,'Owner usage remains accounted for');
assert.equal(account.slots.length,0);
console.log('PASS exact-UID exemption for spending, daily tokens, model messages, burst/concurrent account quotas; other owners remain limited; usage accounting preserved');
