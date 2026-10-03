import assert from 'node:assert/strict';
import express from 'express';
import net from 'node:net';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import WebSocket from 'ws';
import {desktopFlow} from '../lib/desktop-flow.mjs';
import {createNyxCloudDesktop} from '../lib/nyxcloud-desktop.mjs';
import {createRemoteDesktop,remoteOwnerUid} from '../lib/remote-desktop.mjs';

// Slow writes must pause the producer and preserve every byte, not close at 4 MB.
{
  let paused=false,pauses=0,resumes=0;const queued=[],received=[];
  const source={pause(){paused=true;pauses++;},resume(){paused=false;resumes++;}};
  const flow=desktopFlow(source,(data,done)=>queued.push(()=>{received.push(data);done();}),reason=>assert.fail(reason));
  const expected=[];
  for(let i=0;i<512;i++){
    const frame=Buffer.alloc(64*1024,i%251);expected.push(frame);flow.write(frame);
    if(paused)while(queued.length)queued.shift()();
  }
  while(queued.length)queued.shift()();
  assert(pauses>1&&resumes===pauses);assert.deepEqual(Buffer.concat(received),Buffer.concat(expected));flow.close();
}

let clock=Date.now(),currentToken='owner-old',revoked=false,outage=false,oldExpired=false;
const credential='a'.repeat(43),id='b'.repeat(32),connections=new Set(),logs=[];
const record={uid:remoteOwnerUid,hash:createHash('sha256').update(credential).digest('hex'),mode:'vnc'};
const firebase=async()=>({auth:{verifyIdToken:async(token,check)=>{
  assert(check);if(outage)throw Object.assign(Error('Temporary outage'),{code:'auth/network-request-failed'});
  if(revoked)throw Object.assign(Error('Revoked'),{code:'auth/id-token-revoked'});
  if(token==='owner-old'&&oldExpired)throw Object.assign(Error('Expired'),{code:'auth/id-token-expired'});
  if(token!==currentToken&&!(token==='owner-old'&&!oldExpired))throw Error('Not owner');return {uid:remoteOwnerUid};
}},firestore:{collection:()=>({doc:()=>({get:async()=>{if(outage)throw Error('Network unavailable');return {data:()=>record};}})})}});
const vnc=net.createServer(socket=>{connections.add(socket);socket.on('close',()=>connections.delete(socket));socket.on('error',()=>{});socket.write('RFB 003.008\n');});vnc.listen(0,'127.0.0.1');await once(vnc,'listening');
const cloud=createNyxCloudDesktop({firebase,now:()=>clock,recheckMs:40,port:vnc.address().port,password:'test-password',report:entry=>logs.push(entry)});
const remote=createRemoteDesktop({firebase,now:()=>clock,recheckMs:40,heartbeatInterval:100000,report:entry=>logs.push(entry)});
const app=express();app.use('/api/nyxcloud',cloud.router);app.use('/api/private-remote',remote.router);
const server=app.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
server.on('upgrade',(req,socket,head)=>(req.url.includes('nyxcloud')?cloud:remote).upgrade(req,socket,head));
const request=(path,body,cookie,token=currentToken)=>fetch(origin+path,{method:'POST',headers:{authorization:'Bearer '+token,origin,'Content-Type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body||{})});
const open=async(path,first,cookie)=>{const ws=new WebSocket(origin.replace('http:','ws:')+path,{origin,headers:cookie?{cookie}:{}});await once(ws,'open');const reply=once(ws,'message');ws.send(JSON.stringify(first));return [ws,JSON.parse((await reply)[0])];};
let host,viewer,vm;
try{
  [host]=await open('/api/private-remote/socket',{type:'host',id,credential});
  const ticket=await(await request('/api/private-remote/connect',{id})).json();let ready;
  [viewer,ready]=await open('/api/private-remote/socket',{type:'viewer',ticket:ticket.ticket});assert(ready.session);
  const cookie=(await request('/api/nyxcloud/session')).headers.get('set-cookie').split(';')[0];
  const cloudTicket=await(await request('/api/nyxcloud/connect',{},cookie)).json();[vm]=await open('/api/nyxcloud/socket',cloudTicket,cookie);
  for(let minute=5;minute<=70;minute+=5){
    clock+=5*60000;if(minute===30)currentToken='owner-new';
    assert.equal((await request('/api/nyxcloud/session',{},cookie)).status,200);
    assert.equal((await request('/api/private-remote/renew',{session:ready.session})).status,200);if(minute===30)oldExpired=true;
    await new Promise(r=>setTimeout(r,45));
    assert.equal(vm.readyState,1,'VM should survive token rotation');assert.equal(viewer.readyState,1,'Desktop should survive scheduled authorization checks');assert.equal(host.readyState,1,'Host must not expire on a timer');
  }
  assert.equal(connections.size,1,'Authorization renewal must not reconnect VNC');
  assert.equal((await request('/api/private-remote/renew',{session:ready.session},null,'member')).status,404);
  outage=true;await new Promise(r=>setTimeout(r,100));assert.equal(vm.readyState,1);assert.equal(viewer.readyState,1);assert.equal(host.readyState,1);
  assert.equal((await request('/api/nyxcloud/session',{},cookie)).status,503,'Temporary Firebase errors must not become permanent denials');
  const interrupted=[once(vm,'close'),once(viewer,'close'),once(host,'close')];clock+=120001;
  const codes=await Promise.all(interrupted);assert.equal(codes[0][0],1013);assert.equal(codes[2][0],1013);assert([1013,4012].includes(codes[1][0]));
  outage=false;
  [host]=await open('/api/private-remote/socket',{type:'host',id,credential});
  const next=await(await request('/api/private-remote/connect',{id})).json();[viewer,ready]=await open('/api/private-remote/socket',{type:'viewer',ticket:next.ticket});
  assert.equal((await request('/api/nyxcloud/session',{},cookie)).status,200);
  [vm]=await open('/api/nyxcloud/socket',await(await request('/api/nyxcloud/connect',{},cookie)).json(),cookie);
  const vmClose=once(vm,'close'),viewerClose=once(viewer,'close');revoked=true;
  assert.equal((await vmClose)[0],4003);assert.equal((await viewerClose)[0],4003);
  record.uid='removed';assert.equal((await once(host,'close'))[0],4003);
  console.log('PASS: 32 MB lossless backpressure; 70 minutes of renewed VM/desktop authorization; token rotation, bounded outage grace, member denial and live revocation.');
}finally{host?.terminate();viewer?.terminate();vm?.terminate();cloud.close();remote.close();for(const socket of connections)socket.destroy();server.closeAllConnections();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>vnc.close(r))]);}
