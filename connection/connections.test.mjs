import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer as httpServer} from 'node:http';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createServer} from './sanctuary.mjs';
import {pack,unpack} from './verses.mjs';
import {connections as connectionPool} from './fellowship.mjs';

test('connection reuse separates origins and DNS changes, bounds active entries and closes cleanly',async()=>{
  const pool=connectionPool({capacity:2});
  const target=(host,address='93.184.215.14')=>({url:new URL('https://'+host),address:{address,family:4}});
  const first=pool.acquire(target('a.example')),second=pool.acquire(target('b.example'));
  assert.notEqual(first.dispatcher,second.dispatcher);
  assert.throws(()=>pool.acquire(target('a.example','93.184.215.15')),/busy/);
  first.release();first.release();
  const changed=pool.acquire(target('a.example','93.184.215.15'));
  assert.notEqual(first.dispatcher,changed.dispatcher);
  assert.throws(()=>pool.acquire(target('c.example')),/busy/);
  changed.release();second.release();await pool.close();
  assert.throws(()=>pool.acquire(target('a.example')),/closed/);
});

test('sequential assets reuse validated upstream connections without sharing request headers',async()=>{
  let connections=0;
  const upstream=httpServer((request,response)=>response.end(request.headers['x-fixture']||''));
  upstream.on('connection',()=>connections++);
  upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
  const resolveDestination=async()=>({url:new URL('http://127.0.0.1:'+upstream.address().port+'/asset'),address:{address:'127.0.0.1',family:4}});
  const network=createServer({resolveDestination});
  const server=httpServer();server.on('upgrade',network.upgrade);server.listen(0,'127.0.0.1');await once(server,'listening');
  const origin='http://127.0.0.1:'+server.address().port;
  try{
    for(let id=1;id<=6;id++){
      const socket=new WebSocket(origin.replace('http:','ws:')+'/api/sync',{headers:{origin}});
      await once(socket,'open');const incoming=once(socket,'message');
      socket.send(pack(id,0,{url:'https://fixture.test/asset',method:'GET',headers:[['x-fixture',String(id)]]}));
      const [bytes]=await incoming;const result=unpack(bytes);
      assert.equal(result.metadata.status,200);assert.equal(new TextDecoder().decode(result.body),String(id));
      socket.close();await once(socket,'close');
    }
    console.log('Upstream TCP connections for six sequential resources:',connections);
    assert.ok(connections<=2,'Each asset should not need a fresh TCP/TLS connection');
  }finally{await network.close();upstream.closeAllConnections();await Promise.all([new Promise(r=>upstream.close(r)),new Promise(r=>server.close(r))]);}
});
