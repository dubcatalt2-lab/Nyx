import {sourceFile} from '../scripture/source-layout.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {chromium} from 'playwright';
import {invidiousEmbedOrigin} from '../scripture/nyxtube-invidious.mjs';
assert.equal(invidiousEmbedOrigin({}), 'https://invidious.tiekoetter.com');
for (const value of ['', 'http://localhost', 'https://user:pass@example.com', 'https://example.com/path', 'https://example.com?url=x', 'https://example.com:8080']) assert.equal(invidiousEmbedOrigin({NYX_INVIDIOUS_EMBED_ORIGIN:value}), '');
const live=process.env.NYX_TEST_INVIDIOUS_LIVE==='1', root=resolve(process.env.NYX_PALETTE_ROOT||'.'), base='http://nyx.test';
const origin=live?'https://invidious.tiekoetter.com':'https://invidious.fixture.test';
const id='aqz-KE-bpKQ', video={id,title:'Big Buck Bunny',creator:'Blender Foundation',durationSeconds:635,detailsPending:false,isShort:false};
const workspace=await chromium.launch({channel:'msedge',headless:true});
try {
 const context=await workspace.newContext({viewport:{width:1280,height:900}});
 let nativeAvailable=!live,pending=false,detailStatus=503,detailCalls=0;
 const shortRequests=new Map();
 await context.route(base+'/**', async route=>{
  const url=new URL(route.request().url());let path=url.pathname;
  if(path.startsWith('/api/')){
   if(path.endsWith('/video')){detailCalls++;return route.fulfill({status:detailStatus,json:{error:'Detail service failed'}});}
   if(path.endsWith('/shorts')){
    const page=Number(url.searchParams.get('page')||1);shortRequests.set(page,(shortRequests.get(page)||0)+1);
    const ids=page===1?['ufvttxs9vEo','9FDVvWR91ww']:page===2?['9FDVvWR91ww','M7lc1UVf-VE','jNQXAC9IVRw']:[];
    return route.fulfill({json:{videos:ids.map(id=>({...video,id,durationSeconds:30,isShort:true,detailsPending:true})),nextPage:page<3?page+1:null}});
   }
   const json=path.endsWith('/status')?{configured:true,nativeAvailable,invidiousEmbedOrigin:origin}:path.includes('/feed')?{videos:[{...video,detailsPending:pending},{...video,id:'YE7VzlLtp-4',isShort:true,durationSeconds:90}]}:path.includes('/shorts')?{videos:[{...video,id:'ufvttxs9vEo',durationSeconds:30,isShort:true,detailsPending:true},{...video,id:'9FDVvWR91ww',durationSeconds:31,isShort:true,detailsPending:true}]}:path.includes('/community')?{comments:{available:false},transcript:{available:false}}:{videos:[],users:[]};
   return route.fulfill({json});
  }
  if(path.endsWith('/'))path+='index.html';
  if(path.endsWith('/invidious-player.js'))return route.fulfill({contentType:'text/javascript',body:''}); // Explicit legacy/adaptive fallback coverage.
  const file=resolve(root,'.'+decodeURIComponent(path));
  try{if(!file.startsWith(root+sep))throw Error('path');await route.fulfill({body:await readFile(sourceFile(file)),contentType:({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.json':'application/json'})[extname(file)]||'application/octet-stream'});}catch{await route.fulfill({status:404,body:'Not found'});}
 });
 if(!live)await context.route(origin+'/**',route=>route.fulfill({contentType:'text/html',body:'<button id="controls" onclick="this.dataset.clicked=\'yes\'">Player controls</button>'}));
 await context.addInitScript(()=>{
  class MockPlayer{
   constructor(id,config){this.node=document.getElementById(id);this.config=config;this.node.innerHTML='<div data-mock-player>Player</div>';this.rate=1;this.time=18;window.__tubeMock=this;setTimeout(()=>config.events.onReady({target:this}),0);}
   getPlayerState(){return 1} getCurrentTime(){return this.time} getDuration(){return 635}
   getVolume(){return 75} getPlaybackRate(){return this.rate} getAvailablePlaybackRates(){return [1,2]}
   isMuted(){return false} playVideo(){} pauseVideo(){} mute(){} unMute(){}
   seekTo(t){this.time=t} setVolume(){} setPlaybackRate(v){this.rate=v} destroy(){this.node.replaceChildren()}
  }
  class Native extends MockPlayer{constructor(id,config){super(id,config);this.isNative=true;this.qualities=[360,720];this.quality=360;this.video={readyState:4,paused:false};}}
  window.YT={Player:MockPlayer,PlayerState:{PLAYING:1,PAUSED:2}};
  Object.defineProperty(window,'NyxNativePlayer',{configurable:true,get:()=>({Player:Native,PlayerState:{PLAYING:1,PAUSED:2}}),set:()=>{}});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/apps/nyxtube/');await page.locator('.video-cover').first().click();
 if(live){
  await page.locator('[data-watch-backup]').click();
  const frame=page.frameLocator('[data-watch-player] iframe');
  await frame.locator('video').waitFor({timeout:20000});
  const play=frame.locator('.vjs-big-play-button');if(await play.isVisible())await play.click();
  await frame.locator('video').evaluate(v=>new Promise((resolve,reject)=>{const started=v.currentTime,t=setTimeout(()=>{clearInterval(i);reject(Error('No playable frames/audio'));},25000),i=setInterval(()=>{if(v.currentTime>started+2&&v.videoWidth>0&&v.readyState>=2){clearInterval(i);clearTimeout(t);resolve();}},250);}));
  const playback=await frame.locator('video').evaluate(v=>({time:v.currentTime,width:v.videoWidth,height:v.videoHeight,audioBytes:v.webkitAudioDecodedByteCount,error:v.error?.message}));
  assert.ok(playback.time>2&&playback.width>0);assert.ok(playback.audioBytes>0,'audio is decoded');assert.equal(playback.error,undefined);
  await frame.locator('video').evaluate(v=>{v.currentTime=60;return v.play()});
  await frame.locator('video').evaluate(v=>new Promise((resolve,reject)=>{const t=setTimeout(()=>{clearInterval(i);reject(Error('Seek did not play'));},25000),i=setInterval(()=>{if(v.currentTime>61&&v.readyState>=2){clearInterval(i);clearTimeout(t);resolve();}},250);}));
  console.log(JSON.stringify({pass:true,liveInvidious:playback,seek:await frame.locator('video').evaluate(v=>v.currentTime)}));
 }else{
  await page.waitForFunction(()=>window.__tubeMock?.isNative);
  await page.evaluate(()=>window.__tubeMock.config.events.onError({target:window.__tubeMock,data:900}));
 }
 const iframe=page.locator('[data-watch-player] iframe');await iframe.waitFor();
 const target=new URL(await iframe.getAttribute('src'));assert.equal(target.origin,origin);assert.equal(target.pathname,'/embed/'+id);assert.equal(target.searchParams.get('local'),'true');assert.equal(target.searchParams.get('quality'),'dash');assert.equal(target.searchParams.get('start'),'18');
 assert.equal(await page.locator('.watch-gesture').evaluate(e=>getComputedStyle(e).display),'none');
 assert.equal(await page.locator('.watch-controls').evaluate(e=>getComputedStyle(e).display),'none');
 assert.equal(await iframe.getAttribute('allowfullscreen'),'');
 if(!live){const controls=page.frameLocator('[data-watch-player] iframe').locator('#controls');await controls.click();assert.equal(await controls.getAttribute('data-clicked'),'yes');}
 for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile watch controls fit');}await page.setViewportSize({width:1280,height:900});
 await page.locator('[data-watch-engine]').click();await page.locator('[data-mock-player]').waitFor();assert.equal(await page.locator('[data-watch-stage]').evaluate(e=>e.classList.contains('invidious-player')),false);
 await page.locator('[data-watch-backup]').click();await iframe.waitFor();await page.locator('[data-back]').click();assert.equal(await iframe.count(),0,'leaving watch stops embedded audio');
 const beforeShorts=detailCalls;
 await page.locator('[data-view-button="shorts"]').click();
 const shortFrame=page.locator('[data-short-player] iframe');await shortFrame.waitFor();
 assert.ok((await shortFrame.getAttribute('src')).includes('/embed/ufvttxs9vEo?'));
 assert.equal(detailCalls,beforeShorts,'metadata failures do not prevent opening a Short');
 if(!live){const controls=page.frameLocator('[data-short-player] iframe').locator('#controls');await controls.click();assert.equal(await controls.getAttribute('data-clicked'),'yes','Short player controls receive clicks');}
 for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Short and navigation buttons fit mobile');}await page.setViewportSize({width:1280,height:900});
 if(live){
  const frame=page.frameLocator('[data-short-player] iframe');await frame.locator('video').waitFor({timeout:20000});
  const play=frame.locator('.vjs-big-play-button');if(await play.isVisible())await play.click();
  await frame.locator('video').evaluate(v=>new Promise((resolve,reject)=>{const t=setTimeout(()=>{clearInterval(i);reject(Error('Short did not play'));},25000),i=setInterval(()=>{if(v.currentTime>2&&v.videoWidth>0){clearTimeout(t);clearInterval(i);resolve();}},250);}));
  const short=await frame.locator('video').evaluate(v=>({time:v.currentTime,width:v.videoWidth,height:v.videoHeight,error:v.error?.message}));
  assert.ok(short.height>short.width);assert.equal(short.error,undefined);console.log(JSON.stringify({liveShort:short}));
 }
 await page.locator('[data-short-next]').click();await page.waitForFunction(()=>document.querySelector('[data-short-player] iframe')?.src.includes('/embed/9FDVvWR91ww?'));
 assert.equal(await shortFrame.count(),1,'one active Short, no hidden players or background audio');
 if(!live){
  await page.locator('[data-short-next]').click();await page.waitForFunction(()=>document.querySelector('[data-short-player] iframe')?.src.includes('/embed/M7lc1UVf-VE?'));
  await page.locator('[data-short-next]').click();await page.waitForFunction(()=>document.querySelector('[data-short-player] iframe')?.src.includes('/embed/jNQXAC9IVRw?'));
  await page.locator('[data-short-next]').click();assert.ok((await shortFrame.getAttribute('src')).includes('/embed/jNQXAC9IVRw?'),'end never loops back to the first two Shorts');
  assert.match(await page.locator('[data-notice]').innerText(),/No more Shorts/);
  await page.locator('[data-short-previous]').click();await page.waitForFunction(()=>document.querySelector('[data-short-player] iframe')?.src.includes('/embed/M7lc1UVf-VE?'));
  assert.deepEqual([...shortRequests],[[1,1],[2,1],[3,1]],'refills coalesce, deduplicate and stop at exhaustion');
 }
 await page.locator('[data-view-button="home"]').click();assert.equal(await shortFrame.count(),0);
 if(!live){
  pending=true;await page.reload();await page.locator('.video-cover').first().click();await iframe.waitFor();assert.equal(detailCalls,beforeShorts+1);
  detailStatus=422;await page.reload();await page.locator('.video-cover').first().click();await page.waitForFunction(()=>document.querySelector('[data-notice]').textContent==='Detail service failed');assert.equal(await iframe.count(),0,'explicit video denials do not fall back');pending=false;
 }
 nativeAvailable=false;
 await page.goto(base+'/apps/drop/tube.html');assert.equal(await page.locator('.video-card').count(),1,'Drop keeps Shorts excluded');
 await page.locator('.video-cover').first().click();await page.locator('[data-watch-backup]').click();await iframe.waitFor();
 await page.evaluate(()=>postMessage({type:'drop:tube-pause'},location.origin));await page.waitForFunction(()=>!document.querySelector('[data-watch-player] iframe'));
 assert.deepEqual(errors,[]);console.log('PASS native-error fallback, explicit Invidious selection, initial state transfer, reachable player controls, return/cleanup, Shorts discovery-independent playback/cleanup, and Drop Shorts/pause isolation');
}finally{await workspace.close();}
