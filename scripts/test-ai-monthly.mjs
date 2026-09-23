import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAiAllowance,aiAllowanceConfig,aiTokenPoolUsage} from '../lib/ai-allowance.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';
const db=memoryFirestore();let time=Date.parse('2026-09-29T12:00:00Z');
const a=createAiAllowance({db,config:aiAllowanceConfig({}),now:()=>time});
const member={uid:'member',createdAt:Date.parse('2026-08-01T00:00:00Z')},premium={...member,uid:'premium',premium:true},owner={...member,uid:'owner',owner:true};
const path=(actor,prefix='models')=>'nyxAiAllowance/'+prefix+'-'+createHash('sha256').update(actor.uid).digest('hex');
const gemini='google/gemini-2.5-flash-lite',deepseek='deepseek/deepseek-v4.1-flash',qwen='qwen/qwen3.7-flash',luna='openai/gpt-5.6-luna';
const payload=model=>({model,messages:[{role:'user',content:'Hello'}],max_tokens:100});
async function call(actor,model,usage={input:50,output:50}){const s=await a.begin(actor);try{const r=await a.reserve(s,'shared',payload(model));await a.settle(r,usage);return r;}finally{await a.finish(s);time+=61000;}}
for(const actor of [member,premium]){
 for(const model of [gemini,deepseek,...(actor.premium?[qwen,'inception/mercury-2.5',luna]:[])])await call(actor,model);
 const ledger=db.records.get(path(actor));assert.equal(ledger.pool.used,actor.premium?500:200,'Different models debit one pool');
 ledger.pool.used=actor.premium?50000:10000;
 for(const model of [gemini,deepseek,...(actor.premium?[qwen,'inception/mercury-2.5',luna]:[])])await assert.rejects(call(actor,model),/shared (10,000|50,000)-token pool/);
}
const firstReset=db.records.get(path(member)).pool.resetAt;
assert.equal(firstReset,Date.parse('2026-10-03T12:00:00Z'),'Regular period is 4 days from first request');
assert.equal(db.records.get(path(premium)).pool.resetAt-db.records.get(path(premium)).pool.start,4*86400000);
time=Date.parse('2026-10-01T00:01:00Z');
await assert.rejects(call(member,gemini),/shared (10,000|50,000)-token pool/);
await assert.rejects(call(premium,luna),/shared 50,000-token pool/);
const premiumReset=db.records.get(path(premium)).pool.resetAt;
await call({...member,premium:true},luna);assert.equal(db.records.get(path(member)).pool.used,10100,'Upgrade increases cap while preserving usage');
await assert.rejects(call(member,gemini),/shared 10,000-token pool/);
assert.equal(db.records.get(path(member)).pool.resetAt,firstReset,'Changing tier does not refill or move running pool');
time=firstReset-1;const s=await a.begin(member);await assert.rejects(a.reserve(s,'shared',payload(gemini)),/shared (10,000|50,000)-token pool/);await a.finish(s);
time=firstReset;await call(member,gemini);assert.equal(db.records.get(path(member)).pool.used,100);assert.equal(db.records.get(path(member)).pool.resetAt,firstReset+4*86400000);
time=premiumReset;await call(premium,luna);assert.equal(db.records.get(path(premium)).pool.used,100,'Premium resets after 4 days');
// Reservations and settlement remain correct across calendar boundaries within a four-days.
const crossing={...member,uid:'crossing'};time=Date.parse('2026-10-31T23:59:59Z');const pending=await a.begin(crossing),r=await a.reserve(pending,'shared',payload(deepseek));await a.finish(pending);
time=Date.parse('2026-11-01T00:00:01Z');await call(crossing,gemini);await a.settle(r,null,true);await a.settle(r,null,true);assert.equal(db.records.get(path(crossing)).pool.used,100,'Cross-month refunds apply once to same four-days');
// An old response cannot debit the next four-days.
time=db.records.get(path(crossing)).pool.resetAt-1000;const old=await a.begin(crossing),oldR=await a.reserve(old,'shared',payload(gemini));await a.finish(old);
time+=2000;await call(crossing,gemini);await a.settle(oldR,null,true);assert.equal(db.records.get(path(crossing)).pool.used,100);
const migration={...premium,uid:'migration'};db.records.set(path(migration,'premium'),{month:'2026-11',tokens:4000,legacyTokens:0,modelTokens:{luna:2000,gemini:2000}});db.records.set(path(migration),{month:'2026-11',tokens:{[deepseek]:1000}});
await call(migration,qwen);assert.equal(db.records.get(path(migration)).pool.used,5100);await call(migration,gemini);assert.equal(db.records.get(path(migration)).pool.used,5200,'Legacy usage migrates once, without double counting');
for(const model of [gemini,luna,deepseek,qwen])await call(owner,model,{input:10000,output:10000});assert.equal(db.records.has(path(owner)),false,'Owner exempt from pooled cap');
const race={...premium,uid:'race'};await call(race,qwen);db.records.get(path(race)).pool.used=48500;
const one=await a.begin(race),two=await a.begin({...race,apiVerified:true});
const results=await Promise.allSettled([a.reserve(one,'shared',payload(gemini)),a.reserve(two,'shared',payload(gemini))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1,'Different models/API sessions cannot double-spend pool');
for(const result of results)if(result.status==='fulfilled')await a.settle(result.value,null,true);await a.finish(one);await a.finish(two);
assert.equal(aiTokenPoolUsage(db.records.get(path(race)),{},race,time).remaining,1500);
console.log('PASS: shared cross-model pools, 4-day regular reset, 4-day Premium reset, tier changes, cross-month settlement, refunds, legacy migration, owner exemption and concurrent API/chat reservations');

const start=Date.parse('2026-09-01T00:00:00Z'),day=86400000;
const oldPool={pool:{start,resetAt:start+14*day,period:'fortnight',used:3000,images:2}};
const migrated=aiTokenPoolUsage(oldPool,{},member,start+2*day);
assert.equal(migrated.resetAt,start+4*day);assert.equal(migrated.used,3000);assert.equal(migrated.images,2);
assert.equal(aiTokenPoolUsage(oldPool,{},member,start+4*day).used,0);
assert.equal(aiTokenPoolUsage(oldPool,{},member,start+4*day).images,0);
console.log('PASS: existing 14-day windows shorten from original start, preserve usage, and reset after four days.');
