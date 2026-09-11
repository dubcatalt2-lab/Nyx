import assert from 'node:assert/strict';
import {memoryFirestore} from './test-ai-allowance.mjs';
import {createOpenRouterBalanceGuard,createOpenRouterOwnerStatus,AI_UNAVAILABLE} from '../lib/openrouter-balance.mjs';

let now=Date.now(),balance=.1,keyLimit=null,broken=false;
const db=memoryFirestore(),credentials=[];
const options={db,managementKey:'management-fixture',now:()=>now,fetchImpl:async(url,init)=>{
  credentials.push([url,init.headers.authorization]);
  if(broken)return new Response('broken',{status:503});
  return new Response(JSON.stringify({data:url.endsWith('/credits')?{total_credits:balance,total_usage:0}:{limit_remaining:keyLimit}}));
}};
const guard=createOpenRouterBalanceGuard(options);
const claim=amount=>guard.reserve({key:'inference-fixture',amount});
const denied=p=>assert.rejects(p,e=>e.status===503&&e.message===AI_UNAVAILABLE);
await denied(claim(0));balance=-.01;await denied(claim(1));
balance=.11;await denied(claim(10000)); // Reserving ten thousand microdollars would touch the floor.
const results=await Promise.allSettled([claim(6000),createOpenRouterBalanceGuard(options).reserve({key:'inference-fixture',amount:6000})]);
assert.equal(results.filter(r=>r.status==='fulfilled').length,1,'Processes/models must share pending cost reservations');
await denied(claim(6000));
balance=.2;await claim(6000); // Refilled balance resumes without restarting.
keyLimit=.1;await denied(claim(1));keyLimit=null;
broken=true;await denied(claim(1));broken=false;
balance=.11;now+=300001;await claim(6000);
const controller=new AbortController();controller.abort();await denied(guard.reserve({key:'inference-fixture',amount:1,signal:controller.signal}));
await denied(createOpenRouterBalanceGuard({...options,managementKey:''}).reserve({key:'inference-fixture',amount:1}));
const malformed=createOpenRouterBalanceGuard({...options,fetchImpl:async()=>new Response('{"data":{}}')});await denied(malformed.reserve({key:'inference-fixture',amount:1}));
assert.ok(credentials.filter(([url])=>url.endsWith('/credits')).every(([,key])=>key==='Bearer management-fixture'));
assert.ok(credentials.filter(([url])=>url.endsWith('/key')).every(([,key])=>key==='Bearer inference-fixture'));
console.log('PASS: ten-cent floor, estimated next cost, shared reservations, key cap, refills, failed checks, cancellation and credential separation');

let statusBalance=.5,statusKey=null,statusNow=100000,statusBroken=false,statusCalls=0;
const ownerStatus=createOpenRouterOwnerStatus({now:()=>statusNow,credentials:()=>({key:'inference',managementKey:'management'}),fetchImpl:async url=>{
  statusCalls++;
  if(statusBroken)throw new Error('private upstream details');
  return new Response(JSON.stringify({data:url.endsWith('/credits')?{total_credits:statusBalance,total_usage:0}:{limit_remaining:statusKey}}));
}});
assert.equal((await ownerStatus()).state,'ok');
await Promise.all([ownerStatus(),ownerStatus()]);assert.equal(statusCalls,2,'Owner polling shares a bounded cache');
statusNow+=30001;statusBalance=.499999;assert.equal((await ownerStatus()).state,'low');
statusNow+=30001;statusBalance=.1;assert.equal((await ownerStatus()).state,'paused');
statusNow+=30001;statusBalance=10;statusKey=.49;assert.equal((await ownerStatus()).state,'low');
statusNow+=30001;statusKey=null;assert.equal((await ownerStatus()).state,'ok');
statusNow+=30001;statusBroken=true;assert.deepEqual(await ownerStatus(),{state:'unknown',checkedAt:statusNow});
console.log('PASS: owner balance thresholds, key allowance, refills, caching and sanitized failures');
