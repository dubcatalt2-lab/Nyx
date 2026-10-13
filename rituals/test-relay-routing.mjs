import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import WebSocket from 'ws';

const child=fork('shepherd.js',[],{env:{...process.env,PORT:'0'},stdio:['ignore','ignore','inherit','ipc']});
const timeout=setTimeout(()=>{child.kill();throw Error('Relay routing test timed out');},30000);
let socket;
try {
  const [{port}]=await once(child,'message');
  console.log('App started for relay routing check');
  const base='ws://127.0.0.1:'+port;
  async function denied(headers,status){
    const ws=new WebSocket(base+'/api/communion',{headers});
    ws.on('error',()=>{});
    const [,response]=await once(ws,'unexpected-response');
    assert.equal(response.statusCode,status);response.resume();ws.terminate();
  }
  await denied({},403);
  console.log('Missing origin rejected');
  await denied({origin:'https://unrelated.invalid'},403);
  console.log('Foreign origin rejected');
  await denied({origin:'https://drop.altarworship.org.uk',host:'drop.altarworship.org.uk'},410);
  console.log('Retired domain rejected');
  socket=new WebSocket(base+'/api/communion',{origin:'http://127.0.0.1:'+port});
  const [frame]=await once(socket,'message');
  assert.equal(frame[0],3);assert.equal(frame.readUInt32LE(1),0);
  socket.close();
  console.log('PASS actual app: same-origin relay connects; missing/foreign origins and retired Drop domain are rejected');
} finally {
  clearTimeout(timeout);socket?.terminate();child.disconnect();
  const [code]=await once(child,'exit');assert.equal(code,0);
}
