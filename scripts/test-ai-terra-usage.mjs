import assert from 'node:assert/strict';
import {createAiAllowance,aiAllowanceConfig,aiModelAllowed} from '../lib/ai-allowance.mjs';
import {aiBudgetResponse} from '../lib/ai-budget-response.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';

const model='openai/gpt-6.1-terra';
for(const premium of [false,true]){
  const actor={uid:'terra-member',premium,app:'nyx',requestedModel:model};
  assert(aiModelAllowed(model,actor));
  assert(!aiModelAllowed(model,{...actor,blocked:true}));
  assert(!aiModelAllowed(model,{...actor,modelRules:[{model,access:'deny'}]}));
  const a=createAiAllowance({db:memoryFirestore(),config:aiAllowanceConfig({NYX_AI_DAILY_BUDGET_USD:'1'})});
  const session=await a.begin(actor);
  const r=await a.reserve(session,'shared',{model,messages:[{role:'user',content:'Hello'}],max_tokens:2200});
  assert(r.price,'Terra has verified configured pricing for regular members');
  assert(r.tokens>40);
  // Separate input/output reports and repeated cumulative chunks must not retain
  // the max-output reservation or count the same provider tokens twice.
  const events=[{message:{usage:{input_tokens:30}}},{choices:[{delta:{content:'Hi'}}]},
    {usage:{output_tokens:10}},{usage:{output_tokens:10}}];
  const response=new Response(events.map(v=>'data: '+JSON.stringify(v)+'\n\n').join('')+'data: [DONE]\n\n',
    {headers:{'content-type':'text/event-stream'}});
  await aiBudgetResponse(response,usage=>a.settle(r,usage)).text();
  await a.finish(session,true);
  const result=await a.usage(actor);
  assert.equal(result.tokens.limit,premium?140000:50000);
  assert.equal(result.tokens.used,40);
  assert.equal(result.tokens.pending,0);
  assert.equal(result.tokens.remaining,result.tokens.limit-40);
}
console.log('PASS Terra regular/premium access, restrictions, pricing and split/repeated usage settlement: 40 actual tokens, no leftover reservation');
