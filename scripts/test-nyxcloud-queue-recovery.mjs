import assert from 'node:assert/strict';
import express from 'express';
import {createLoremCloud} from '../lib/nyxcloud-lorem.mjs';
let clock=10_000_000,state,mode='missing',creates=0;
const queued=(uid,age=0)=>({uid,status:'queued',joinedAt:clock-1000,lastSeen:clock-age,queueTier:'regular'});
const reset=()=>{state={version:1,migrated:true,sessionPolicy:2,syncedAt:0,entries:[]};creates=0;};
reset();
const app=express();app.use('/api',createLoremCloud({key:'fixture',now:()=>clock,store:async task=>task(state,async()=>{}),firebase:async()=>({auth:{verifyIdToken:async uid=>({uid})}}),fetchImpl:async url=>{
 if(url.endsWith('/api/dev/list'))return mode==='list-outage'?Response.json({error:'unavailable'},{status:503}):Response.json({vms:[]});
 if(url.includes('/api/queue_cancel?')||url.includes('/api/queue_status?')){
  if(mode==='outage')return Response.json({error:'unavailable'},{status:503});
  if(mode==='auth')return Response.json({error:'unauthorized'},{status:401});
  if(mode==='route-missing')return Response.json({error:'HTTP_EXCEPTION',message:'Not Found'},{status:404});
  return Response.json({error:'HTTP_EXCEPTION',message:url.includes('/queue_status?')?'Queue token not found or already expired':'Token not found',details:{}},{status:404});
 }
 if(url.includes('/api/create?')){creates++;return Response.json({id:'new-vm',url:'https://loremgroup.org/vm/new-code/'});}
 throw Error('Unexpected request');
}}));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
async function request(uid='waiting',path='/queue',method='GET'){
 const response=await fetch(base+'/api'+path,{method,headers:{Authorization:'Bearer '+uid,Origin:base}});assert.equal(response.status,200);return response.json();
}
try{
 state.entries=[{...queued('abandoned',3_000_000),status:'provider',token:'expired-token'},queued('old',3_000_000),queued('waiting')];
 let result=await request();assert.equal(result.reason,'capacity');assert.equal(result.position,1);assert.equal(state.entries.length,1,'expired reservation and abandoned waiters must leave the line');
 clock+=5100;result=await request();assert.equal(result.status,'ready');assert.equal(creates,1);
 reset();state.entries=[{...queued('waiting'),status:'provider',token:'expired-token',providerPosition:1}];
 const joinedAt=state.entries[0].joinedAt;
 result=await request();assert.equal(result.reason,'capacity');assert.equal(state.entries[0].status,'queued');assert.equal(state.entries[0].joinedAt,joinedAt);assert.equal(result.providerPosition,null);
 clock+=5100;assert.equal((await request()).status,'ready');
 reset();state.entries=[{...queued('waiting'),status:'provider',token:'expired-token'}];
 assert.equal((await request('waiting','/cancel','POST')).status,'cancelled');assert.equal(state.entries.length,0);
 for(const problem of ['outage','auth','route-missing','list-outage']){
  reset();mode=problem;state.entries=[{...queued('abandoned',3_000_000),status:'provider',token:'unconfirmed-token'},queued('old',3_000_000),queued('waiting')];
  result=await request();assert.equal(result.reason,'service_unavailable');assert(!state.entries.some(e=>e.uid==='old'),'local cleanup must survive remote failures');assert.equal(state.entries.find(e=>e.uid==='abandoned').token,'unconfirmed-token');assert.equal(creates,0);
 }
 reset();mode='missing';state.entries=[{...queued('uncertain',3_000_000),status:'allocating',requestId:'private-request'},queued('waiting')];
 await request();assert(state.entries.some(e=>e.status==='allocating'),'uncertain allocations remain protected');
 console.log('PASS expired provider tokens, preserved arrival order, cancellation, abandoned waiter cleanup during outages, and protected uncertain reservations.');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
