import assert from 'node:assert/strict';
import {RelayTransport} from '../apps/tutsi/relay.mjs';
const base={urls:['wss://fixture.test/'],storage:null,monitorMs:0,online:()=>true,probe:async()=>true};
let built=0;
const broken=new RelayTransport({...base,createClient:()=>{const generation=++built;return {request:async()=>{if(generation===1)throw Error('Wisp connection closed');return 'recovered'}}}});
await broken.init();assert.equal(await broken.request('https://example.com/','GET'),'recovered');assert.equal(built,2);broken.close();
built=0;const hung=new RelayTransport({...base,requestTimeoutMs:25,createClient:()=>{const generation=++built;return {request:()=>generation===1?new Promise(()=>{}):Promise.resolve('recovered')}}});
await hung.init();assert.equal(await hung.request('https://example.com/','GET'),'recovered');assert.equal(built,2);hung.close();
let writes=0;const post=new RelayTransport({...base,requestTimeoutMs:20,createClient:()=>({request:()=>{writes++;return new Promise(()=>{})}})});
await post.init();await assert.rejects(post.request('https://example.com/','POST'),{name:'TimeoutError'});assert.equal(writes,1);post.close();
for(const message of ['hyper_util::client::legacy::Error(Connect, MuxTaskEnded)','Wisp server closed','unexpected EOF']){
 let created=0;const relay=new RelayTransport({...base,createClient:()=>{const first=++created===1;return {request:async()=>{if(first)throw Error(message);return 'ok'}}}});
 await relay.init();assert.equal(await relay.request('https://fixture.test/','GET'),'ok');assert.equal(created,2);relay.close();
}
let lateCancelled=false,complete;
const cancelled=new RelayTransport({...base,createClient:()=>({request:()=>new Promise(resolve=>complete=resolve)})});await cancelled.init();
const abort=new AbortController(),pending=cancelled.request('https://example.com/','GET',null,[],abort.signal);await new Promise(resolve=>setImmediate(resolve));abort.abort();await assert.rejects(pending,{name:'AbortError'});complete({body:new ReadableStream({cancel(){lateCancelled=true}})});await new Promise(resolve=>setImmediate(resolve));assert(lateCancelled);cancelled.close();
console.log('PASS: healthy relay / stale client rebuilt, hung SDK bounded, no POST replay, abort and late body cleanup.');
