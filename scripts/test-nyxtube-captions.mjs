import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {captionSegments,createTubeCaptions} from '../lib/nyxtube-captions.mjs';

const events=Array.from({length:5000},(_,i)=>({tStartMs:i*4000,dDurationMs:5000,segs:[{utf8:`Caption ${i} <script>text</script>`}]}));
assert.equal(captionSegments({events})[0].durationSeconds,4);
let requests=0,extractions=0;
const captions=createTubeCaptions({tracks:async()=>{extractions++;return [{languageCode:'en',kind:'manual',url:'https://www.youtube.com/api/timedtext?v=fixture'}];},request:async()=>{requests++;return new Response(JSON.stringify({events}));}});
const id='rfscVS0vtbw';
const windows=await Promise.all([captions(id,10800),captions(id,10800)]);
assert.equal(extractions,1);assert.equal(requests,1);assert(windows[0].segments.some(s=>s.startSeconds===10800));assert(windows[0].segments.length<40);assert.equal(windows[0].until,10860);
await captions(id,16000);assert.equal(requests,1);
await assert.rejects(captions('invalid',0));await assert.rejects(captions(id,Infinity));
let unsafeFetch=false;const blocked=createTubeCaptions({tracks:async()=>[{url:'https://youtube.com@127.0.0.1/api/timedtext'}],request:async()=>{unsafeFetch=true;}});assert.equal((await blocked(id,0)).available,false);assert.equal(unsafeFetch,false);
const oversized=createTubeCaptions({tracks:async()=>[{url:'https://www.youtube.com/api/timedtext'}],request:async()=>new Response('x',{headers:{'content-length':String(9*1024*1024)}})});assert.equal((await oversized(id,0)).available,false);
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();await page.setContent('<div id="player"></div>');
 await page.evaluate(()=>{
  window.captionRequests=[];window.errors=[];
  window.fetch=async url=>({ok:true,json:async()=>url.includes('/formats/')?{formats:[{height:720}]}:url.includes('/prepare/')?{state:'ready',kind:'hls',url:'/api/nyxtube/native/hls/'+'a'.repeat(32)+'/master.m3u8'}:(captionRequests.push(url),{available:true,language:'English',start:Math.max(0,Number(new URL(url,'https://fixture.test').searchParams.get('at'))-10),until:Number(new URL(url,'https://fixture.test').searchParams.get('at'))+60,segments:[{startSeconds:10800,durationSeconds:4,text:'Late <script>caption</script>'}]})});
  window.Hls=class{static isSupported(){return true}static Events={ERROR:'error'};static ErrorDetails={};static ErrorTypes={};on(){}loadSource(){}attachMedia(){}destroy(){}stopLoad(){this.stops=(this.stops||0)+1}startLoad(){this.starts=(this.starts||0)+1}};
 });
 await page.addScriptTag({content:readFileSync('apps/nyxtube/native-player.js','utf8')});
 await page.evaluate(()=>{window.player=new NyxNativePlayer.Player('player',{videoId:'rfscVS0vtbw',events:{onError:e=>errors.push(e.target.failure)}})});
 await page.waitForFunction(()=>Boolean(player.hls));
 await page.evaluate(async()=>{player.video.currentTime=10800;await player.setCaptions(true)});
 assert.equal(await page.evaluate(()=>player.captionTrack.mode),'showing');assert.equal(await page.evaluate(()=>player.captionTrack.cues[0].startTime),10800);assert.equal(await page.evaluate(()=>player.captionTrack.cues[0].getCueAsHTML().querySelector('script')),null);
 await page.evaluate(async()=>{player.video.currentTime=16000;await player.updateCaptions(true)});assert.equal(await page.evaluate(()=>captionRequests.length),2);
 await page.evaluate(()=>player.setCaptions(false));assert.equal(await page.evaluate(()=>player.captionTrack.mode),'disabled');
 await page.evaluate(()=>{player.lastProgress=Date.now()-91000;player.checkProgress()});assert.equal(await page.evaluate(()=>player.hls.starts),1);assert.equal(await page.evaluate(()=>errors.length),0);
 await page.evaluate(()=>{player.lastProgress=Date.now()-91000;player.checkProgress();player.checkProgress()});assert.equal(await page.evaluate(()=>errors.length),1);
 await page.evaluate(()=>player.destroy());assert.equal(await page.locator('video').count(),0);
 console.log('PASS captions after three hours, bounded seek windows/shared cache, URL/size rejection, escaped native cues, toggle/seek/cleanup, and one stall recovery followed by finite failure');
}finally{await browser.close()}
