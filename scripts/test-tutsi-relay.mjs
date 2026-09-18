import assert from 'node:assert/strict';
import {RelayTransport,probeWisp,relayCandidates,rankForBlocker} from '../apps/tutsi/relay.mjs';
const urls=['wss://one.example/wisp/','wss://two.example/wisp/'];
const options={urls,storage:null,monitorMs:0,online:()=>true,visible:()=>true};
let healthy=new Set(urls),calls=[];
const make=(url)=>({request:async(_url,method)=>{calls.push([url,method]);if(!healthy.has(url))throw Error('offline');return url}});
let transport=new RelayTransport({...options,probe:async url=>healthy.has(url),createClient:make});
await transport.init();healthy.delete(urls[0]);assert.equal(await transport.request('https://example.com','GET'),urls[1]);assert.equal(transport.url,urls[1]);transport.close();
healthy=new Set(urls);calls=[];
transport=new RelayTransport({...options,probe:async url=>healthy.has(url),createClient:make});await transport.init();healthy.delete(urls[0]);await assert.rejects(transport.request('https://example.com','POST'));assert.equal(calls.length,1);assert.equal(transport.url,urls[1]);transport.close();
transport=new RelayTransport({...options,probe:async()=>true,createClient:()=>({request:async()=>{throw Error('upstream')}})});await transport.init();await assert.rejects(transport.request('https://example.com','GET'));assert.equal(transport.url,urls[0]);transport.close();
transport=new RelayTransport({...options,probe:async url=>url===urls[1],createClient:make});await transport.init();assert.equal(transport.url,urls[1]);transport.close();
assert.deepEqual(relayCandidates({relay:urls[0],autoRelay:false},{},{protocol:'https:',host:'tutsi.test'}),[urls[0]]);
let closed=false;
class Socket{constructor(){queueMicrotask(()=>{const data=new ArrayBuffer(9);new Uint8Array(data)[0]=3;this.onmessage?.({data})})}close(){closed=true}}
assert.equal(await probeWisp(urls[0],{Socket,timeout:20}),true);assert(closed);
assert.equal(await probeWisp(urls[0],{Socket:class{close(){}},timeout:10}),false);
const bodies=[];assert.deepEqual(await rankForBlocker(urls,'test',{fetcher:async(_,options)=>{const body=JSON.parse(options.body);bodies.push(body);return {ok:true,json:async()=>({vendors:{test:{blocked:body.url.includes('one.')}}})}}}),[urls[1],urls[0]]);
assert(bodies.every(body=>new URL(body.url).pathname==='/'));
assert.deepEqual(await rankForBlocker(urls,'unknown',{fetcher:async()=>{throw Error('unavailable')}}),urls);
console.log('Tutsi relay: handshake validation, backup, safe retries, upstream errors, manual mode and filter ranking passed');

// Classification failure or delay must not prevent a working connection.
for(const rank of [()=>new Promise(()=>{}),async()=>{throw Error('checker unavailable')}]) {
 const guarded=new RelayTransport({...options,rank,probe:async()=>true,createClient:make});
 const started=Date.now();
 await guarded.init();
 assert.equal(guarded.url,urls[0]);
 assert(Date.now()-started<1000,'Classification delayed connection startup');
 guarded.close();
}
console.log('Slow and unavailable classification fallback passed');

for(const method of ['GET','HEAD','POST']) {
 let attempts=0;
 const cold=new RelayTransport({...options,probe:async()=>true,createClient:()=>({request:async()=>{if(++attempts===1)throw new Error('request timed out');return 'loaded';}})});
 await cold.init();
 if(method==='POST'){await assert.rejects(cold.request('https://fixture.test/',method));assert.equal(attempts,1);}
 else {assert.equal(await cold.request('https://fixture.test/',method),'loaded');assert.equal(attempts,2);}
 cold.close();
}
let attempts=0;
const failed=new RelayTransport({...options,probe:async()=>true,createClient:()=>({request:async()=>{attempts++;throw new Error('ETIMEDOUT');}})});
await failed.init();await assert.rejects(failed.request('https://fixture.test/','GET'));assert.equal(attempts,2);failed.close();
const abort=new AbortController();attempts=0;
const cancelled=new RelayTransport({...options,probe:async()=>true,createClient:()=>({request:async()=>{attempts++;abort.abort();throw new Error('request timed out');}})});
await cancelled.init();await assert.rejects(cancelled.request('https://fixture.test/','GET',null,[],abort.signal));assert.equal(attempts,1);cancelled.close();
console.log('First-read timeout recovery, retry bound, POST and cancellation safety passed');
