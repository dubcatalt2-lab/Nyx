import assert from 'node:assert/strict';
import {catalogDocuments} from '../scripture/catalog-documents.mjs';
const calls=[];
const read=catalogDocuments({loadCatalog:async()=>({games:[{id:'33',path:'33-ff.html'}]}),request:async url=>{
  calls.push(url);
  if(url.endsWith('zones.json'))return Response.json([{id:33,url:'{HTML_URL}/33-fix2.html'}]);
  return url.endsWith('33-fix2.html')?new Response('<h1>Fixture</h1>'):new Response('missing',{status:404});
}});
const [a,b]=await Promise.all([read('33.html'),read('33.html')]);assert.equal(a,b);assert.equal(a.path,'33-fix2.html');assert.equal(calls.length,3);
assert.equal((await read('33-ff.html')).path,'33-fix2.html');assert.equal(calls.length,4);
await assert.rejects(read('../33.html'));
console.log('PASS catalog IDs survive renamed files; missing paths refresh once; concurrent launches share retrieval; traversal rejected');
