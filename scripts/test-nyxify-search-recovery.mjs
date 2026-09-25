import assert from 'node:assert/strict';
import {createMetingBackend} from '../lib/nyxify-meting.mjs';
const song={id:17177324,name:'Yellow',artists:[{name:'Coldplay'}],duration:266773};const hints={title:'Yellow',artist:'Coldplay',duration:266};
for(const variant of ['correct','cover','short','wrong-title','lookup-error']){
 const calls=[];const backend=createMetingBackend({fetchImpl:async(url,options)=>{calls.push(String(url));if(String(url).includes('/api/search/get')){assert.equal(options.method,'POST');assert.equal(new URLSearchParams(options.body).get('s'),'Coldplay Yellow');const candidate={...song,...(variant==='cover'?{artists:[{name:'Tribute Band'}]}:variant==='short'?{duration:30000}:variant==='wrong-title'?{name:'Yellow (Live)'}:{})};return Response.json({result:{songs:[candidate]}});}if(variant==='lookup-error')return new Response('Unavailable',{status:503});return Response.json([]);}});
 if(variant==='correct'||variant==='lookup-error')assert.equal((await backend.resolve(hints)).id,'17177324');else await assert.rejects(backend.resolve(hints),e=>e.status===404);
 assert.equal(calls.length,3,'Two hosted searches and one fixed public metadata search are the maximum');
}
console.log('PASS direct catalog recovery from empty/error hosted search; rejects covers, short tracks, and wrong editions.');
