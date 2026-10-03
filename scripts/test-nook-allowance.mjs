import assert from 'node:assert/strict';
import {createAiAllowance,aiAllowanceConfig,nookModelIsExpensive,aiModelAllowed} from '../lib/ai-allowance.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';
import {fullCatalogUid} from '../lib/ai-owner-catalog.mjs';
const db=memoryFirestore();let now=Date.now();
const allowance=()=>createAiAllowance({db,config:aiAllowanceConfig({NYX_AI_DAILY_BUDGET_USD:1000,NYX_AI_MONTHLY_BUDGET_USD:30000,NYX_AI_DAILY_REQUEST_BUDGET:100000}),now:()=>now});
const cheap={inputPerMillion:5,outputPerMillion:5},expensive={inputPerMillion:5.01,outputPerMillion:1};
assert(!nookModelIsExpensive(cheap));assert(nookModelIsExpensive(expensive));assert(nookModelIsExpensive({inputPerMillion:1,outputPerMillion:5.01}));assert.throws(()=>nookModelIsExpensive(null));
const actor=(uid,device='browser')=>({uid,device,network:'same-school',app:'nook',premium:true,trusted:true});
assert(aiModelAllowed('provider/any-model',actor('user')));
const payload=(model='provider/cheap')=>({model,max_tokens:2200,messages:[{role:'user',content:'Hi'}]});
async function use(uid,tokens,device='browser',price=cheap,model='provider/cheap'){
 const a=allowance(),s=await a.begin(actor(uid,device));
 try{const r=await a.reserve(s,'shared',payload(model),price);await a.settle(r,{input:10,output:tokens-10});return r;}finally{await a.finish(s,true);now+=61000;}
}
await use('main',2000);await use('alt1',2000);await use('alt2',2000);
const capped=await use('alt3',1000);assert.equal(capped.tokens,1000);
const a=allowance(),s=await a.begin(actor('alt4'));
await assert.rejects(a.reserve(s,'shared',payload(),cheap),/7,000-token/);await a.finish(s);
await use('other-user',1000,'other-browser');
now+=4*86400000;await use('alt5',500);
await use('paid-main',600,'paid-browser',expensive,'provider/paid-a');
const limited=await use('paid-alt',400,'paid-browser',expensive,'provider/paid-b');assert.equal(limited.tokens,400,'All expensive models/accounts share one device pool');
const ps=await a.begin(actor('paid-alt2','paid-browser'));await assert.rejects(a.reserve(ps,'shared',payload('provider/paid-c'),expensive),/1,000-token/);await a.finish(ps);
await use('paid-alt2',500,'paid-browser',cheap);
const refundSession=await a.begin(actor('refund','refund-device'));
const refund=await a.reserve(refundSession,'shared',payload(),cheap);await a.settle(refund,null,true);await a.settle(refund,null,true);await a.finish(refundSession);
const retry=await use('refund-alt',100,'refund-device');assert(retry.tokens>2200);
// Two accounts reserve concurrently against the same expensive budget.
const s1=await a.begin(actor('race1','race')),s2=await a.begin(actor('race2','race'));
const racing=await Promise.allSettled([a.reserve(s1,'shared',payload('provider/paid'),expensive),a.reserve(s2,'shared',payload('provider/paid'),expensive)]);
assert.equal(racing.filter(r=>r.status==='fulfilled').length,1);await a.finish(s1);await a.finish(s2);
const owner=await a.begin(actor(fullCatalogUid,'browser'));const own=await a.reserve(owner,'shared',payload(),cheap);assert(own.tokens>1000);await a.finish(owner);
assert(![...db.records.keys()].some(key=>key.includes('signup-')));
console.log('PASS Nook 7k browser pool, 1k expensive pool, strict $5 threshold, Premium catalog, unlimited account count, same-IP independence, atomic reservations, refunds, four-day reset and owner exemption');
