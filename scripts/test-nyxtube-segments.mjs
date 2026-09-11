import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import express from 'express';
import { chromium } from 'playwright';
import { createTubeBackend } from '../lib/nyxtube-streaming.mjs';
import { tubeStreamingRoutes } from '../lib/nyxtube-routes.mjs';
import { readMp4Index, segmentTrack } from '../lib/nyxtube-mp4.mjs';

const require=createRequire(import.meta.url), exec=promisify(execFile);
const ffmpeg=process.env.NYX_FFMPEG_BIN||require('@ffmpeg-installer/ffmpeg').path;
const root=await mkdtemp(join(tmpdir(),'nyx-hls-test-')), id='YE7VzlLtp-4';
let backend,server,browser,clock=Date.now();
try {
  await exec(ffmpeg,['-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=24','-t','120','-c:v','libx264','-g','48','-bf','2','-movflags','+faststart',join(root,'video.mp4')]);
  await exec(ffmpeg,['-v','error','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','120','-c:a','aac',join(root,'audio.m4a')]);
  const bytes={video:await readFile(join(root,'video.mp4')),audio:await readFile(join(root,'audio.m4a'))};
  const localIndex=async kind=>readMp4Index(async(a,b)=>({data:bytes[kind].subarray(a,b+1),total:bytes[kind].length}),kind);
  const videoIndex=await localIndex('video'), audioIndex=await localIndex('audio');
  const parts=segmentTrack(videoIndex);
  assert.equal(parts.length,20);assert.match(audioIndex.codec,/^mp4a/);
  // A >3 GiB source is eligible: only the MP4 index is read, not the skipped mdat/free payload.
  const giant=Buffer.alloc(8);giant.writeUInt32BE(0xc0000000);giant.write('free',4);
  const moovEnd=bytes.audio.indexOf(Buffer.from('moov'))-4;
  let indexBytes=0;
  const shifted=Buffer.concat([bytes.audio.subarray(0,moovEnd),giant]);
  const newMoovStart=moovEnd+0xc0000000,total=newMoovStart+bytes.audio.length-moovEnd;
  const large=await readMp4Index(async(a,b)=>{
    const data=a>=newMoovStart?bytes.audio.subarray(a-newMoovStart+moovEnd,b-newMoovStart+moovEnd+1):shifted.subarray(a,b+1);
    indexBytes+=data.length;return {data,total};
  },'audio');
  assert.equal(large.count,audioIndex.count);assert.ok(indexBytes<100000,'Large file should require only its index');
  await assert.rejects(readMp4Index(async()=>({data:Buffer.alloc(16),total:16}),'video'));

  let rangeCalls=[],failNext=0,hold=false,cancelled=0,active=0,maxActive=0;
  const info={id,availability:'public',duration:120,formats:[
    {format_id:'136',url:'https://r1.googlevideo.com/video',protocol:'https',ext:'mp4',vcodec:'avc1.64000c',acodec:'none',height:720,filesize:3*1024**3},
    {format_id:'135',url:'https://r1.googlevideo.com/video',protocol:'https',ext:'mp4',vcodec:'avc1.64000c',acodec:'none',height:480},
    {format_id:'140',url:'https://r1.googlevideo.com/audio',protocol:'https',ext:'m4a',vcodec:'none',acodec:'mp4a.40.2'}]};
  const options={env:{NYX_YOUTUBE_NATIVE_ENABLED:'1',NYX_YOUTUBE_CACHE_DIR:join(root,'cache')},now:()=>clock,videoInfo:async()=>info,
    fetch:async(url,{headers,signal})=>{
      const kind=url.endsWith('/audio')?'audio':'video',data=bytes[kind];
      const [,a,b]=/^bytes=(\d+)-(\d+)$/.exec(headers.Range),start=Number(a),end=Math.min(Number(b),data.length-1);
      if(failNext-->0)throw new TypeError('Transient reset');
      rangeCalls.push({kind,start,end});active++;maxActive=Math.max(maxActive,active);
      try {
        if(hold)await new Promise((_,reject)=>{const abort=()=>{cancelled++;reject(new Error('Aborted'));};signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});
        else await new Promise(r=>setTimeout(r,10));
        return new Response(data.subarray(start,end+1),{status:206,headers:{'Content-Type':`${kind}/mp4`,'Content-Range':`bytes ${start}-${end}/${data.length}`}});
      } finally {active--;}
    }};
  backend=createTubeBackend(options);
  const prepared=await backend.prepareSegments(id,720), token=prepared.url.split('/').at(-2);
  assert.equal(prepared.kind,'hls');assert.equal((await backend.status()).cacheBytes,0);
  const master=await backend.playlist(token,'master.m3u8');assert.match(master,/AUDIO="audio"/);assert.ok(!master.includes('googlevideo'));
  assert.match(await backend.playlist(token,'video.m3u8'),/#EXT-X-ENDLIST/);
  rangeCalls=[];failNext=1;
  const shared=await Promise.all(Array.from({length:12},()=>backend.segment(token,'video',0,new AbortController().signal)));
  assert.equal(rangeCalls.length,1,'Concurrent requests must share one download');shared.forEach(l=>l.release());
  const init=await backend.init(token,'video');
  await writeFile(join(root,'fragment.mp4'),Buffer.concat([init,await readFile(shared[0].path)]));
  await exec(ffmpeg,['-v','error','-i',join(root,'fragment.mp4'),'-f','null','-']);
  rangeCalls=[];
  const late=await backend.segment(token,'video',15,new AbortController().signal);late.release();
  assert.ok(rangeCalls.every(r=>r.start>=videoIndex.offset[parts[15].start]),'Seek should skip earlier video bytes');
  assert.ok((await backend.status()).cacheBytes<bytes.video.length/4);

  // All consumers leaving aborts a shared job; one leaving does not cancel another.
  hold=true;
  const a=new AbortController(),b=new AbortController();
  const first=backend.segment(token,'audio',1,a.signal).catch(e=>e),second=backend.segment(token,'audio',1,b.signal).catch(e=>e);
  await new Promise(r=>setTimeout(r,50));a.abort();await first;assert.equal(cancelled,0);
  b.abort();await second;await new Promise(r=>setTimeout(r,50));assert.equal(cancelled,1);hold=false;
  assert.ok(!(await readdir(join(root,'cache'))).some(n=>n.startsWith('work-')));
  hold=true;
  const controllers=Array.from({length:12},()=>new AbortController());
  const queued=controllers.map((c,i)=>backend.segment(token,'audio',i,c.signal).catch(e=>e));
  await new Promise(r=>setTimeout(r,60));assert.ok(maxActive<=2,'At most two segment downloads');
  controllers.forEach(c=>c.abort());const results=await Promise.all(queued);assert.ok(results.some(e=>e.code==='busy'));
  await new Promise(r=>setTimeout(r,60));hold=false;

  let deny=false;
  const app=express();
  app.use(tubeStreamingRoutes({backend,sameOrigin:req=>req.headers.origin!=='https://evil.test',clientIp:()=> 'fixture',owner:async()=>{},publicVideo:async()=>{if(deny)throw Object.assign(new Error('Unavailable'),{status:404});}}));
  app.get('/assets/vendor/hls.min.js',(_req,res)=>res.sendFile(require.resolve('hls.js/dist/hls.min.js')));
  app.get('/test',(_req,res)=>res.send('<div id="player" style="width:640px;height:360px"></div><script src="/assets/vendor/hls.min.js"></script><script src="/apps/nyxtube/native-player.js"></script>'));
  app.use(express.static(resolve(process.env.NYX_TEST_STATIC_ROOT||'.')));
  server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base+prepared.url,{headers:{Origin:'https://evil.test'}})).status,403);
  assert.equal((await fetch(base+prepared.url.replace('master.m3u8','video--1.m4s'))).status,404);
  assert.equal((await fetch(base+prepared.url.replace(token,'a'.repeat(32)))).status,410);
  deny=true;assert.equal((await fetch(base+`/api/nyxtube/native/prepare/${id}/720?mode=hls`,{method:'POST'})).status,404);deny=false;
  browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/test');rangeCalls=[];
  await page.evaluate(id=>{
    window.events=[];
    window.player=new NyxNativePlayer.Player('player',{videoId:id,expectedDuration:120,events:{onReady:e=>e.target.playVideo(),onError:e=>window.events.push(e.target.failure||'Playback error')}});
  },id);
  await page.waitForFunction(()=>window.player.video.currentTime>1,{},{timeout:30000});
  assert.deepEqual(await page.evaluate(()=>window.events),[]);
  assert.ok(await page.evaluate(()=>window.player.video.videoWidth===320));
  assert.ok(await page.evaluate(()=>Math.abs(window.player.getDuration()-120)<1));
  assert.ok(rangeCalls.reduce((n,r)=>n+r.end-r.start+1,0)<(bytes.video.length+bytes.audio.length)/2,'Start without downloading the whole video');
  await page.evaluate(()=>{window.player.pauseVideo();window.player.setVolume(35);window.player.setPlaybackRate(1.5);window.player.seekTo(96);window.player.playVideo();});
  await page.waitForFunction(()=>window.player.video.currentTime>97&&window.player.video.readyState>=2,{},{timeout:30000});
  assert.deepEqual(await page.evaluate(()=>window.events),[]);
  assert.ok(await page.evaluate(()=>window.player.video.buffered.start(0)>60),'Seeking should discard old distant media');
  await page.evaluate(()=>window.player.pauseVideo());
  assert.equal(await page.evaluate(()=>window.player.getVolume()),35);assert.equal(await page.evaluate(()=>window.player.getPlaybackRate()),1.5);
  await page.evaluate(()=>window.player.destroy());
  assert.deepEqual(errors,[]);
  console.log('PASS: range-only indexing (>3 GiB source), fragment decoding, shared downloads, arbitrary seek, cancellation, concurrency, route checks, browser HLS playback and controls.');

  const pinned=await backend.segment(token,'video',0,new AbortController().signal);
  clock+=121*60000;await backend.prepareSegments(id,720);
  const pressure=await backend.segment(token,'video',13,new AbortController().signal);pressure.release();
  assert.ok((await readFile(pinned.path)).length,'An active response pins its old file during expiry cleanup');
  pinned.release();
  const pressureAgain=await backend.segment(token,'video',12,new AbortController().signal);pressureAgain.release();
  await assert.rejects(readFile(pinned.path),e=>e.code==='ENOENT','An idle expired file is removed after its reader releases it');

  // Restart uses disk fragments; old idle entries expire, while a recently used fragment survives.
  const cached=await backend.segment(token,'video',0,new AbortController().signal);cached.release();
  const freshName=cached.path;await backend.close();
  clock+=121*60000;
  await utimes(freshName,new Date(clock-119*60000),new Date(clock-119*60000));
  backend=createTubeBackend(options);await backend.status();
  const diskFiles=(await readdir(join(root,'cache'))).filter(n=>n.endsWith('.m4s'));
  assert.equal(diskFiles.length,1);assert.ok(freshName.endsWith(diskFiles[0]));
  const restarted=await backend.prepareSegments(id,720);assert.equal(restarted.url,prepared.url);
  rangeCalls=[];const reused=await backend.segment(token,'video',0,new AbortController().signal);reused.release();assert.equal(rangeCalls.length,0);
  console.log('PASS: two-hour idle cleanup and restart cache reuse.');

  // Adaptive YouTube files use a global sidx and pre-fragmented media, unlike a regular MP4.
  await backend.close();
  for(const kind of ['video','audio']) {
    const input=join(root,kind==='video'?'video.mp4':'audio.m4a'),output=join(root,`${kind}-dash.mp4`);
    await exec(ffmpeg,['-v','error','-i',input,'-map',`0:${kind==='video'?'v':'a'}:0`,'-c','copy','-movflags','+dash+global_sidx','-frag_duration','6000000',output]);
    bytes[kind]=await readFile(output);
    const index=await localIndex(kind);assert.equal(index.fragmented,true);assert.ok(index.segments.length>=19);
  }
  backend=createTubeBackend(options);
  // Recreate routes after restarting the backend with adaptive fixtures.
  server.closeAllConnections();await new Promise(r=>server.close(r));
  const adaptive=express();
  adaptive.use(tubeStreamingRoutes({backend,sameOrigin:()=>true,clientIp:()=> 'adaptive',owner:async()=>{},publicVideo:async()=>{}}));
  adaptive.get('/assets/vendor/hls.min.js',(_req,res)=>res.sendFile(require.resolve('hls.js/dist/hls.min.js')));
  adaptive.get('/test',(_req,res)=>res.send('<div id="player" style="width:640px;height:360px"></div><script src="/assets/vendor/hls.min.js"></script><script src="/apps/nyxtube/native-player.js"></script>'));
  adaptive.use(express.static(resolve(process.env.NYX_TEST_STATIC_ROOT||'.')));
  server=adaptive.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  await page.goto(`http://127.0.0.1:${server.address().port}/test`);rangeCalls=[];
  await page.evaluate(id=>{
    window.events=[];window.player=new NyxNativePlayer.Player('player',{videoId:id,events:{onReady:e=>e.target.playVideo(),onError:e=>window.events.push(e.target.failure)}});
  },id);
  await page.waitForFunction(()=>window.player.video.currentTime>1,{},{timeout:30000});
  assert.deepEqual(await page.evaluate(()=>window.events),[]);
  assert.ok(rangeCalls.reduce((n,r)=>n+r.end-r.start+1,0)<(bytes.video.length+bytes.audio.length)/2);
  await page.evaluate(()=>window.player.seekTo(96));
  await page.waitForFunction(()=>window.player.video.currentTime>97&&window.player.video.readyState>=2,{},{timeout:30000});
  assert.deepEqual(await page.evaluate(()=>window.events),[]);
  const adaptiveReady=await backend.prepareSegments(id,720),adaptiveToken=adaptiveReady.url.split('/').at(-2);
  const fragment=await backend.segment(adaptiveToken,'video',0,new AbortController().signal);
  const indexed=await localIndex('video'),s=indexed.segments[0];
  assert.deepEqual(await readFile(fragment.path),bytes.video.subarray(s.offset,s.offset+s.length),'Existing source fragment is copied without conversion');fragment.release();
  // An idle session can expire while the player remains open. Seeking renews it once
  // and keeps playback at the selected position instead of falling back to YouTube.
  await page.evaluate(()=>window.player.pauseVideo());clock+=121*60000;
  await page.evaluate(()=>{window.player.seekTo(48);window.player.playVideo();});
  await page.waitForFunction(()=>window.player.renewedAt&&window.player.video.currentTime>49&&window.player.video.readyState>=2,{},{timeout:30000});
  assert.deepEqual(await page.evaluate(()=>window.events),[]);
  await page.evaluate(id=>{
    window.player.destroy();
    window.player=new NyxNativePlayer.Player('player',{videoId:id,quality:480,startTime:77,events:{onError:e=>window.events.push(e.target.failure),onReady:e=>{
      e.target.seekTo(77);e.target.setVolume(35);e.target.setPlaybackRate(1.5);e.target.mute();e.target.pauseVideo();
    }}});
  },id);
  await page.waitForFunction(()=>window.player.video.readyState>=2&&window.player.video.currentTime>=77,{},{timeout:30000});
  assert.deepEqual(await page.evaluate(()=>({quality:window.player.quality,paused:window.player.video.paused,muted:window.player.isMuted(),volume:window.player.getVolume(),rate:window.player.getPlaybackRate()})),
    {quality:480,paused:true,muted:true,volume:35,rate:1.5});
  assert.deepEqual(await page.evaluate(()=>window.events),[]);
  await page.evaluate(()=>window.player.destroy());
  hold=true;
  const pending=backend.segment(adaptiveToken,'audio',19,new AbortController().signal).catch(e=>e);
  await new Promise(r=>setTimeout(r,40));assert.ok(active>0);await backend.close();await pending;
  assert.equal(active,0,'Shutdown must wait for active downloads to stop');
  assert.ok(!(await readdir(join(root,'cache'))).some(n=>n.startsWith('work-')));
  console.log('PASS: adaptive fragmented MP4 startup, seek, exact source-fragment reuse, expired-session renewal, and quality restoration.');
} finally {
  await browser?.close();await backend?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
  assert.equal(dirname(resolve(root)),resolve(tmpdir()));
  assert.ok(basename(root).startsWith('nyx-hls-test-'));
  await rm(root,{recursive:true,force:true});
}
