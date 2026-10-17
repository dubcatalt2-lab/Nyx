import assert from 'node:assert/strict';
import express from 'express';
import {createLoremCloud} from '../lib/nyxcloud-lorem.mjs';

let clock=1_000_000, creates=0;
const state={version:1,migrated:true,sessionPolicy:2,syncedAt:0,entries:[
  {uid:'reserved',status:'provider',token:'fixture-token',joinedAt:clock-2000,lastSeen:clock},
  {uid:'waiting',status:'queued',joinedAt:clock-1000,lastSeen:clock}
]};
const app=express();app.use('/api',createLoremCloud({capacity:2,key:'fixture',now:()=>clock,
  store:async task=>task(state,async()=>{}),firebase:async()=>({auth:{verifyIdToken:async uid=>({uid})}}),
  fetchImpl:async url=>{
    if(url.endsWith('/api/dev/list'))return Response.json({vms:creates?[{id:'new',url:'https://loremgroup.org/vm/new/'}]:[]});
    if(url.includes('/api/queue_status?'))return Response.json({status:'queued',position:1});
    if(url.includes('/api/create?')){creates++;return Response.json({id:'new',url:'https://loremgroup.org/vm/new/'});}
    throw Error('Unexpected provider call');
  }}));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base='http://127.0.0.1:'+server.address().port;
const request=async()=>{const r=await fetch(base+'/api/queue',{headers:{Authorization:'Bearer waiting'}});assert.equal(r.status,200);return r.json();};
try{
  assert.equal((await request()).status,'ready','Polling another reservation must not starve a waiter when capacity remains');
  assert.equal(creates,1);
  state.entries.push({uid:'overflow',status:'queued',joinedAt:clock,lastSeen:clock});
  clock+=5100;await request();assert.equal(creates,1,'The outstanding provider reservation still consumes capacity');
  assert.equal(state.entries.find(e=>e.uid==='reserved').token,'fixture-token');
  console.log('PASS pending provider polling permits new allocations without overbooking or losing reservations.');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
