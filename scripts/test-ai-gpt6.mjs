import assert from 'node:assert/strict';
import {aiModelAllowed,aiAllowanceConfig,createAiAllowance,AI_JOIN_CUTOFF} from '../lib/ai-allowance.mjs';
import {validateAiModelRules} from '../lib/ai-model-policy.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';
const luna='openai/gpt-6-luna',sol='openai/gpt-6-sol';
const rule=model=>validateAiModelRules([{model,access:'allow',messages:5,periodDays:4}]);
const db=memoryFirestore(),allowance=createAiAllowance({db,config:aiAllowanceConfig({NYX_AI_DAILY_BUDGET_USD:'10'})});
for(const extra of [{},{premium:true},{coOwner:true},{trusted:true},{apiVerified:true},{modelRules:rule(sol)}]) {
  const actor={uid:'denied',createdAt:AI_JOIN_CUTOFF-1,...extra};
  assert.equal(aiModelAllowed(sol,actor),false);
  await assert.rejects(allowance.begin({...actor,requestedModel:sol}),/not enabled/);
  // Forged model changes must also fail at reservation, before provider use.
  const session=await allowance.begin({...actor,uid:'denied-'+JSON.stringify(extra)});
  try {await assert.rejects(allowance.reserve(session,'shared',{model:sol,messages:[{role:'user',content:'test'}],max_tokens:20}),/not enabled/);}
  finally {await allowance.finish(session,false);}
}
for(const [model,owner,rates] of [[luna,false,{prompt:0.1,completion:0.5}],[sol,true,{prompt:2,completion:10}],['openai/gpt-6-luna-pro',false,{prompt:0.1,completion:0.5}],['anthropic/claude-opus-5.5',false,{prompt:4,completion:20}]]) {
  const actor={uid:model,createdAt:AI_JOIN_CUTOFF-1,owner,premium:['anthropic/claude-opus-5.5','openai/gpt-6-luna-pro'].includes(model),requestedModel:model};
  assert(aiModelAllowed(model,actor));
  assert(!aiModelAllowed(model,{...actor,modelRules:[{model,access:'deny'}]}));
  const session=await allowance.begin(actor);
  const payload={model,messages:[{role:'user',content:'fixture'}],max_tokens:20};
  try {
    const reservation=await allowance.reserve(session,'shared',payload);
    assert.deepEqual(payload.provider.max_price,rates);
    assert(reservation.reserved>0,'Paid requests reserve spending');
    await allowance.settle(reservation,null,true);
  } finally {await allowance.finish(session,false);}
}
console.log('PASS GPT-6 Luna access, strict owner-only Sol, forged request rejection, paid caps and refunds.');
