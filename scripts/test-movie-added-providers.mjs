import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const app=express();app.use(express.static(process.env.NYX_TEST_ASSET_ROOT||'.'));const server=app.listen(0);await new Promise(r=>server.once('listening',r));
const origin='http://localhost:'+server.address().port,b=await chromium.launch({channel:'msedge'});
const movie={id:27205,title:'Provider fixture',genres:[],cast:[]};
try{
const p=await b.newPage({viewport:{width:390,height:850}});
await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==origin)return ['nhdapi.com','watch.rivestream.app','framextv.tech'].includes(u.hostname)?r.fulfill({contentType:'text/html',body:'<button>Play fixture</button>'}):r.abort();
if(u.pathname.includes('/playback'))return r.fulfill({status:503,json:{error:'Unavailable'}});
if(u.pathname==='/api/movies/episodes')return r.fulfill({json:{results:[]}});
if(u.pathname==='/api/movies/27205')return r.fulfill({json:movie});
if(u.pathname==='/api/movies/search')return r.fulfill({json:{results:[movie],page:1,totalPages:1}});
return r.continue();});
await p.goto(origin+'/apps/movies/#movie=27205');await p.locator('#watch').click();await p.locator('#player iframe').waitFor();
await p.locator('li[data-state="Player loaded"] [data-provider=nhd]').waitFor({state:'attached'});
for(const id of ['rive','framextv']){
 const host=id==='rive'?'https://watch.rivestream.app':'https://framextv.tech';
 const navigation=p.waitForEvent('framenavigated',{predicate:f=>f.url().startsWith(host)});
 await p.locator('#choose-source').click();await p.locator('[data-provider='+id+']').hover();await p.waitForTimeout(250);await p.locator('[data-provider='+id+']').click({delay:100});await navigation;
 await p.locator('li[data-state="Player loaded"] [data-provider='+id+']').waitFor({state:'attached'});
 await p.frameLocator('#player iframe').getByText('Play fixture').waitFor();
 assert.equal(await p.locator('#player iframe').count(),1);
 assert.equal(await p.locator('#player iframe').getAttribute('sandbox'),'allow-scripts allow-same-origin allow-forms allow-presentation');
}
await p.evaluate(()=>{const f=document.querySelector('#player iframe');for(const currentTime of [1,2])dispatchEvent(new MessageEvent('message',{source:f.contentWindow,origin:'https://evil.example',data:{event:'frameXTV:timeupdate',currentTime}}));});
assert(!(await p.locator('#source-list').innerText()).includes('Playing'));
await p.frames().find(f=>f.url().startsWith('https://framextv.tech')).evaluate(()=>{for(const currentTime of [1,2])parent.postMessage({event:'frameXTV:timeupdate',currentTime},'*');});
await p.waitForFunction(()=>document.querySelector('#source-list').textContent.includes('Playing'));
assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await p.locator('#close-player').click();assert.equal(await p.locator('#player iframe').count(),0);
const invalid=[
 'https://watch.rivestream.app/embed?type=movie&id=1&id=2',
 'https://watch.rivestream.app/embed?type=movie&id=1&url=https://evil.example',
 'https://watch.rivestream.app/embed?type=tv&id=1&season=1&episode=0',
 'https://watch.rivestream.app/embed/agg?type=movie&id=1',
 'https://framextv.tech/embed/1?url=https://evil.example',
 'https://framextv.tech.evil.example/embed/1',
 'http://framextv.tech/embed/1'
];
movie.sources=[...invalid.map((url,i)=>({id:'bad'+i,name:'Invalid',url})),{id:'rive',name:'Rive',url:'https://watch.rivestream.app/embed?type=tv&id=1396&season=1&episode=2'},{id:'framextv',name:'FrameXTV',url:'https://framextv.tech/embed/1396/1/2'}];
await p.reload();await p.locator('#watch').click();await p.frameLocator('#player iframe').getByText('Play fixture').waitFor();
assert.deepEqual(await p.locator('[data-provider]').evaluateAll(es=>es.map(e=>e.dataset.provider)),['rive','framextv']);
console.log('PASS new providers: selection, sandbox, frame cleanup, canonical URL restrictions, progress origin and mobile bounds.');
}finally{await b.close();await new Promise(r=>server.close(r));}
