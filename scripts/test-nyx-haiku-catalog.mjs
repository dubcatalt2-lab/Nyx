import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {aiAllowanceConfig,nyxHaikuModel,aiModelAllowed,hasAppAiAllowance} from '../lib/ai-allowance.mjs';
const s=await readFile('server.js','utf8'),a=s.indexOf('function nyxAiBudgetCatalog('),b=s.indexOf('\nasync function nyxAiAvailableModels',a);
const filter=vm.runInNewContext('('+s.slice(a,b)+')',{URL,process:{env:{NYX_AI_DAILY_BUDGET_USD:'1'}},aiAllowanceConfig,nyxHaikuModel,hasAppAiAllowance,hasFullAiCatalog:()=>false,nyxAiEndpoint:()=> 'https://openrouter.ai/api/v1/chat/completions',aiCatalogPrice:m=>m.price||null,isFreeAiModel:()=>false,freeModelHealth:{available:()=>true},fableTrialActive:()=>false});
const model={id:'anthropic/claude-haiku-5.5',text:true,price:{inputPerMillion:.1,outputPerMillion:.5}};
for(const actor of [{uid:'regular'},{uid:'regular',app:'nyx'},{uid:'premium',app:'nyx',premium:true}]){assert.equal(filter([model],false,{id:'custom-shared'},actor).length,1);assert(aiModelAllowed(model.id,actor,model.price));}
console.log('PASS regular and premium Haiku catalog visibility, including non-default provider IDs');
