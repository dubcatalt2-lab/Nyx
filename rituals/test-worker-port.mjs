import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {application} from '../connection/assembly.mjs';
const occupied=createServer(socket=>socket.end());
occupied.listen(0,'::');await once(occupied,'listening');
const server=application();
try{
  const failure=once(server,'error');server.listen(occupied.address().port,'::');
  assert.equal((await failure)[0].code,'EADDRINUSE');
  server.listen(0,'127.0.0.1');await once(server,'listening');
  assert.equal((await fetch('http://127.0.0.1:'+server.address().port+'/healthz')).status,200);
  console.log('PASS explicit occupied port fails without replacing its listener; an available port accepts HTTP');
}finally{server.closeAllConnections();await Promise.all([new Promise(resolve=>server.close(resolve)),new Promise(resolve=>occupied.close(resolve))]);}
