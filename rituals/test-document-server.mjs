import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import WebSocket from 'ws';
import {application} from '../connection/assembly.mjs';
import {pack,unpack} from '../connection/verses.mjs';
const upstream=createServer((request,response)=>{
 const bytes=[];request.on('data',chunk=>bytes.push(chunk));request.on('end',()=>{
  response.writeHead(201,{'content-type':'application/json','set-cookie':['first=1','second=2']});
  response.end(JSON.stringify({method:request.method,body:Buffer.concat(bytes).toString(),header:request.headers['x-fixture']}));
 });
});
upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
let allowed=true;
const service=application({allowed:async()=>allowed,resolveDestination:async()=>({url:new URL('http://127.0.0.1:'+upstream.address().port),address:{address:'127.0.0.1',family:4}})});
service.listen(0,'127.0.0.1');await once(service,'listening');
const origin='http://127.0.0.1:'+service.address().port,clients=new Set();
const connect=(path='/api/sync',from=origin)=>{
 const ws=new WebSocket(origin.replace('http:','ws:')+path,{origin:from});clients.add(ws);ws.on('error',()=>{});return ws;
};
const denied=async(path,from)=>{
 const ws=connect(path,from);const [code]=await once(ws,'unexpected-response').then(([,response])=>[response.statusCode]);assert.equal(code,403);ws.terminate();
};
try{
 await denied('/api/sync','https://foreign.test');await denied('/unknown',origin);await denied('/api/sync?extra=1',origin);
 allowed=false;await denied('/api/sync',origin);allowed=true;
 for(const path of ['/api/sync','/api/presence']){
  const ws=connect(path);await once(ws,'open');
  const received=once(ws,'message');ws.send(pack(73,0,{url:'https://fixture.test/',method:'POST',headers:[['x-fixture','kept']]},new TextEncoder().encode('payload')));
  const [bytes,binary]=await received;assert(binary);const result=unpack(bytes);assert.equal(result.id,73);assert.equal(result.type,0);assert.equal(result.metadata.status,201);
  assert.deepEqual(result.metadata.headers.filter(([name])=>name==='set-cookie'),[['set-cookie','first=1'],['set-cookie','second=2']]);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(result.body)),{method:'POST',body:'payload',header:'kept'});ws.close();
 }
 const bad=connect();await once(bad,'open');const answer=once(bad,'message');bad.send(pack(9,0,{url:'https://fixture.test/',method:'CONNECT',headers:[]}));assert.equal(unpack((await answer)[0]).type,1);bad.close();
 console.log('PASS original document server: origin/route/access rejection, both routes, exact framing, binary response, POST body, header pairs and structured request errors');
}finally{
 for(const client of clients)client.terminate();
 for(const server of [service,upstream]){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
