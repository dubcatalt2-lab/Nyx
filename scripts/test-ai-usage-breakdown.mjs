import assert from 'node:assert/strict';
import {aiBudgetResponse} from '../lib/ai-budget-response.mjs';
const events=[{usage:{prompt_tokens:750,prompt_tokens_details:{cached_tokens:300}}},{choices:[{delta:{content:'Hello'}}]}, {usage:{completion_tokens:150,completion_tokens_details:{reasoning_tokens:100}}},{usage:{prompt_tokens:750,completion_tokens:150,completion_tokens_details:{reasoning_tokens:100}}}];
const source=events.map(e=>'data: '+JSON.stringify(e)+'\n\n').join('')+'data: [DONE]\n\n';
let captured;const response=aiBudgetResponse(new Response(source,{headers:{'Content-Type':'text/event-stream'}}),usage=>{captured=usage;});
assert.equal(await response.text(),source);
assert.equal(captured.input,750);assert.equal(captured.output,150);assert.equal(captured.reasoning,100);assert.equal(captured.cached,300);
assert.equal(captured.input+captured.output,900,'Reasoning and cached input are included, never charged twice');
console.log('PASS split cumulative provider usage, cached/reasoning subsets and unchanged streamed content.');
