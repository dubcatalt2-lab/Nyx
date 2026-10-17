import assert from 'node:assert/strict';
import express from 'express';
import {createLoremCloud} from '../lib/nyxcloud-lorem.mjs';
let clock=10_000_000,creates=0,outage=false;
const item=i=>({id:'vm-'+i,url:'https://loremgroup.org/vm/code-'+i+'/',status:'exited'});
let vms=Array.from({length:16},(_,i)=>item(i));
const state={version:1,migrated:true,sessionPolicy:2,syncedAt:0,entries:[
 ...Array.from({length:4},(_,i)=>({uid:'uncertain-'+i,status:'allocating',requestId:'request-'+i,joinedAt:clock-7200000,lastSeen:clock-3600000})),
 {uid:'waiting',status:'queued',joinedAt:clock-7200000,lastSeen:clock}
]};
const app=express();app.use('/api',createLoremCloud({key:'fixture',now:()=>clock,store:async task=>task(state,async()=>{}),firebase:async()=>({auth:{verifyIdToken:async uid=>({uid})}}),fetchImpl:async url=>{
 if(url.endsWith('/api/dev/list'))return outage?Response.json({error:'offline'},{status:503}):Response.json({vms});
 if(url.includes('/api/create?')){
  const query=new URL(url).searchParams;
  assert.equal(query.get('site_limit'),'20');assert(!query.get('owner_id').startsWith('request-'));
  assert(vms.length<20,'provider capacity must remain bounded');creates++;
  const vm=item(100+creates);vms.push(vm);return Response.json(vm);
 }
 throw Error('Unexpected mutation or provider call: '+new URL(url).pathname);
}}));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const origin='http://127.0.0.1:'+server.address().port;
async function request(uid='waiting',path='/queue',method='GET'){
 const response=await fetch(origin+'/api'+path,{method,headers:{Authorization:'Bearer '+uid,Origin:origin}});
 return {http:response.status,...await response.json()};
}
try{
 let result=await request();assert.equal(result.position,1);assert.equal(creates,0,'legacy uncertain records get a grace period');
 assert(state.entries.filter(e=>e.status==='allocating').every(e=>e.allocationStartedAt===clock));
 clock+=299000;assert.equal((await request()).status,'queued');assert.equal(creates,0);
 clock+=5100;outage=true;assert.equal((await request()).reason,'service_unavailable');assert.equal(creates,0,'no fresh inventory means no allocation');
 clock+=5100;outage=false;result=await request();assert.equal(result.status,'ready');assert.equal(creates,1,'old unresolved calls must not consume spare slots forever');
 assert(vms.slice(0,16).every((vm,i)=>vm.id==='vm-'+i),'unmapped stopped desktops stay untouched');
 assert.equal(state.entries.filter(e=>e.status==='allocating').length,4,'uncertain account ownership records remain');
 clock+=5100;assert.equal((await request('uncertain-0')).status,'recovering');
 await request('uncertain-0','/create','POST');assert.equal(creates,1,'never retry an uncertain account');
 assert.equal((await request('uncertain-0','/cancel','POST')).http,409);
                                                                     
 vms.push(item(200),item(201),item(202));
 state.entries.push({uid:'overflow',status:'queued',joinedAt:clock,lastSeen:clock});clock+=5100;
 assert.equal((await request('overflow')).status,'queued');assert.equal(creates,1);
                                                                        
 vms.pop();state.entries.push({uid:'conflict',status:'conflict',vm:vms[0],lastSeen:clock});clock+=5100;
 assert.equal((await request('overflow')).status,'ready');assert.equal(creates,2);
 console.log('PASS stale slot recovery, legacy grace, fresh inventory requirement, uncertain ownership, late completion capacity and conflict accounting');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
