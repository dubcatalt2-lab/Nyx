import {sourceFile} from '../scripture/source-layout.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createInvidiousPlayback,invidiousPlaybackSource} from '../scripture/nyxtube-invidious-playback.mjs';
const id='d1l3jkw2eMs',origin='https://video.example.org';
const html=(src=`https://eu.companion.video.example.org/companion/latest_version?id=${id}&local=true&check=fixture`)=>`<script id="video_data" type="application/json">${JSON.stringify({id,length_seconds:26})}</script><source src="${src}" type="video/mp4">`;
assert.equal(invidiousPlaybackSource(html(),id,origin).id,id);
for(const src of ['http://video.example.org/latest_version','https://evil.example/latest_version','https://video.example.org.attacker.test/latest_version','https://video.example.org/other','https://user:pass@video.example.org/latest_version','https://video.example.org:8080/latest_version'])assert.throws(()=>invidiousPlaybackSource(html(src+`?id=${id}&local=true`),id,origin));
assert.throws(()=>invidiousPlaybackSource(html(), 'aaaaaaaaaaa',origin));
let requests=0,release;const gate=new Promise(r=>release=r);
const backend=createInvidiousPlayback({env:{NYX_INVIDIOUS_EMBED_ORIGIN:origin},fetch:async()=>{requests++;await gate;return new Response(html(),{headers:{'Content-Type':'text/html'}});}});
const a=backend.resolve(id),b=backend.resolve(id);release();await Promise.all([a,b]);assert.equal(requests,1);await backend.resolve(id);assert.equal(requests,1);await backend.resolve(id,{refresh:true});assert.equal(requests,2);backend.close();await assert.rejects(()=>backend.resolve(id));
for(const response of [()=>new Response('blocked',{status:429}),()=>new Response('x'.repeat(524289),{headers:{'Content-Type':'text/html'}}),()=>new Response('{}',{headers:{'Content-Type':'application/json'}})]){
 const service=createInvidiousPlayback({env:{NYX_INVIDIOUS_EMBED_ORIGIN:origin},fetch:async()=>response()});await assert.rejects(()=>service.resolve(id));service.close();
}
const workspace=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await workspace.newPage();await page.route('https://fixture.test/**',r=>r.fulfill({contentType:'text/html',body:'<div id="host"></div>'}));
 await page.goto('https://fixture.test/');await page.clock.install();
 await page.addScriptTag({content:await readFile(sourceFile('apps/nyxtube/invidious-player.js'),'utf8')});
 // Model media events explicitly: fixture never downloads public media or reports fake playback as live verification.
 await page.evaluate(()=>{
  window.requests=[];window.events=[];window.loads=0;
  window.fetch=async url=>{requests.push(url);return {ok:true,json:async()=>({id:'d1l3jkw2eMs',type:'video/mp4',url:'https://media.fixture.test/v.mp4'})};};
  HTMLMediaElement.prototype.load=function(){window.loads++;};HTMLMediaElement.prototype.play=async function(){};HTMLMediaElement.prototype.pause=function(){};
  Object.defineProperty(HTMLMediaElement.prototype,'src',{set(value){this.dataset.source=value;},get(){return this.dataset.source;}});
  window.make=()=>window.instance=NyxInvidiousPlayer(document.getElementById('host'),{id:'d1l3jkw2eMs',loop:true,onLoading:loading=>events.push(loading),onFailure:state=>window.failure=state});
  make();
 });
 await page.waitForFunction(()=>window.loads===1);assert.equal(await page.locator('video').count(),1);
 assert.equal(await page.evaluate(()=>events.at(-1)),true,'metadata response alone is not playback success');
 await page.locator('video').evaluate(v=>{Object.defineProperty(v,'readyState',{get:()=>4});Object.defineProperty(v,'paused',{get:()=>false});v.currentTime=7;v.volume=.4;v.muted=false;v.dispatchEvent(new Event('playing'));v.dispatchEvent(new Event('timeupdate'));v.dispatchEvent(new Event('error'));});
 await page.clock.runFor(1100);await page.waitForFunction(()=>requests.length===2);assert.match(await page.evaluate(()=>requests[1]),/refresh=1/);
 await page.locator('video').evaluate(v=>{v.dispatchEvent(new Event('error'));});await page.clock.runFor(3100);await page.waitForFunction(()=>requests.length===3);
 await page.locator('video').evaluate(v=>v.dispatchEvent(new Event('error')));await page.waitForFunction(()=>!!window.failure);
 assert.deepEqual(await page.evaluate(()=>({time:failure.time,volume:failure.volume,muted:failure.muted})),{time:7,volume:40,muted:false});assert.equal(await page.locator('video').count(),0);
 await page.clock.runFor(60000);assert.equal(await page.evaluate(()=>requests.length),3,'retry limit is bounded');
 await page.evaluate(()=>{window.failure=null;make();});await page.waitForFunction(()=>requests.length===4);await page.locator('video').evaluate(v=>v.dispatchEvent(new Event('error')));await page.evaluate(()=>instance.destroy());await page.clock.runFor(30000);assert.equal(await page.evaluate(()=>requests.length),4,'navigation cancels pending retries');
 await page.evaluate(()=>make());await page.waitForFunction(()=>requests.length===5);await page.clock.runFor(16500);await page.waitForFunction(()=>requests.length===6);assert.equal(await page.locator('video').count(),1,'startup stall retries the same player');
 await page.evaluate(()=>instance.pauseVideo());await page.clock.runFor(60000);assert.equal(await page.evaluate(()=>requests.length),6,'intentional pause never causes retry');
 await page.evaluate(()=>instance.destroy());
 console.log('PASS Invidious source validation, bounded resolver/coalescing/cache, media-error retries, startup stall recovery, position/audio preservation and navigation/pause cleanup');
}finally{await workspace.close();}
