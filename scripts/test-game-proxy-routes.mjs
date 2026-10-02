import assert from 'node:assert/strict';
import {once} from 'node:events';
const originalFetch=globalThis.fetch;
globalThis.fetch=async (url, options)=>{
  const target=new URL(url);
  if(target.hostname==='127.0.0.1')return originalFetch(url,options);
  assert.ok(['cdn.jsdelivr.net','raw.githubusercontent.com'].includes(target.hostname));
  assert.ok(options.signal,'upstream request must be cancellable');
  if(target.pathname.endsWith('.wasm'))return new Response(Buffer.alloc(1024*1024,7));
  if(target.pathname.endsWith('main.js'))return new Response('var clickedFake = false;',{headers:{'content-type':'text/plain'}});
  if(target.pathname.endsWith('.json'))return Response.json({dataUrl:'game.data'});
  if(target.pathname.endsWith('.css'))return new Response('body{background:url(./image.png)}',{headers:{'content-type':'text/css'}});
  return new Response('fixture',{headers:{'content-type':'image/png'}});
};
const {app}=await import('../server.js');
const server=app.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
try{
  const js=await originalFetch(base+'/gn-math-resource/https/cdn.jsdelivr.net/gh/bubbls/youtube-playables@main/aquapark-io/main.js');
  assert.equal(js.status,200);assert.match(js.headers.get('content-type'),/javascript/);assert.match(await js.text(),/playBtnClicked/);
  const binary=await originalFetch(base+'/gn-math-resource/https/cdn.jsdelivr.net/gh/fixture/test@main/file.wasm');
  assert.match(binary.headers.get('content-type'),/application\/wasm/);assert.equal(binary.headers.get('cache-control'),'no-store');
  const body=new Uint8Array(await binary.arrayBuffer());assert.equal(body.length,1024*1024);assert.ok(body.every(x=>x===7));
  const json=await(await originalFetch(base+'/gn-math-proxy?url='+encodeURIComponent('https://cdn.jsdelivr.net/gh/fixture/test@main/Build/game.json'))).json();
  assert.match(json.dataUrl,/^gn-math-proxy\?url=/);
  const css=await(await originalFetch(base+'/gms-games-proxy?url='+encodeURIComponent('https://raw.githubusercontent.com/isaacduh123/reds-exploit-corner/main/misc/style.css'))).text();
  assert.match(css,/gms-games-proxy\?url=/);
  const image=await originalFetch(base+'/gn-math-asset?repo=covers&path=1.png');assert.equal(image.headers.get('cache-control'),'public, max-age=3600');assert.equal(await image.text(),'fixture');
  assert.equal((await originalFetch(base+'/gn-math-proxy?url=http://localhost/private')).status,400);
  console.log('PASS real Express routes: streamed binary, loader repair, MIME, JSON/CSS rewriting, cover cache and denied upstream host');
}finally{globalThis.fetch=originalFetch;server.closeAllConnections();await new Promise(r=>server.close(r));}
