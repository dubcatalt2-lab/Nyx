import {sourceFile} from '../scripture/source-layout.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
const source=readFileSync(sourceFile('shepherd.js'),'utf8');
let statement;
function visit(node){
 if(!node||typeof node!=='object')return;
 if(node.type==='IfStatement'&&source.slice(node.test.start,node.test.end).startsWith('wantsStream && upstream.ok'))statement=node;
 for(const value of Object.values(node)){
  if(Array.isArray(value))value.forEach(visit);
  else if(value&&typeof value==='object')visit(value);
 }
}
visit(parse(source,{ecmaVersion:'latest',sourceType:'module'}));
assert(statement,'Streaming response branch exists');
async function run(events){
 const chunks=[],res={status(){},setHeader(){},flushHeaders(){},write(value){chunks.push(value);},end(){}};
 const code=source.slice(statement.start,statement.end);
 const context={wantsStream:true,upstream:new Response(events.map(e=>'data: '+JSON.stringify(e)+'\n\n').join('')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}}),res,TextDecoder,model:'moonshotai/kimi-k3',key:'fixture',credential:{},deadline:{touch(){}},aiResponseMetadata:()=>({summary:'',sources:[]}),nyxAiStreamText:e=>e.choices?.[0]?.delta?.content||'',nyxAiCompletionTokens:()=>0,nyxAiWriteStreamChunk:(res,text,model)=>{if(text)res.write('data: '+JSON.stringify({model,text})+'\n\n');},nyxAiLooksCorrupted:()=>false,webEnabled:false,opusReservation:null,navyReservation:null};
 await vm.runInNewContext('(async()=>{'+code+'})()',context);
 return chunks.filter(x=>x.startsWith('data: {')).map(x=>JSON.parse(x.slice(6)));
}
const output=await run([{model:'anthropic/claude-example',choices:[]},{choices:[{delta:{content:'Hello'}}]}]);
assert.equal(output.find(x=>x.text)?.model,'anthropic/claude-example');
const same=await run([{model:'moonshotai/kimi-k3',choices:[{delta:{content:'Hello'}}]}]);
assert.equal(same.find(x=>x.text)?.model,'moonshotai/kimi-k3');
console.log('PASS response labels preserve actual upstream model metadata, including metadata-only SSE events');
