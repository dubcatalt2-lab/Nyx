import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createAiAllowance,aiAllowanceConfig,aiModelAllowed,NYX_HAIKU_MODEL,ownerOnlyNyxModel,premiumOnlyAiModel} from '../scripture/ai-allowance.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';
const model=NYX_HAIKU_MODEL;
assert.equal(model,'anthropic/claude-haiku-5.5');
assert.equal(ownerOnlyNyxModel(model),false);
assert.equal(premiumOnlyAiModel(model),false);
const source=readFileSync('shepherd.js','utf8');
const catalogFilter=new Function('hasAppAiAllowance','nyxAiEndpoint','hasFullAiCatalog','aiCatalogPrice','aiAllowanceConfig','isFreeAiModel','freeModelHealth','process',source.slice(source.indexOf('function nyxAiBudgetCatalog('),source.indexOf('async function nyxAiAvailableModels('))+';return nyxAiBudgetCatalog;')(()=>false,()=> 'https://openrouter.ai/api/v1/chat/completions',()=>false,()=>({inputPerMillion:.1,outputPerMillion:.5}),aiAllowanceConfig,()=>false,{}, {env:{NYX_AI_DAILY_BUDGET_USD:'1'}});
assert.equal(catalogFilter([{id:model,text:true}],false,null,{}).length,1);
for(const premium of [false,true]){
 const db=memoryFirestore();let now=Date.now();
 const allowance=createAiAllowance({db,config:aiAllowanceConfig({NYX_AI_DAILY_BUDGET_USD:'10'}),now:()=>now});
 const actor={uid:'haiku-'+premium,app:'nyx',premium,createdAt:now,requestedModel:model,modelRules:[{model,access:'deny',messages:0,periodDays:4}]};
 assert(aiModelAllowed(model,actor));
 assert(!aiModelAllowed(model,{...actor,blocked:true}));
 assert(!aiModelAllowed('anthropic/claude-opus-5.5',actor));
 for(let i=0;i<2;i++){
  const session=await allowance.begin(actor),reservation=await allowance.reserve(session,'shared',{model,messages:[{role:'user',content:'Hello'}],max_tokens:100});
  assert.equal(reservation.claudePrice,null);
  await allowance.settle(reservation,{input:10,output:20});await allowance.finish(session,true);now+=61000;
 }
 const usage=await allowance.usage(actor);assert.equal(usage.tokens.used,60);assert.equal(usage.tokens.limit,premium?50000:7000);
 assert(![...db.records.keys()].some(k=>/claude-money|haiku-money|policy-/.test(k)));
 const ref='nyxAiAllowance/models-'+createHash('sha256').update(actor.uid).digest('hex'),ledger=db.records.get(ref);
 db.records.set(ref,{...ledger,pool:{...ledger.pool,used:usage.tokens.limit}});
 const session=await allowance.begin(actor);
 await assert.rejects(allowance.reserve(session,'shared',{model,messages:[{role:'user',content:'Hello'}],max_tokens:100}),/allowance is used/);
 await allowance.finish(session,false);
}
console.log('PASS Haiku 5.5 catalog visibility, universal Nyx access, shared token accounting, pool exhaustion and no separate model quota');
