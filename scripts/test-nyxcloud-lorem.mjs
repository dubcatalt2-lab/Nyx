import assert from 'node:assert/strict';
import express from 'express';
import {mkdtemp,readFile,writeFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLoremCloud,desktopUrl} from '../lib/nyxcloud-lorem.mjs';
import {cloudStateStore} from '../lib/nyxcloud-state.mjs';
import {nyxCloudOwnerUid} from '../lib/nyxcloud-access.mjs';
assert.equal(desktopUrl('https://evil.example/vm/a/'),'');
assert.equal(desktopUrl('https://loremgroup.org/vm/a/?key=secret'),'');
const dir=await mkdtemp(join(tmpdir(),'nyx-vm-queue-test-')),file=join(dir,'state.json');
let vms=[{id:'legacy',status:'exited',url:'https://loremgroup.org/vm/owner-private/'}],calls=[],clock=100000,mode='ready',serial=0;
const provider=async(url,options)=>{
 assert.equal(options.headers['X-API-Key'],'private-test-key');assert(!url.includes('private-test-key'));calls.push(url);
 if(url.endsWith('/api/dev/list'))return Response.json({vms});
 if(url.includes('/api/create?')){
  assert.equal(new URL(url).searchParams.get('site_limit'),'2');
  if(mode==='busy')return Response.json({error:'busy'},{status:429});
  if(mode==='uncertain')throw Error('network interrupted');
  if(mode==='queued')return Response.json({status:'queued',token:'private-queue-token',position:8});
  const item={id:'vm'+(++serial),status:'running',url:'https://loremgroup.org/vm/code'+serial+'/'};vms.push(item);return Response.json(item);
 }
 if(url.includes('/api/queue_status?')){
  if(mode==='queued')return Response.json({status:'queued',position:7});
  const item={id:'vm'+(++serial),status:'running',url:'https://loremgroup.org/vm/code'+serial+'/'};vms.push(item);return Response.json({...item,status:'allocated'});
 }
 if(url.includes('/api/queue_cancel?'))return Response.json({status:'success'});
 if(url.includes('/api/delete/')){vms=vms.filter(v=>v.id!==url.split('/').pop());return Response.json({status:'success'});}
 if(url.includes('/api/start/'))return Response.json({status:'success'});
 throw Error('Unexpected path');
};
let server,base;
async function start(){
 const app=express();app.use('/api',createLoremCloud({key:'private-test-key',capacity:2,store:cloudStateStore(file),now:()=>clock,
 firebase:async()=>({auth:{verifyIdToken:async t=>{if(t==='expired')throw {code:'auth/id-token-expired'};return {uid:t==='owner'?nyxCloudOwnerUid:t,firebase:{sign_in_provider:t==='anon'?'anonymous':'password'}};}}}),fetchImpl:provider}));
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
}
const req=(path,method='GET',token='alice',origin=base)=>fetch(base+'/api'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),Origin:origin}});
const json=async(path,method='GET',token='alice')=>{const r=await req(path,method,token);assert.equal(r.status,200,await r.clone().text());return r.json();};
const tick=()=>clock+=5100;
const close=async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));};
try{
 await writeFile(file,JSON.stringify({version:1,migrated:true,entries:[{uid:nyxCloudOwnerUid,status:'ready',vm:{id:'legacy',state:'exited',url:'https://loremgroup.org/vm/owner-private/'},legacy:true,lastSeen:clock,readyAt:clock}],syncedAt:0}));
 await start();
 assert.equal((await req('/vms','GET','')).status,401);
 assert.equal((await req('/vms','GET','anon')).status,401);
 assert.equal((await req('/vms','GET','expired')).status,401);
 assert.equal((await req('/create','POST','alice','https://evil.example')).status,403);
 // HTTPS at the public proxy, HTTP at Express: host must match, protocol can differ.
 assert.equal((await req('/create','POST','alice',base.replace('http:','https:'))).status,200);
 assert.deepEqual((await json('/vms')).vms,[]);
 assert.equal((await json('/vms','GET','owner')).vms[0].id,'legacy');
 await Promise.all(Array.from({length:12},()=>json('/create','POST')));
 assert.equal(JSON.parse(await readFile(file)).entries.filter(e=>e.uid==='alice').length,1);
 tick();const a=await json('/queue');assert.equal(a.status,'ready');
 assert.equal(calls.filter(x=>x.includes('/api/create?')).length,1);
 assert.equal((await req('/start/'+a.vm.id,'POST','bob')).status,404);
 assert.equal((await json('/create','POST','bob')).position,1);
 assert.equal((await json('/create','POST','carol')).position,2);
 assert(!JSON.stringify(await json('/vms','GET','bob')).includes(a.vm.url));
 tick();assert.equal((await json('/queue','GET','bob')).status,'queued');
 assert.equal(calls.filter(x=>x.includes('/api/create?')).length,1);
 await close();await start();
 assert.equal((await json('/queue','GET','carol')).position,2,'durable order');
 assert.equal((await json('/vms')).vms[0].id,a.vm.id,'durable ownership');
 await json('/end','POST');tick();assert.equal((await json('/queue','GET','bob')).status,'ready');
 assert.equal((await json('/cancel','POST','bob')).status,'ready','cancellation/allocation race preserves desktop');
 await json('/cancel','POST','carol');assert.equal((await json('/queue','GET','carol')).status,'idle');
 await json('/end','POST','bob');mode='queued';await json('/create','POST','carol');tick();
 let q=await json('/queue','GET','carol');assert.equal(q.status,'queued');assert.equal(q.providerPosition,8);assert(!JSON.stringify(q).includes('private-queue-token'));
 await close();await start();tick();q=await json('/queue','GET','carol');assert.equal(q.providerPosition,7);
 await json('/cancel','POST','carol');assert(calls.some(x=>x.includes('/api/queue_cancel?token=')));
 mode='busy';await json('/create','POST','dave');tick();assert.equal((await json('/queue','GET','dave')).status,'queued');
 mode='ready';tick();assert.equal((await json('/queue','GET','dave')).status,'ready');
 // Forgotten waiters leave the line; a managed disconnected desktop expires.
 await json('/create','POST','abandoned');clock+=301000;tick();await json('/vms','GET','owner');
 assert.equal((await json('/queue','GET','abandoned')).status,'idle');
 assert.equal(vms.length,1);assert.equal(vms[0].id,'legacy','never auto-delete original owner desktop');
 mode='uncertain';await json('/create','POST','uncertain');tick();assert.equal((await json('/queue','GET','uncertain')).status,'recovering');
 const creates=calls.filter(x=>x.includes('/api/create?')).length;
 await close();await start();tick();assert.equal((await json('/queue','GET','uncertain')).status,'recovering');
 await json('/create','POST','uncertain');assert.equal(calls.filter(x=>x.includes('/api/create?')).length,creates,'never duplicate uncertain creation');
 assert.equal((await req('/cancel','POST','uncertain')).status,409);
 console.log('PASS public VM auth, HTTPS proxy, isolation, owner migration, FIFO capacity, concurrent tabs, durable restart, cancellation races, provider queue/overload, cleanup and uncertain creation');
}finally{if(server)await close();await unlink(file).catch(()=>{});await unlink(file+'.lock').catch(()=>{});await unlink(file+'.'+process.pid+'.tmp').catch(()=>{});await rmdir(dir);}
