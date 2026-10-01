import assert from 'node:assert/strict';
import {aiModelAllowed,premiumOnlyAiModel,aiAllowanceConfig,createAiAllowance} from '../lib/ai-allowance.mjs';
import {fullCatalogUid} from '../lib/ai-owner-catalog.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';
const costly={inputPerMillion:1,outputPerMillion:10},cheap={inputPerMillion:1,outputPerMillion:2};
for(const app of ['nyx','tutsi','nook','drop']){
  for(const model of ['anthropic/claude-haiku-test','anthropic/claude-opus-5.5','~anthropic/claude-fable-latest','openai/gpt-6-astra-pro','~openai/gpt-astra-latest','google/gemini-expensive']){
    const actor={uid:'member',app,device:'browser',trusted:true,coOwner:true,modelRules:[{model,access:'allow'}]};
    assert(!aiModelAllowed(model,actor,costly),app+model);
    assert(aiModelAllowed(model,{...actor,premium:true},costly));
    assert(aiModelAllowed(model,{uid:fullCatalogUid,app},costly));
    assert(!aiModelAllowed(model,{...actor,premium:true,blocked:true},costly));
  }
  const a=createAiAllowance({db:memoryFirestore(),config:aiAllowanceConfig({})});
  await assert.rejects(a.begin({uid:'member',app,device:'browser',requestedModel:'anthropic/claude-opus-5.5'}),e=>e.status===403);
  const session=await a.begin({uid:'member',app,device:'browser',trusted:true});
  await assert.rejects(a.reserve(session,'shared',{model:'google/gemini-expensive',messages:[{role:'user',content:'Hi'}]},costly),e=>e.status===403);
  await a.finish(session);
  assert(aiModelAllowed('google/gemini-cheap',{uid:'member',app},cheap));
}
assert(premiumOnlyAiModel('new/model',{inputPerMillion:10,outputPerMillion:0}));
assert(!premiumOnlyAiModel('new/model',{inputPerMillion:9.99,outputPerMillion:9.99}));
assert(premiumOnlyAiModel('new/model',{inputPerMillion:5.01,outputPerMillion:0},'nook'));
assert(!premiumOnlyAiModel('new/model',{inputPerMillion:5,outputPerMillion:5},'nook'));
console.log('PASS Premium gates across four sites, named aliases, pricing boundaries, owner, blocked, trust/rule bypass and direct reservations.');
