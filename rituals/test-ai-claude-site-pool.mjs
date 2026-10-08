import assert from 'node:assert/strict';
import {createAiAllowance,aiAllowanceConfig,expensiveClaudeModel} from '../scripture/ai-allowance.mjs';
import {fullCatalogUid} from '../scripture/ai-owner-catalog.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';
const db=memoryFirestore();let now=Date.parse('2026-09-30T12:00:00Z');
const a=createAiAllowance({db,config:aiAllowanceConfig({}),now:()=>now});
const model='anthropic/claude-opus-5.5',price={inputPerMillion:4,outputPerMillion:20};
const actor=app=>({uid:'member',app,owner:app==='nyx',device:'workspace',premium:true,trusted:true});
const payload=(id=model)=>({model:id,messages:[{role:'user',content:'hi'}],max_tokens:1200});
async function session(app='nyx',extra={}){return a.begin({...actor(app),...extra});}
assert(expensiveClaudeModel('anthropic/claude-fable-5.1',price));
assert(expensiveClaudeModel('~anthropic/claude-fable-latest',price));
assert(!expensiveClaudeModel('anthropic/claude-haiku-test',{inputPerMillion:1,outputPerMillion:3}));
assert(!expensiveClaudeModel('openai/gpt-test',price));
const s=await session(),r=await a.reserve(s,'shared',payload(),price);
await a.settle(r,{input:10,output:10,cost:.049});await a.finish(s,true);now+=61000;
const second=await session(),short=payload();const held=await a.reserve(second,'shared',short,price);
assert(short.max_tokens>0&&short.max_tokens<1200,'Fit output to remaining dollars');
assert(db.records.get(second.refs.claude.path).used<=50000);
await a.settle(held,{input:1,output:1,cost:.001});await a.finish(second,true);now+=61000;
const exhausted=await session();await assert.rejects(a.reserve(exhausted,'shared',payload(),price),/\$0\.05/);await a.finish(exhausted);
for(const app of ['tutsi','nook','drop']){
 const other=await session(app),request=payload();const value=await a.reserve(other,'shared',request,price);
 assert.notEqual(other.refs.claude.path,s.refs.claude.path);
 if(app==='drop')assert(value.tokens<=500);
 if(app==='nook')assert(value.tokens<=1000);
 await a.settle(value,null,true);assert.equal(db.records.get(other.refs.claude.path).used,0);
 await a.settle(value,{input:99,output:99,cost:.5});assert.equal(db.records.get(other.refs.claude.path).used,0,'Idempotent refund');
 await a.finish(other);now+=61000;
}
const independent=await session('nyx',{uid:'another'}),own=await a.reserve(independent,'shared',payload(),price);
await a.settle(own,null,true);await a.finish(independent);
now+=4*86400000;
const fresh=await session(),freshReservation=await a.reserve(fresh,'shared',payload(),price);
assert(db.records.get(fresh.refs.claude.path).used>0);
await a.finish(fresh);
now+=4*86400000;
const next=await session(),nextReservation=await a.reserve(next,'shared',payload(),price);
const before=db.records.get(next.refs.claude.path).used;
await a.settle(freshReservation,null,true);assert.equal(db.records.get(next.refs.claude.path).used,before,'Late refund preserves new window');
await a.settle(nextReservation,null);assert.equal(db.records.get(next.refs.claude.path).used,before,'Unknown cost retains reservation');await a.finish(next);
const owner=await session('nyx',{uid:fullCatalogUid});await a.reserve(owner,'shared',payload(),price);assert(!db.records.has(owner.refs.claude.path));await a.finish(owner);
// Different API/chat account ledgers still reserve the same per-site money pool.
const chat=await session('tutsi',{uid:'parallel'}),api=await session('tutsi',{uid:'parallel',apiVerified:true});
const results=await Promise.all([a.reserve(chat,'shared',payload(),price),a.reserve(api,'shared',payload(),price)]);
assert.equal(chat.refs.claude.path,api.refs.claude.path);
assert(db.records.get(chat.refs.claude.path).used<=50000);
for(const value of results){await a.settle(value,null,true);await a.finish(value.session);}
console.log('PASS Claude $0.05 pools: site/account isolation, output fitting, token caps, costs, unknown usage, refunds, reset, concurrency and owner exemption.');
