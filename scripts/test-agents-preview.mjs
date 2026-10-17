import assert from 'node:assert/strict';
import http from 'node:http';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parse} from 'acorn';
import {agentInstruction,parseAgentReply} from '../lib/agent-protocol.mjs';
const source=await readFile(new URL('./agents-preview.mjs',import.meta.url),'utf8');
const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
const declaration=ast.body.find(n=>n.type==='VariableDeclaration'&&n.declarations[0].id.name==='server');
const callback=declaration.declarations[0].init.arguments[0];
let payload,mode='valid',calls=0;
const hosts=new Set(['localhost:6769']);
const handler=vm.runInNewContext('('+source.slice(callback.start,callback.end)+')',{
  hosts,upstream:'http://localhost:6767',port:6769,
  URL,Buffer,AbortController,agentInstruction,parseAgentReply,
  fetch:async(url,options)=>{
    calls++;payload=JSON.parse(options.body);
    assert.equal(options.headers.Authorization||options.headers.authorization,'Bearer fixture');
    return new Response(JSON.stringify({text:mode==='valid'?'{"message":"Done","done":true}':'ordinary prose'}),{headers:{'content-type':'application/json'}});
  }
});
const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
hosts.add('127.0.0.1:'+server.address().port);
const url='http://127.0.0.1:'+server.address().port+'/api/nyx-ai';
const send=(headers={})=>fetch(url,{method:'POST',headers:{Host:'localhost:6769',Origin:'http://localhost:6769',Authorization:'Bearer fixture','content-type':'application/json',...headers},body:JSON.stringify({task:'computer-agent',stream:false,message:'Read a file',messages:[]})});
try{
  assert.equal((await send({Origin:'https://external.example'})).status,403);assert.equal(calls,0);
  assert.equal((await send({Authorization:''})).status,401);assert.equal(calls,0);
  assert.equal((await send()).status,200);assert.equal(payload.messages[0].content,agentInstruction);assert.equal(payload.temporaryChat,true);assert.equal(payload.task,undefined);
  mode='invalid';assert.equal((await send()).status,502);
  const plain=await fetch(url,{method:'POST',headers:{Host:'localhost:6769',Origin:'http://localhost:6769',Authorization:'Bearer fixture','content-type':'application/json'},body:JSON.stringify({stream:false,message:'Hello',messages:[]})});assert.equal(plain.status,200);assert.equal(payload.messages.length,0);
  console.log('PASS local agent bridge origin/auth guards, protocol instructions and invalid-action rejection');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
