import assert from 'node:assert/strict';
import {createAiAllowance,aiAllowanceConfig,aiModelAllowed,NOOK_HAIKU_MODEL as model} from '../lib/ai-allowance.mjs';
import {fullCatalogUid} from '../lib/ai-owner-catalog.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';
const db=memoryFirestore();let now=Date.now();
const a=createAiAllowance({db,config:aiAllowanceConfig({}),now:()=>now});
const price={inputPerMillion:1,outputPerMillion:5};
const actor=(uid,premium=false)=>({uid,premium,app:'nook',device:uid,trusted:true,requestedModel:model});
const payload=()=>({model,messages:[{role:'user',content:'Hello'}],max_tokens:1200});
assert(aiModelAllowed(model,actor('member'),price));
for(const app of ['nyx','tutsi','drop'])assert(!aiModelAllowed(model,{uid:'member',app},price));
assert(!aiModelAllowed(model,{...actor('member'),blocked:true},price));
assert(!aiModelAllowed(model,{...actor('member'),modelRules:[{model,access:'deny'}]},price));
assert(!aiModelAllowed('anthropic/claude-opus-5.5',actor('member'),price));
for(const [uid,premium,limit] of [['member',false,.05],['premium',true,.5]]){
 const who=actor(uid,premium),s=await a.begin(who),r=await a.reserve(s,'shared',payload(),price);
 await a.settle(r,{input:10,output:10,cost:limit-.001});await a.finish(s,true);now+=61000;
 const again=await a.begin(who),request=payload(),fitted=await a.reserve(again,'shared',request,price);
 assert(request.max_tokens>0&&request.max_tokens<1200);assert(db.records.get(again.refs.haiku.path).used<=limit*1e6);
 await a.settle(fitted,{input:1,output:1,cost:.001});await a.finish(again,true);now+=61000;
 const exhausted=await a.begin({...who,device:uid+'-another-browser'});
 await assert.rejects(a.reserve(exhausted,'shared',payload(),price),error=>error.status===429&&error.message.includes('$'+limit.toFixed(2)));
 await a.finish(exhausted);
 const usage=await a.nookUsage(who);assert.equal(usage.haiku.limitUsd,limit);assert.equal(usage.haiku.remainingUsd,0);
 assert.equal(db.records.has(s.refs.claude.path),false,'Haiku does not spend the expensive Claude pool');
}
now+=4*86400000;
const fresh=await a.begin(actor('member')),held=await a.reserve(fresh,'shared',payload(),price);
await a.settle(held,null,true);await a.settle(held,{input:5000,output:5000,cost:1});await a.finish(fresh);
assert.equal((await a.nookUsage(actor('member'))).haiku.usedUsd,0,'Refund is idempotent');
const upgraded=await a.begin(actor('premium',false));const unknown=await a.reserve(upgraded,'shared',payload(),price);await a.settle(unknown,null);await a.finish(upgraded);
assert((await a.nookUsage(actor('premium',false))).haiku.usedUsd>0,'Unknown usage retains its reservation');
const owner=await a.begin(actor(fullCatalogUid));await a.reserve(owner,'shared',payload(),price);await a.finish(owner);
assert.equal((await a.nookUsage(actor(fullCatalogUid))).haiku.limitUsd,null);assert(!db.records.has(owner.refs.haiku.path));
// Existing token limits still apply alongside the new money pool.
const limited=await a.begin(actor('limited'));db.records.set(limited.refs.device.path,{pool:{start:now,resetAt:now+86400000,used:7000,expensiveUsed:0}});
await assert.rejects(a.reserve(limited,'shared',payload(),price),/7,000-token/);await a.finish(limited);
console.log('PASS Nook Haiku access, $0.05/$0.50 caps, account/device isolation, fitting, costs, refunds, reset, owner and existing token caps');
