import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAiAllowance,aiAllowanceConfig} from '../lib/ai-allowance.mjs';
import {aiBudgetResponse} from '../lib/ai-budget-response.mjs';
import {aiConfigureChatWeb} from '../lib/ai-web.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';

const source=readFileSync(new URL('../server.js',import.meta.url),'utf8');
const system=source.split('  const system = `')[1].split('`;')[0].replace('${responseGuidance}','Give a balanced answer with enough explanation to be useful without unnecessary length.');
const model='deepseek/deepseek-fixture';
const price={inputPerMillion:3,outputPerMillion:4};
const payload=(message='Hello')=>({model,messages:[{role:'system',content:system},{role:'user',content:message}],max_tokens:1200});
function setup(app){
 const db=memoryFirestore();let time=Date.parse('2026-09-30T12:00:00Z');
 const a=createAiAllowance({db,config:aiAllowanceConfig({NYX_AI_DAILY_BUDGET_USD:'1',NYX_AI_MODEL_PRICES_JSON:JSON.stringify({['shared:'+model]:price})}),now:()=>time});
 const actor={uid:'member',device:'browser',trusted:true,...(['drop','nook'].includes(app)?{app}:{})};
 return {a,db,actor,advance:()=>time+=61000};
}
for(const app of ['nyx','tutsi','nook','drop']){
 const {a,db,actor,advance}=setup(app);
 const s=await a.begin(actor),r=await a.reserve(s,'shared',payload(),price);
 const spendBefore=db.records.get('nyxAiAllowance/global').monthMoney;
 const error=aiBudgetResponse(Response.json({error:{message:'Provider unavailable'}},{status:503}),async(usage,success,images,_answer,details)=>{
  assert.equal(success,false);
  await a.settle(r,usage,false,images,{refundTokens:details?.refundTokens});
 });
 await error.text();await a.finish(s,false);
 const pool=app==='nook'?db.records.get(s.refs.device.path).pool:db.records.get(s.refs.models.path).pool;
 assert.equal(pool.used,0,`${app}: a rejected request without any generated answer must not spend user tokens`);
 assert.equal(db.records.get(s.refs.account.path).requests,0,`${app}: failed requests must not consume the daily message allowance`);
 assert.equal(db.records.get('nyxAiAllowance/global').monthMoney,spendBefore,'Unknown provider costs must still retain the monetary reservation');
 advance();const retry=await a.begin(actor);await a.reserve(retry,'shared',payload(),price);await a.finish(retry,false);
}
for(const app of ['nyx','tutsi']){
 const {a,db,actor,advance}=setup(app);
 const first=await a.begin(actor),initial=await a.reserve(first,'shared',payload(),price);
 await a.settle(initial,{input:1500,output:1500});await a.finish(first,true);advance();
 const session=await a.begin(actor),request=payload('Search current news');
 aiConfigureChatWeb(request,{supportedParameters:['tools','reasoning']},'Search current news');
 const result=await a.reserve(session,'shared',request,price);
 assert(result.tokens<=4000,`${app}: a bounded web request must fit the 4k still available`);
 assert(request.max_tokens>0);
 await a.settle(result,{input:700,output:100});await a.finish(session,true);
 assert.equal(db.records.get(session.refs.models.path).pool.used,3800,'Only actual usage remains charged');
}
let result;
const partial='data: {"choices":[{"delta":{"content":"Partial answer"}}]}\n\ndata: {"error":{"message":"Provider stopped"}}\n\n';
await aiBudgetResponse(new Response(partial,{headers:{'content-type':'text/event-stream'}}),(...args)=>{result=args;}).text();
assert.equal(result[4].refundTokens,false,'Partial answers and uncertain interrupted inference must not become a token refund loophole');
console.log('PASS failed-answer token refunds, retained monetary safety, daily-message refunds, 3k/7k remaining output fit and partial-answer accounting across all four apps');
