import assert from 'node:assert/strict';
import {readRelayFrames} from '../apps/tutsi/http-relay.mjs';
const pack=value=>{const data=Uint8Array.from(value),result=new Uint8Array(data.length+4);new DataView(result.buffer).setUint32(0,data.length,true);result.set(data,4);return result;};
const all=new Uint8Array([...pack([1,2,3]),...pack([]),...pack([4,5,6,7])]);
for(const size of [1,2,3,4,5,9,100]){
 const frames=[];await readRelayFrames(new ReadableStream({start(c){for(let i=0;i<all.length;i+=size)c.enqueue(all.slice(i,i+size));c.close();}}),data=>frames.push([...new Uint8Array(data)]));
 assert.deepEqual(frames,[[1,2,3],[],[4,5,6,7]],'Headers and frames remain ordered across arbitrary HTTP chunk boundaries');
}
let controller,progress=0;const received=[];
const pending=readRelayFrames(new ReadableStream({start(c){controller=c;}}),data=>received.push([...new Uint8Array(data)]),()=>progress++);
controller.enqueue(pack([9,8]));await new Promise(resolve=>setTimeout(resolve,0));
assert.deepEqual(received,[[9,8]],'A complete media frame must arrive before the HTTP batch finishes');
controller.enqueue(pack([7]));controller.close();await pending;assert.equal(progress,2);assert.deepEqual(received,[[9,8],[7]]);
for(const data of [new Uint8Array([1,0]),pack([1,2]).slice(0,-1)])await assert.rejects(readRelayFrames(new Response(data).body,()=>{}),/Incomplete/);
const oversized=new Uint8Array(4);new DataView(oversized.buffer).setUint32(0,2*1024*1024+1,true);
await assert.rejects(readRelayFrames(new Response(oversized).body,()=>{}),/frame is too large/);
await assert.rejects(readRelayFrames(new Response(new Uint8Array(20*1024*1024+1)).body,()=>{}),/response is too large/);
let cancelled=false;
await assert.rejects(readRelayFrames(new ReadableStream({start(c){c.enqueue(pack([1]));},cancel(){cancelled=true;}}),()=>{throw new Error('consumer closed');}),/consumer closed/);assert(cancelled);
console.log('PASS incremental HTTP media frames: early delivery, split headers/payloads, ordering, truncation, size bounds and cancellation.');
