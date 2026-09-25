import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {parse} from 'acorn';
const {preserveTransferErrors,requestWithTransferRetry,bufferLimit}=await import(process.argv.includes('--built')
  ? '../dist/assets/transports/libcurl-response.mjs' : '../assets/transports/libcurl-response.mjs');

// Use the installed upstream stream implementation, including its late-error
// behavior, rather than reproducing that behavior in a mock implementation.
const require=createRequire(import.meta.url);
const source=readFileSync(require.resolve('@mercuryworkshop/libcurl-transport'),'utf8');
let method;
function visit(node){
  if(!node || typeof node!=='object')return;
  if(node.type==='MethodDefinition' && node.key.name==='stream_response')method=source.slice(node.start,node.end);
  for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}
}
visit(parse(source,{ecmaVersion:'latest',sourceType:'module'}));
assert(method);
const Session=vm.runInNewContext(`(class {${method}})`,{ReadableStream,AbortSignal,TypeError});
function transfer(text,code=0,{patched=true,signal}={}){
  return new Promise(resolve=>{
    const session=new Session();
    session.create_request=(_url,data,end)=>{
      queueMicrotask(()=>{data(new TextEncoder().encode(text));end(code);});return 1;
    };
    if(patched)preserveTransferErrors(session);
    session.stream_response('https://fixture.test/chunk.js',body=>resolve({status:200,headers:[['content-type','application/javascript']],body}),()=>{},signal);
  });
}
const text=async response=>new Response(response.body).text();
assert.equal(await text(await transfer('partial(',92,{patched:false})),'partial(','Upstream exposes the truncated file as success');
await assert.rejects(text(await transfer('partial(',92)),/error code 92/);
assert.equal(await text(await transfer('complete();')),'complete();');

for(const method of ['GET','HEAD']){
  let calls=0;const budget={bytes:0};
  const response=await requestWithTransferRetry(()=>++calls===1?transfer('partial(',92):transfer('complete();'),{method,body:null,budget});
  assert.equal(await text(response),'complete();');assert.equal(calls,2);assert.equal(budget.bytes,0);
}
{
  let calls=0;const budget={bytes:0};
  await assert.rejects(requestWithTransferRetry(()=>{calls++;return transfer('partial(',92);},{method:'GET',body:null,budget}),/error code 92/);
  assert.equal(calls,2);assert.equal(budget.bytes,0);
}
for(const method of ['POST','PUT','PATCH','DELETE']){
  let calls=0;
  const response=await requestWithTransferRetry(()=>{calls++;return transfer('partial(',92);},{method,body:'payload',budget:{bytes:0}});
  await assert.rejects(text(response),/error code 92/);assert.equal(calls,1);
}
{
  const abort=new AbortController();let calls=0;
  await assert.rejects(requestWithTransferRetry(()=>{calls++;abort.abort();return transfer('partial(',92,{signal:abort.signal});},
    {method:'GET',body:null,signal:abort.signal,budget:{bytes:0}}),{name:'AbortError'});
  assert.equal(calls,1);
}
{
  const abort=new AbortController(),budget={bytes:0};let calls=0;
  const request=()=>new Promise(resolve=>{
    calls++;const session=new Session();preserveTransferErrors(session);
    session.create_request=(_url,data)=>{
      queueMicrotask(()=>{data(new TextEncoder().encode('partial('));setTimeout(()=>abort.abort(),0);});return 1;
    };
    session.stream_response('https://fixture.test/chunk.js',body=>resolve({headers:[['content-type','text/javascript']],body}),()=>{},abort.signal);
  });
  await assert.rejects(requestWithTransferRetry(request,{method:'GET',body:null,signal:abort.signal,budget}),error=>/abort/i.test(String(error)));
  assert.equal(calls,1);assert.equal(budget.bytes,0);
}
{
  let calls=0;
  await assert.rejects(requestWithTransferRetry(()=>{calls++;throw new TypeError('Request failed with error code 60');},
    {method:'GET',body:null,budget:{bytes:0}}),/code 60/);
  assert.equal(calls,1,'Certificate failures are not replayed');
}
// Buffer exhaustion retains every byte in order and releases retained prefixes
// when consumed or cancelled. It is not a response-size limit.
for(const cancel of [false,true]){
  const budget={bytes:bufferLimit-2};
  const response=await requestWithTransferRetry(()=>Promise.resolve({headers:[['content-type','application/json']],body:new ReadableStream({
    start(controller){controller.enqueue(new Uint8Array([1,2]));controller.enqueue(new Uint8Array([3,4]));controller.close();}
  })}),{method:'GET',body:null,budget});
  assert.equal(budget.bytes,bufferLimit);
  if(cancel)await response.body.cancel();
  else assert.deepEqual([...new Uint8Array(await new Response(response.body).arrayBuffer())],[1,2,3,4]);
  assert.equal(budget.bytes,bufferLimit-2);
}
{
  const budget={bytes:0};let calls=0;
  const response=await requestWithTransferRetry(()=>{
    calls++;let part=0;
    return {headers:[['content-type','application/javascript']],body:new ReadableStream({pull(controller){
      if(part++<3)controller.enqueue(new Uint8Array(8*1024*1024));
      else controller.error(new TypeError('Request failed with error code 92'));
    }},{highWaterMark:0})};
  },{method:'GET',body:null,budget});
  assert.equal(budget.bytes,16*1024*1024);
  await assert.rejects(new Response(response.body).arrayBuffer(),/code 92/);
  assert.equal(calls,1,'Do not replay a large body after exposing its prefix');
  assert.equal(budget.bytes,0);
}
for(const mime of ['video/mp4','text/event-stream','application/json-seq','application/x-ndjson']){
  const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array([1]));}});
  const response=await requestWithTransferRetry(()=>Promise.resolve({headers:[['content-type',mime]],body}),{method:'GET',body:null,budget:{bytes:0}});
  assert.equal(response.body,body,`${mime} must remain streaming`);await body.cancel();
}
console.log('Libcurl late errors, complete-file retry, write/abort safety, buffering and streaming passed.');
