import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
for(const enabled of [false,true]){
 const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),NYX_CHAT_ENABLED:enabled?'1':'0',NYX_DISCORD_BRIDGE_ENABLED:'0'},stdio:'ignore'});
 try{
  let health;for(let i=0;i<100;i++){try{health=await(await fetch(`http://127.0.0.1:${port}/healthz`)).json();break;}catch{await new Promise(r=>setTimeout(r,100));}}
  assert(health,'server started');assert.equal(health.chatRealtime,enabled?'socket.io':'disabled');
  for(const path of ['/api/chat/gifs','/apps/chat/','/socket.io/socket.io.js']){
   const response=await fetch(`http://127.0.0.1:${port}${path}`);if(!enabled)assert.equal(response.status,404,path);else assert.notEqual(response.status,404,path);await response.body?.cancel();
  }
  const ai=await fetch(`http://127.0.0.1:${port}/api/nyx-ai`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.notEqual(ai.status,404);await ai.body?.cancel();
  console.log('PASS actual backend chat '+(enabled?'enabled':'disabled')+'; AI route retained');
 }finally{child.kill();await new Promise(r=>child.once('exit',r));}
}
