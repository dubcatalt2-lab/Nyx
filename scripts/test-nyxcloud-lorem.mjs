import assert from 'node:assert/strict';
import express from 'express';
import {createLoremCloud,desktopUrl} from '../lib/nyxcloud-lorem.mjs';
import {nyxCloudOwnerUid} from '../lib/nyxcloud-access.mjs';
assert.equal(desktopUrl('https://evil.example/vm/a/'),'');
assert.equal(desktopUrl('https://loremgroup.org/vm/a/?key=secret'),'');
assert.equal(desktopUrl('https://loremgroup.org/vm/a/'),'https://loremgroup.org/vm/a/');
let vms=[],calls=[],clock=100000;
const app=express();app.use(express.json());
app.use('/api',createLoremCloud({key:'private-test-key',now:()=>clock,firebase:async()=>({auth:{verifyIdToken:async t=>({uid:t==='owner'?nyxCloudOwnerUid:'other'})}}),fetchImpl:async(url,options)=>{
  assert.equal(options.headers['X-API-Key'],'private-test-key');assert(!url.includes('private-test-key'));
  calls.push(url);
  if(url.endsWith('/api/dev/list'))return Response.json({vms});
  if(url.includes('/api/create?'))return Response.json({status:'queued',token:'private-queue-token',position:2});
  if(url.includes('/api/queue_status?'))return Response.json({status:'allocated',container_id:'abc',url:'https://loremgroup.org/vm/code/'});
  if(url.includes('/api/start/'))return Response.json({status:'success'});
  throw Error('Unexpected path');
}}));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
const req=(path,method='GET',token='owner',origin=base)=>fetch(base+'/api'+path,{method,headers:{Authorization:'Bearer '+token,Origin:origin}});
try{
  assert.equal((await req('/vms','GET','other')).status,404);assert.equal(calls.length,0);
  assert.equal((await req('/create','POST','owner','https://evil.example')).status,404);assert.equal(calls.length,0);
  let r=await req('/vms');assert.deepEqual(await r.json(),{vms:[],queued:false});
  const responses=await Promise.all([req('/create','POST'),req('/create','POST')]);
  assert(responses.some(r=>r.ok));assert.equal(calls.filter(x=>x.includes('/api/create?')).length,1);
  const queued=await(await req('/create','POST')).json();assert.equal(queued.status,'queued');assert(!JSON.stringify(queued).includes('token'));
  const ready=await(await req('/queue')).json();assert.equal(ready.status,'ready');assert.equal(ready.vm.url,'https://loremgroup.org/vm/code/');
  assert.equal((await req('/start/unowned','POST')).status,404);
  vms=[{container_id:'abc',name:'Existing',connect_code:'code',status:'stopped'}];clock+=61000;
  assert.equal((await req('/create','POST')).status,409);assert.equal(calls.filter(x=>x.includes('/api/create?')).length,1);
  assert.equal((await req('/start/abc','POST')).status,200);
  console.log('PASS LoremGroup: owner authorization, origin checks, key isolation, queue handling, duplicate-create protection and VM ownership');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
