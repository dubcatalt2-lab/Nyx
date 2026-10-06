import assert from 'node:assert/strict';
import express from 'express';
import {createLoremCloud} from '../scripture/nyxcloud-lorem.mjs';
let state={version:1,migrated:true,sessionPolicy:2,entries:[],syncedAt:0},clock=1000000,serial=0,vms=[],mode='normal',calls=[];
let tail=Promise.resolve();
const store=task=>{const run=tail.then(()=>task(state,async()=>{}));tail=run.catch(()=>{});return run;};
const firebase=async()=>({auth:{verifyIdToken:async uid=>({uid})}});
const item=()=>({id:'vm'+(++serial),url:'https://loremgroup.org/vm/code'+serial+'/',state:'running'});
const provider=async(url,options)=>{
  calls.push(url);
  if(url.endsWith('/api/dev/list'))return Response.json({vms});
  if(url.includes('/api/create?')){
    assert.equal(new URL(url).searchParams.get('site_limit'),'20');
    if(mode==='duplicate')return Response.json(vms[0]);
    if(mode==='duplicate-url')return Response.json({...vms[0],id:'other-id'});
    if(mode==='token')return Response.json({status:'queued',token:'same-token'});
    const result=item();vms.push(result);return Response.json(result);
  }
  if(url.includes('/api/queue_status?'))return Response.json({...vms[0],status:'allocated'});
  if(url.includes('/api/delete/')){vms=vms.filter(v=>v.id!==url.split('/').pop());return Response.json({status:'success'});}
  if(url.includes('/api/start/'))return Response.json({status:'success'});
  throw Error('Unexpected provider request');
};
const app=express();app.use('/api',createLoremCloud({firebase,key:'fixture',store,fetchImpl:provider,now:()=>clock}));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const origin='http://127.0.0.1:'+server.address().port;
const req=(uid,path,method='GET')=>fetch(origin+'/api'+path,{method,headers:{Authorization:'Bearer '+uid,Origin:origin}});
const data=async(uid,path,method='GET')=>{const r=await req(uid,path,method);assert.equal(r.status,200,await r.clone().text());return r.json();};
const tick=()=>clock+=5100;
try {
  // Twenty different accounts really receive twenty distinct desktops. Extra
  // accounts wait; reopening a tab neither creates a VM nor extends its deadline.
  for(let i=0;i<21;i++)await data('account'+i,'/create','POST');
  for(let i=0;i<20;i++){tick();const result=await data('account'+i,'/queue');assert.equal(result.status,'ready');assert.equal(result.expiresAt-clock,900000);}
  assert.equal(new Set(state.entries.filter(e=>e.vm).map(e=>e.vm.url)).size,20);
  tick();assert.equal((await data('account20','/queue')).status,'queued');assert.equal(serial,20);
  const deadline=state.entries[0].expiresAt;
  await Promise.all(Array.from({length:12},()=>data('account0','/create','POST')));assert.equal(serial,20);assert.equal(state.entries[0].expiresAt,deadline);
  assert.equal((await req('account20','/start/vm1','POST')).status,404);
  // Keep other sessions active while the first one reaches its fixed deadline.
  clock=deadline;state.entries.forEach(e=>e.lastSeen=clock);await data('account20','/queue');
  assert(!vms.some(v=>v.id==='vm1'));tick();assert.equal((await data('account20','/queue')).status,'ready');
  assert.equal((await data('account0','/queue')).status,'idle');
  // A provider returning an existing id OR URL cannot attach a second account.
  state={version:1,migrated:true,sessionPolicy:2,entries:[],syncedAt:0};vms=[];mode='normal';
  await data('alice','/create','POST');tick();const alice=await data('alice','/queue');
  for(const badMode of ['duplicate','duplicate-url']){
    mode=badMode;await data('bob','/create','POST');tick();const bob=await data('bob','/queue');
    assert.equal(bob.status,'queued');assert.equal(bob.reason,'isolated_desktop_pending');assert(!JSON.stringify(bob).includes(alice.vm.url));
  }
  mode='normal';tick();const bob=await data('bob','/queue');assert.notEqual(bob.vm.url,alice.vm.url);
  // Provider queue fulfillment is subject to the same isolation check.
  mode='token';await data('carol','/create','POST');tick();await data('carol','/queue');tick();const carol=await data('carol','/queue');
  assert.equal(carol.status,'queued');assert.equal(carol.reason,'isolated_desktop_pending');
  // Existing bad mappings fail closed before returning, deleting or starting a VM.
  state.entries.push({...state.entries[0],uid:'duplicate-account'});const deletes=calls.filter(c=>c.includes('/api/delete/')).length;
  assert.equal((await data('alice','/vms')).status,'recovering');
  assert.equal((await data('duplicate-account','/vms')).vms.length,0);
  assert.equal((await req('duplicate-account','/end','POST')).status,409);
  assert.equal((await req('duplicate-account','/start/'+alice.vm.id,'POST')).status,404);
  assert.equal(calls.filter(c=>c.includes('/api/delete/')).length,deletes);
  state={version:1,entries:[],syncedAt:0};
  assert.equal((await data('3158eOj4ATMzkoC1PAm8H7TXc2R2','/vms')).vms.length,0,'fresh ledgers must not claim existing provider desktops');
  assert.equal(state.entries.length,0);
  console.log('PASS 20-account isolation, FIFO overflow, fixed 15-minute expiry, concurrent tabs, duplicate provider ids/URLs/queue results and safe historical conflicts');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}

// A preview uses the canonical queue and never accesses a second ledger/key.
let forwarded=0,unavailable=false;
const preview=express();preview.use('/api',createLoremCloud({firebase,coordinator:'https://nyxlearning.org',store:()=>{throw Error('Local ledger must not be used');},fetchImpl:async(url,options)=>{
  forwarded++;assert(url.startsWith('https://nyxlearning.org/api/nyxcloud/lorem/'));assert.equal(options.headers.Authorization,'Bearer alice');assert.equal(options.headers.Origin,'https://nyxlearning.org');assert.equal(options.headers['X-API-Key'],undefined);
  if(unavailable)throw Error('Offline');return Response.json({status:'queued',position:3});
}}));
const local=preview.listen(0,'127.0.0.1');await new Promise(r=>local.once('listening',r));const base='http://127.0.0.1:'+local.address().port;
try{
  const headers={Authorization:'Bearer alice',Origin:base};
  assert.equal((await(await fetch(base+'/api/create',{method:'POST',headers})).json()).position,3);
  unavailable=true;assert.equal((await fetch(base+'/api/vms',{headers})).status,503);
  assert.equal((await fetch(base+'/api/create',{method:'POST',headers:{...headers,Origin:'https://elsewhere.example'}})).status,403);
  assert.equal(forwarded,2);console.log('PASS canonical preview coordinator, preserved account authentication, origin validation and no local-allocation fallback');
}finally{local.closeAllConnections();await new Promise(r=>local.close(r));}
