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
 for(const actor of [{},{uid:'other',owner:true},{uid:'other',premium:true},{uid:'other',modelRules:[{model,access:'allow'}]}])assert(!aiModelAllowed(model,actor));
 assert(aiModelAllowed(model,{uid:fullCatalogUid}));
}
const price=aiCatalogPrice({pricing:{prompt:'0.00001',completion:'0.00005'}});
assert.deepEqual(price,{inputPerMillion:10,outputPerMillion:50,requestUsd:0,imageTokens:8192});
assert.equal(aiCatalogPrice({pricing:{prompt:'-1',completion:'-1'}}),null);
assert.equal(aiCatalogPrice({pricing:{prompt:'oops',completion:0}}),null);

const source=readFileSync('server.js','utf8'),ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
const declaration=name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(n.start,n.end)};
const context=vm.createContext({hasFullAiCatalog,aiCatalogPrice,aiAllowanceConfig,isFreeAiModel,URL,process:{env:{NYX_AI_DAILY_BUDGET_USD:'100'}},nyxAiEndpoint:()=> 'https://openrouter.ai/api/v1/chat/completions',freeModelHealth:{available:()=>true}});
vm.runInContext(declaration('nyxAiBudgetCatalog'),context);
const catalog=[{id:astra,text:true,pricing:{prompt:'.00001',completion:'.00005'}},{id:fable,text:true,pricing:{prompt:'.00001',completion:'.00005'}},{id:'new-vendor/new-chat',text:true,pricing:{prompt:'.000001',completion:'.000002'}},{id:'audio-only',text:false,pricing:{prompt:'.000001',completion:'.000002'}},{id:'unpriced-router',text:true,pricing:{prompt:-1,completion:-1}},{id:'openai/gpt-6-sol',text:true,pricing:{prompt:'.000002',completion:'.00001'}}];
assert.deepEqual(Array.from(context.nyxAiBudgetCatalog(catalog,false,null,{uid:fullCatalogUid}),x=>x.id),catalog.map(x=>x.id));
assert.deepEqual(Array.from(context.nyxAiBudgetCatalog(catalog,false,null,{uid:'other',owner:true}),x=>x.id),['openai/gpt-6-sol']);

let time=Date.parse('2026-09-26T12:00:00Z');
const db=memoryFirestore(),config=aiAllowanceConfig({NYX_AI_DAILY_BUDGET_USD:'100'});
const allowance=createAiAllowance({db,config,now:()=>time});
const actor={uid:fullCatalogUid,owner:true,requestedModel:astra};
const key='nyxAiAllowance/models-'+createHash('sha256').update(fullCatalogUid).digest('hex');
const pool=()=>db.records.get(key)?.ownerDailyPool;
const payload=model=>({model,messages:[{role:'user',content:'hello'}],max_tokens:20});
const seed=used=>db.records.set(key,{...db.records.get(key),ownerDailyPool:{day:new Date(time).toISOString().slice(0,10),used}});
async function request(model=astra,usage={input:100,output:50},notSent=false){
 const session=await allowance.begin({...actor,requestedModel:model});
 try{const r=await allowance.reserve(session,'shared',payload(model),price);await allowance.settle(r,usage,notSent);return r;}
 finally{await allowance.finish(session,!notSent);time+=61000;}
}
await request();await request(fable);assert.equal(pool().used,300);
await request('~openai/gpt-astra-latest');assert.equal(pool().used,450);
await request('~anthropic/claude-fable-latest');assert.equal(pool().used,600);
await request('new-vendor/new-chat');assert.equal(pool().used,600,'Other models do not consume Astra/Fable pool');
await request(astra,null,true);assert.equal(pool().used,600,'Unsent call refunded');
seed(9500);await assert.rejects(request(fable),/10,000-token daily allowance/);
const denied=await allowance.begin({uid:'other-owner',owner:true,requestedModel:'openai/gpt-6-sol'});
try{await assert.rejects(allowance.reserve(denied,'shared',payload(astra),price),e=>e.status===403);}
finally{await allowance.finish(denied,false);}
seed(8500);
const sessions=[await allowance.begin(actor),await allowance.begin({...actor,apiVerified:true})];
const results=await Promise.allSettled(sessions.map((s,i)=>allowance.reserve(s,'shared',payload(i?fable:astra),price)));
assert.equal(results.filter(r=>r.status==='fulfilled').length,1,'Shared transactional cap across API/chat and both models');
const reserved=results.find(r=>r.status==='fulfilled').value;
await allowance.settle(reserved,null,true);await allowance.settle(reserved,null,true);assert.equal(pool().used,8500);
for(const session of sessions)await allowance.finish(session,false);
time+=61000;seed(0);
const pending=await allowance.begin(actor),late=await allowance.reserve(pending,'shared',payload(astra),price);await allowance.finish(pending);
time=Date.parse('2026-09-27T00:00:01Z');await request(fable);assert.equal(pool().used,150);
await allowance.settle(late,null,true);assert.equal(pool().used,150,'Late refund cannot change next UTC day');
const reopened=createAiAllowance({db,config,now:()=>time}),session=await reopened.begin(actor);
const reservation=await reopened.reserve(session,'shared',payload(astra),price);await reopened.settle(reservation,{input:30,output:20});await reopened.finish(session,true);
assert.equal(pool().used,200,'Usage survives server restart');
console.log('PASS exact UID catalog/access, provider pricing, shared 10k daily pool, concurrency, refunds, midnight and restart persistence');
