import assert from 'node:assert/strict';
import {createMetingBackend} from '../lib/nyxify-meting.mjs';
const songs=[1,2,3].map(id=>({id,name:'Hava Nagila',artists:[{name:`Artist ${id}`}],duration:180000,album:{name:'Album'}}));
let searches=0,details=0,streams=0,active=0,peak=0;
const backend=createMetingBackend({fetchImpl:async(url,options)=>{
  const u=new URL(url);
  if(u.pathname==='/api/search/get'){searches++;return Response.json({result:{songs}})}
  if(u.pathname==='/api/song/detail/'){details++;return Response.json({songs})}
  if(u.searchParams.get('type')==='url')return new Response(null,{status:302,headers:{location:`https://m1.music.126.net/${u.searchParams.get('id')}.mp3`}});
  assert.equal(u.hostname,'m1.music.126.net');streams++;active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,20));active--;
  if(u.pathname==='/1.mp3')return new Response('Unavailable',{status:404});
  if(u.pathname==='/2.mp3')return new Response('<html>not audio</html>',{headers:{'content-type':'audio/mpeg'}});
  assert.equal(options.headers.Range,'bytes=0-4095');return new Response(new Uint8Array([73,68,51,0,0,0]),{headers:{'content-type':'audio/mpeg'}});
}});
const results=await Promise.all(Array.from({length:25},()=>backend.search('Hava Nagila')));
assert.equal(searches,1);assert.equal(streams,3);assert.equal(peak,2);assert(results.every(r=>r.length===1&&r[0].id==='netease:3'));
await backend.search('hava nagila');assert.equal(searches,1);
const hints={title:'Hava Nagila',artist:'Artist 3',duration:180};
const matches=await Promise.all(Array.from({length:20},()=>backend.resolveId('3',hints)));
assert.equal(details,1);assert(matches.every(m=>m.streamUrl==='/api/nyxify/audio/3'));
await assert.rejects(backend.resolveId('3',{...hints,artist:'Cover Band'}),e=>e.status===404);
await assert.rejects(backend.resolveId('3',{...hints,duration:30}),e=>e.status===404);
await assert.rejects(backend.resolveId('https://127.0.0.1/',hints),e=>e.status===400);
console.log('PASS audio-backed search: unavailable/non-audio results omitted, bounded probes, coalescing, namespaced IDs and exact recording validation.');
