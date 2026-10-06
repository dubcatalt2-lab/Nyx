import assert from 'node:assert/strict';
import express from 'express';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {WebSocket} from 'ws';
import {createRemoteDesktop,remoteOwnerUid} from '../scripture/remote-desktop.mjs';
const credential='a'.repeat(43),id='b'.repeat(32),logs=[];
const remote=createRemoteDesktop({heartbeatInterval:25,heartbeatTimeout:250,report:entry=>logs.push(entry),firebase:async()=>({firestore:{collection:()=>({doc:()=>({get:async()=>({data:()=>({uid:remoteOwnerUid,mode:'vnc',hash:createHash('sha256').update(credential).digest('hex')})})})})}})});
const server=createServer(express());server.on('upgrade',remote.upgrade);
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let host,interval;
try{
 host=new WebSocket('ws://127.0.0.1:'+server.address().port,{autoPong:false});
 await new Promise(resolve=>host.once('open',resolve));
 const ready=new Promise(resolve=>host.once('message',data=>resolve(JSON.parse(data))));
 host.send(JSON.stringify({type:'host',id,credential}));assert.equal((await ready).type,'ready');
 const duplicate=new WebSocket('ws://127.0.0.1:'+server.address().port);
 await new Promise(resolve=>duplicate.once('open',resolve));
 const rejected=new Promise(resolve=>duplicate.once('close',resolve));duplicate.send(JSON.stringify({type:'host',id,credential}));assert.equal(await rejected,4009);
 let replies=0;host.on('message',data=>{if(JSON.parse(data).type==='heartbeat')replies++;});
 interval=setInterval(()=>host.send(JSON.stringify({type:'heartbeat'})),40);
 await new Promise(resolve=>setTimeout(resolve,750));
 assert.equal(host.readyState,1);assert(replies>5,'Application heartbeat acknowledged despite missing control pongs');
 clearInterval(interval);
 const code=await Promise.race([new Promise(resolve=>host.once('close',resolve)),new Promise((_,reject)=>setTimeout(()=>reject(Error('Dead host did not close')),1500))]);
 assert.equal(code,1006);await new Promise(resolve=>setTimeout(resolve,30));assert.equal(logs[0].cause,'heartbeat-timeout');
 console.log('PASS: active host survives missing control pongs; genuinely silent host expires with diagnostic cause.');
}finally{clearInterval(interval);host?.terminate();remote.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}

