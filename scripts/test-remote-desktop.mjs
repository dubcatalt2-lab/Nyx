import assert from 'node:assert/strict';
import express from 'express';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {WebSocket} from 'ws';
import {createRemoteDesktop,remoteOwnerUid,remoteInput} from '../lib/remote-desktop.mjs';
const records=new Map();let clock=Date.now();
const collection={doc:id=>({get:async()=>({data:()=>records.get(id)}),set:async data=>records.set(id,data),delete:async()=>records.delete(id)}),where:()=>({get:async()=>({size:records.size,docs:[...records].map(([id,data])=>({id,data:()=>data}))})})};
const remote=createRemoteDesktop({now:()=>clock,firebase:async()=>({auth:{verifyIdToken:async(token,revoked)=>{assert.equal(revoked,true);if(token==='owner')return {uid:remoteOwnerUid};if(token==='invalid')throw Error();return {uid:token,role:'owner'};}},firestore:{collection:()=>collection}}),download:async()=>Buffer.from('fixture')});
const app=express();app.use('/api/private-remote',remote.router);const server=createServer(app);server.on('upgrade',remote.upgrade);
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port+'/api/private-remote';
async function api(path,{token='owner',body,method}={}){return fetch(base+path,{method:method||(body?'POST':'GET'),headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}
const message=socket=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Message timeout')),3000);socket.once('message',(data,binary)=>{clearTimeout(timer);resolve(binary?data:JSON.parse(data.toString()));});});
async function ws(first){const socket=new WebSocket(base.replace('http:','ws:')+'/socket');await new Promise(resolve=>socket.once('open',resolve));const reply=message(socket);socket.send(JSON.stringify(first));return {socket,reply};}
async function denied(first){const socket=new WebSocket(base.replace('http:','ws:')+'/socket');await new Promise(resolve=>socket.once('open',resolve));const closed=new Promise(resolve=>socket.once('close',resolve));socket.send(JSON.stringify(first));assert.equal(await closed,4003);}
try{
 for(const token of ['', 'member','co-owner','another-owner','invalid'])for(const path of ['/access','/devices','/host.zip'])assert.equal((await api(path,{token})).status,404);
 assert.equal((await api('/access')).status,200);
 const credential=randomBytes(32).toString('base64url');
 const pair=await(await api('/pair/start',{token:'',body:{credential,name:'Test PC'}})).json();
 assert.equal((await api('/pair/approve',{token:'member',body:{code:pair.code}})).status,404);
 assert.equal((await api('/pair/approve',{body:{code:pair.code}})).status,200);
 const {deviceId:id}=await(await api('/pair/poll',{token:'',body:{poll:pair.poll}})).json();assert(id);assert.equal((await api('/pair/poll',{token:'',body:{poll:pair.poll}})).status,404);
 assert(!JSON.stringify([...records.values()]).includes(credential));
 await denied({type:'host',id,credential:randomBytes(32).toString('base64url')});
 const host=await ws({type:'host',id,credential});assert.equal((await host.reply).type,'ready');
 assert.equal((await(await api('/devices')).json()).devices[0].online,true);
 const {ticket}=await(await api('/connect',{body:{id}})).json();
 const hostControl=message(host.socket);const viewer=await ws({type:'viewer',ticket});assert.equal((await viewer.reply).type,'ready');assert.deepEqual(await hostControl,{type:'control',active:true});
 await denied({type:'viewer',ticket});
 const pixels=Buffer.from([255,216,255,217]),image=message(viewer.socket);host.socket.send(pixels);assert.deepEqual(await image,pixels);
 const input=message(host.socket);viewer.socket.send(JSON.stringify({type:'key',key:65,action:'down',ignored:'discard'}));assert.deepEqual(await input,{type:'key',key:65,action:'down'});
 const release=message(host.socket);viewer.socket.close();assert.deepEqual(await release,{type:'control',active:false});
 const expired=await(await api('/connect',{body:{id}})).json();clock+=31000;await denied({type:'viewer',ticket:expired.ticket});
 const next=await(await api('/connect',{body:{id}})).json();const control=message(host.socket);const second=await ws({type:'viewer',ticket:next.ticket});await second.reply;await control;
 const closed=new Promise(resolve=>second.socket.once('close',resolve));assert.equal((await api('/devices/'+id,{method:'DELETE'})).status,200);await closed;assert.equal(records.size,0);
 await denied({type:'host',id,credential});
 for(const value of [{type:'command',command:'whoami'},{type:'pointer',x:-1,y:0,action:'down'},{type:'key',key:999,action:'down'},{type:'key',key:65,action:'execute'}])assert.equal(remoteInput(value),null);
 assert.deepEqual(remoteInput({type:'wheel',delta:999}),{type:'wheel',delta:3});
 console.log('PASS: exact UID gate, role bypass denied, pairing, hashed credentials, single-use/expired tickets, real frame/input relay, disconnect and revocation.');
}finally{remote.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
