import assert from 'node:assert/strict';
import {q83b2} from '../lib/q83b2.mjs';
const hints={title:'Test recording',artist:'Test artist',duration:180};
const good={id:'Ab12',title:hints.title,user:{name:hints.artist},duration:180,is_streamable:true};
const m={mode:'meting',streamUrl:'/api/nyxify/audio/123',durationSeconds:180};
const response=data=>new Response(JSON.stringify({data}),{headers:{'content-type':'application/json'}});
let calls=0;
const api=async u=>{calls++;return response(u.pathname.endsWith('/search')?[good]:good)};
const backend=q83b2({resolve:async()=>m},{fetchImpl:api});
const [a,b]=await Promise.all([backend.resolve(hints),backend.resolve(hints)]);
assert.equal(calls,1);assert.deepEqual(a,b);assert.equal(a.provider,'audius');assert.equal(a.alternatives[0].provider,'meting');
assert((await backend.streamUrl('Ab12')).startsWith('https://api.audius.co/'));
await assert.rejects(backend.streamUrl('unselected'));
for(const invalid of [{...good,title:'Test recording remix'},{...good,user:{name:'Wrong artist'}},{...good,duration:30},{...good,is_stream_gated:true},{...good,is_streamable:false}]){
 const service=q83b2({resolve:async()=>m},{fetchImpl:async()=>response([invalid])});
 assert.equal((await service.resolve(hints)).provider,'meting');
}
assert.equal((await q83b2({resolve:async()=>{throw Error('Unavailable')}},{fetchImpl:api}).resolve(hints)).provider,'audius');
assert.equal((await q83b2({resolve:async()=>m},{fetchImpl:async()=>{throw Error('Network')}}).resolve(hints)).provider,'meting');
await assert.rejects(q83b2({resolve:async()=>{throw Error('Unavailable')}},{fetchImpl:async()=>response([])}).resolve(hints),/Neither/);
await assert.rejects(backend.resolve({title:'',artist:'Test'}),/Invalid/);
console.log('PASS provider matching, remix/artist/duration/gated rejection, both fallback directions, stream registration and concurrent lookup reuse');
