import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer,request} from 'node:http';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {isolatedApplication} from './isolated-app.mjs';
import {sessionStore} from './session-store.mjs';
import {partition} from './partition.mjs';
import {pack,unpack} from './frames.mjs';

test('session cookies persist across stores and stay isolated',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'document-session-'));
  try{
    const first=await sessionStore(directory).get();
    first.cookies.receive('https://a.example/',[['set-cookie','private=yes; Secure; HttpOnly; Path=/']]);await first.save();
    const restored=await sessionStore(directory).get('__Secure_document='+first.id,false);
    assert.equal(restored.cookies.header('https://a.example/'),'private=yes');
    assert.equal(restored.cookies.visible('https://a.example/'),'');
    assert.equal(restored.cookies.header('https://b.example/'),'');
    const second=await sessionStore(directory).get();assert.notEqual(second.id,first.id);
    assert.equal(second.cookies.header('https://a.example/'),'');
  }finally{await rm(directory,{recursive:true,force:true})}
});

test('document access tickets require cookies and cannot be reused or cross origins',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'document-ticket-'));
  const upstream=createServer((_request,response)=>response.end('fixture')).listen(0,'127.0.0.1');await once(upstream,'listening');
  const service=isolatedApplication({suffix:'nyx.test',directory,protocol:'http:',resolveDestination:async()=>({url:new URL('http://127.0.0.1:'+upstream.address().port),address:{address:'127.0.0.1',family:4}})});
  service.server.listen(0,'127.0.0.1');await once(service.server,'listening');
  const base='http://127.0.0.1:'+service.server.address().port;
  const host=partition('https://a.example','nyx.test'),other=partition('https://b.example','nyx.test');
  const session=await sessionStore(directory).get(),cookie='__Secure_document='+session.id;
  const mint=(headers={})=>new Promise((resolve,reject)=>{
    const outgoing=request(base+'/api/ticket',{method:'POST',headers:{host,origin:'http://'+host,cookie,...headers}},incoming=>{
      const chunks=[];incoming.on('data',chunk=>chunks.push(chunk));incoming.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:incoming.statusCode,headers:incoming.headers})));incoming.on('error',reject);
    });outgoing.on('error',reject);outgoing.end();
  });
  const exchange=async(token,targetHost=host,target='https://a.example/')=>{
    const socket=new WebSocket(base.replace('http:','ws:')+'/api/sync',{headers:{host:targetHost,origin:'http://'+targetHost}});
    await once(socket,'open');const response=once(socket,'message');
    socket.send(pack(1,0,{url:target,method:'GET',headers:[['x-document-access',token]]}));
    const [bytes]=await response;socket.close();await once(socket,'close');return unpack(bytes);
  };
  try{
    assert.equal((await mint({origin:'http://attacker.test'})).status,403);
    assert.equal((await mint({cookie:''})).status,502);
    const response=await mint();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
    const {token}=await response.json();assert.match(token,/^[a-f0-9]{64}$/);
    assert.equal((await exchange(token)).type,0);
    assert.equal((await exchange(token)).type,1);
    const wrongHost=(await (await mint()).json()).token;
    assert.equal((await exchange(wrongHost,other,'https://b.example/')).type,1);
    const wrongDestination=(await (await mint()).json()).token;
    assert.equal((await exchange(wrongDestination,host,'https://b.example/')).type,1);
  }finally{
    service.close();service.server.closeAllConnections();upstream.closeAllConnections();
    await Promise.all([new Promise(resolve=>service.server.close(resolve)),new Promise(resolve=>upstream.close(resolve))]);
    await rm(directory,{recursive:true,force:true});
  }
});
