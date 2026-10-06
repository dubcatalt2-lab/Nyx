import assert from 'node:assert/strict';
import express from 'express';
import {mkdtemp,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLoremCloud} from '../scripture/nyxcloud-lorem.mjs';
import {cloudStateStore} from '../scripture/nyxcloud-state.mjs';

const directory=await mkdtemp(join(tmpdir(),'nyx-priority-')),file=join(directory,'state.json');
const tiers=new Map([['premium1','premium'],['premium2','premium'],['owner','owner']]);
let clock=100000,serial=0,vms=[],server,base;
const start=async()=>{
 const app=express();app.use('/api',createLoremCloud({key:'fixture',capacity:1,store:cloudStateStore(file),now:()=>clock,
  queueTier:async uid=>tiers.get(uid)||'regular',
  firebase:async()=>({auth:{verifyIdToken:async uid=>({uid})}}),
  fetchImpl:async url=>{
   if(url.endsWith('/api/dev/list'))return Response.json({vms});
   if(url.includes('/api/create?')){const vm={id:'vm'+(++serial),url:'https://loremgroup.org/vm/code'+serial+'/'};vms.push(vm);return Response.json(vm);}
   if(url.includes('/api/delete/')){vms=vms.filter(v=>!url.endsWith('/'+v.id));return Response.json({});}
   throw Error('Unexpected provider request');
  }}));
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
};
const close=async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));};
const request=async(uid,path='/queue',method='GET')=>{
 const r=await fetch(base+'/api'+path,{method,headers:{Authorization:'Bearer '+uid,Origin:base,'X-Queue-Tier':'owner'}});
 assert.equal(r.status,200);return r.json();
};
const tick=()=>clock+=5100;
try{
 await start();await request('active','/create','POST');tick();assert.equal((await request('active')).status,'ready');
 for(const uid of ['regular1','regular2','premium1','premium2','owner']){await request(uid,'/create','POST');clock++;}
 assert.equal((await request('owner')).position,1);
 assert.equal((await request('premium1')).position,2);
 assert.equal((await request('premium2')).position,3);
 assert.equal((await request('regular1')).position,4,'Client priority headers cannot grant access');
 assert.equal((await request('regular2')).position,5);
 await close();await start();assert.equal((await request('owner')).position,1,'Priority survives restart');
 await request('active','/end','POST');tick();assert.equal((await request('owner')).status,'ready');
 assert.equal((await request('premium1')).status,'queued','Priority never preempts an active VM');
 tiers.set('regular2','premium');assert.equal((await request('regular2')).position,1,'Upgrade keeps original arrival time');
 tiers.set('regular2','regular');
 await request('owner','/end','POST');tick();assert.equal((await request('premium1')).status,'ready','Downgrade rechecked before allocation');
 await request('premium1','/end','POST');tick();assert.equal((await request('premium2')).status,'ready','FIFO within premium');
 await request('premium2','/end','POST');tick();assert.equal((await request('regular1')).status,'ready','Regular users retain FIFO order');
 assert.equal((await request('regular1')).expiresAt,clock+15*60*1000);
 console.log('PASS owner/premium priority, FIFO tiers, durable order, upgrades/downgrades, spoof rejection and unchanged 15-minute isolation');
}finally{if(server)await close();await unlink(file).catch(()=>{});await rmdir(directory);}
