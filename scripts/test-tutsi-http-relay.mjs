import assert from 'node:assert/strict';
import express from 'express';
import {createServer} from 'node:http';
import {WebSocketServer} from 'ws';
import {installHttpWisp} from '../server-http-wisp.mjs';
const app=express(), server=createServer(app), ws=new WebSocketServer({server});
let peers=0;
ws.on('connection', socket=>{peers++;socket.on('close',()=>peers--);socket.on('message',data=>{if(data.toString()==='burst'){for(let i=0;i<384;i++)socket.send(Buffer.alloc(65536,i));}else socket.send(data)});socket.send(Buffer.from([3,0,0,0,0,10,0,0,0]));});
let port;
app.use((req,res,next)=>next());
const close=installHttpWisp(app,{upstream:()=>({url:`ws://127.0.0.1:${port}`}),allowed:req=>req.headers.origin==='https://tutsi.test',banned:async req=>req.headers['x-test-ip']==='banned',clientIp:req=>req.headers['x-test-ip']||'one'});
app.use((error,req,res,next)=>res.sendStatus(error.status||500));
await new Promise(r=>server.listen(0,'127.0.0.1',r));port=server.address().port;
const base=`http://127.0.0.1:${port}/api/tutsi-relay/`;
const call=(path,options={})=>fetch(base+path,{...options,headers:{Origin:'https://tutsi.test',...options.headers}});
try {
 assert.equal((await fetch(base+'sessions',{method:'POST'})).status,403);
 assert.equal((await call('sessions',{method:'POST',headers:{'x-test-ip':'banned'}})).status,403);
 const {token}=await (await call('sessions',{method:'POST'})).json();
 const auth={Authorization:'Bearer '+token};
 assert.equal((await call('receive',{headers:{...auth,'x-test-ip':'two'}})).status,410);
 const first=Buffer.from(await (await call('receive',{headers:auth})).arrayBuffer());assert.equal(first.readUInt32LE(),9);assert.equal(first[4],3);
 for(let i=0;i<3;i++){
  assert.equal((await call('send',{method:'POST',headers:{...auth,'Content-Type':'application/octet-stream','X-Tutsi-Sequence':String(i)},body:Buffer.from([i])})).status,204);
  const data=Buffer.from(await (await call('receive',{headers:auth})).arrayBuffer());assert.deepEqual([...data],[1,0,0,0,i]);
 }
 assert.equal((await call('send',{method:'POST',headers:{...auth,'Content-Type':'application/octet-stream','X-Tutsi-Sequence':'3'},body:Buffer.from('burst')})).status,204);
 await new Promise(r=>setTimeout(r,200));
 let frames=0;
 while(frames<384){
  const response=await call('receive',{headers:auth});assert.equal(response.status,200,'An image burst must not close the relay');
  const bytes=Buffer.from(await response.arrayBuffer());
  for(let offset=0;offset<bytes.length;){const length=bytes.readUInt32LE(offset);offset+=4;assert.equal(length,65536);assert(bytes.subarray(offset,offset+length).every(value=>value===(frames%256)));offset+=length;frames++;}
 }
 assert.equal((await call('send',{method:'POST',headers:{...auth,'Content-Type':'application/octet-stream','X-Tutsi-Sequence':'0'},body:Buffer.from([9])})).status,409);
 assert.equal((await call('send',{method:'POST',headers:{...auth,'Content-Type':'application/octet-stream','X-Tutsi-Sequence':'3'},body:Buffer.alloc(262145)})).status,413);
 const pending=call('receive',{headers:auth});
 await new Promise(r=>setTimeout(r,30));
 assert.equal((await call('receive',{headers:auth})).status,409);
 assert.equal((await call('session',{method:'DELETE',headers:auth})).status,204);
 assert.equal((await pending).status,410);
 assert.equal((await call('receive',{headers:auth})).status,410);
 const tokens=[];for(let i=0;i<6;i++)tokens.push((await (await call('sessions',{method:'POST'})).json()).token);
 assert.equal((await call('sessions',{method:'POST'})).status,429);
 for(const t of tokens)await call('session',{method:'DELETE',headers:{Authorization:'Bearer '+t}});
 for(let i=0;i<30;i++)await call('sessions',{method:'POST',headers:{'x-test-ip':'banned'}});
 assert.equal((await call('sessions',{method:'POST',headers:{'x-test-ip':'banned'}})).status,429);
 await new Promise(r=>setTimeout(r,100));assert.equal(peers,0);
 console.log('HTTP Wisp: origin/IP isolation, binary ordering, replay rejection, capacity and cleanup passed.');
} finally {close();ws.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
