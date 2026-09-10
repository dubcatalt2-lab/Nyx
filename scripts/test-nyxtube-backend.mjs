import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import express from 'express';
import { createTubeBackend, TubeError, extractionFailure, publicMediaUrl, mediaChoices } from '../lib/nyxtube-streaming.mjs';
import { tubeStreamingRoutes } from '../lib/nyxtube-routes.mjs';
const exec=promisify(execFile), root=await mkdtemp(join(tmpdir(),'nyx-tube-test-'));
const id='YE7VzlLtp-4'; let backend,server;
try {
  const ffmpeg=process.env.NYX_FFMPEG_BIN||'ffmpeg';
  await exec(ffmpeg,['-nostdin','-v','error','-f','lavfi','-i','color=c=blue:s=320x180:r=24','-t','4','-c:v','libx264','-pix_fmt','yuv420p',join(root,'video.mp4')]);
  await exec(ffmpeg,['-nostdin','-v','error','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','4','-c:a','aac',join(root,'audio.m4a')]);
  const bytes={video:await readFile(join(root,'video.mp4')),audio:await readFile(join(root,'audio.m4a'))};
  const cookies=join(root,'private.txt');await writeFile(cookies,'PRIVATE-TEST-SESSION');
  const info={id,availability:'public',duration:4,formats:[{format_id:'18',url:'https://r1.googlevideo.com/video',protocol:'https',ext:'mp4',vcodec:'avc1.4d',acodec:'none',height:720},{format_id:'140',url:'https://r1.googlevideo.com/audio',protocol:'https',ext:'m4a',vcodec:'none',acodec:'mp4a.40.2'}]};
  let mode='ok',calls=0,clock=Date.now(), mediaCalls=0;
  const options={env:{NYX_YOUTUBE_NATIVE_ENABLED:'1',NYX_YOUTUBE_CACHE_DIR:join(root,'cache'),NYX_YOUTUBE_COOKIES_FILE:cookies,NYX_YTDLP_BIN:'mock-ytdlp',NYX_FFMPEG_BIN:ffmpeg},now:()=>clock,
    execute:async(binary,args,opts)=>{
      if(binary!=='mock-ytdlp'){await exec(binary,args,{timeout:opts.timeout});return '';}
      calls++; const sessionPath=args[args.indexOf('--cookies')+1];assert.equal(await readFile(sessionPath,'utf8'),'PRIVATE-TEST-SESSION');assert.ok(!args.includes('--cookies-from-browser'));
      if(mode==='auth')throw extractionFailure('Sign in to confirm you are not a bot PRIVATE-TEST-SESSION');
      if(mode==='removed')throw extractionFailure('Video unavailable');
      return JSON.stringify(mode==='large'?{...info,formats:info.formats.map(f=>({...f,height:f.height?480:undefined,filesize:600*1024**2}))}:info);
    },fetch:async(url,options)=>{mediaCalls++;if(mediaCalls===2)throw new TypeError('Transient connection reset');if(mediaCalls===3)return new Response(new ReadableStream({start(controller){controller.enqueue(bytes.video.subarray(0,100));setTimeout(()=>controller.error(new Error('Interrupted range')),10);}}),{status:206,headers:{'Content-Type':'video/mp4','Content-Range':`bytes 0-999/${bytes.video.length}`}});if(mediaCalls===1)return new Response(null,{status:302,headers:{Location:'https://r2.googlevideo.com/video'}});assert.equal(options.redirect,'manual');assert.ok(!JSON.stringify(options.headers).includes('PRIVATE'));const data=bytes[url.endsWith('audio')?'audio':'video'];const range=/bytes=(\d+)-(\d+)/.exec(options.headers.Range||'');const start=range?Number(range[1]):0,end=range?Math.min(Number(range[2]),start+999,data.length-1):data.length-1;return new Response(data.subarray(start,end+1),{status:range?206:200,headers:{'Content-Type':url.endsWith('audio')?'audio/mp4':'video/mp4',...(range?{'Content-Range':`bytes ${start}-${end}/${data.length}`}:{})}});}};
  backend=createTubeBackend(options);
  assert.equal((await backend.status()).state,'unchecked');
  assert.throws(()=>publicMediaUrl('https://googlevideo.com.evil.test/media'));
  assert.throws(()=>publicMediaUrl('http://r1.googlevideo.com/media'));
  assert.throws(()=>publicMediaUrl('https://user:pass@r1.googlevideo.com/media'));
  assert.throws(()=>mediaChoices({...info,availability:'private'}));
  assert.throws(()=>mediaChoices({...info,is_live:true}));
  for (const duration of [0, -1, NaN, Infinity, undefined]) assert.throws(()=>mediaChoices({...info,duration}));
  for (const duration of [3600, 3601, 7200, 86400]) assert.equal(mediaChoices({...info,duration}).length,1);
  // Long metadata exercises the full preparation path using the small real media fixture.
  info.duration=7200;
  assert.deepEqual(await backend.formats(id),[{height:720}]);
  const preparing=await backend.prepare(id,720);assert.equal(preparing.state,'preparing');
  assert.equal((await backend.prepare(id,720)).state,'preparing');
  await assert.rejects(backend.prepare('aqz-KE-bpKQ',720),e=>e.code==='busy');
  const deadline=Date.now()+15000;
  while(backend.jobStatus(id,720).state==='preparing'&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));
  assert.equal(backend.jobStatus(id,720).state,'ready'); assert.equal(calls,1);
  assert.equal((await backend.status()).state,'working');
  const name=`${id}-720.mp4`, lease=backend.lease(name);assert.ok(lease);
  const probe=await exec(ffmpeg,['-nostdin','-hide_banner','-i',lease.path,'-f','null','-']);
  assert.match(probe.stderr,/Video:/);assert.match(probe.stderr,/Audio:/);lease.release();
  assert.ok(!(await readdir(join(root,'cache'))).some(n=>n.startsWith('work-')));
  assert.ok(!JSON.stringify(await backend.status()).includes('PRIVATE'));
  const app=express();let deniedPublic=false;
  app.use(tubeStreamingRoutes({backend,sameOrigin:req=>req.headers.origin!=='https://evil.test',clientIp:()=> 'test-ip',owner:async req=>{if(req.headers.authorization!=='Bearer owner')throw Object.assign(new Error('Owner required'),{status:403});},publicVideo:async()=>{if(deniedPublic)throw Object.assign(new Error('Unavailable'),{status:404});}}));
  server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base+'/api/owner-dashboard/nyxtube')).status,403);
  assert.equal((await fetch(base+'/api/owner-dashboard/nyxtube',{headers:{Authorization:'Bearer owner'}})).status,200);
  assert.equal((await fetch(base+`/api/nyxtube/native/media/${name}`,{headers:{Origin:'https://evil.test'}})).status,403);
  const range=await fetch(base+`/api/nyxtube/native/media/${name}`,{headers:{Range:'bytes=20-99'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,80);
  const invalidRange=await fetch(base+`/api/nyxtube/native/media/${name}`,{headers:{Range:'bytes=999999999-'}});assert.equal(invalidRange.status,416);await invalidRange.arrayBuffer();
  deniedPublic=true;assert.equal((await fetch(base+`/api/nyxtube/native/prepare/${id}/720`,{method:'POST'})).status,404);deniedPublic=false;
  for(let i=0;i<11;i++) { const r=await fetch(base+`/api/nyxtube/native/formats/${id}`);if(i===10)assert.equal(r.status,429);await r.arrayBuffer(); }
  mode='auth';clock+=6*60000;assert.equal((await backend.check()).state,'trouble');
  assert.deepEqual(await backend.formats(id),[{height:720}], 'Cached playback should survive a service cooldown');
  await assert.rejects(backend.check(),e=>e.code==='busy');
  clock+=6*60000;assert.equal((await backend.check()).state,'login_required');
  assert.ok(!JSON.stringify(await backend.status()).includes('PRIVATE'));
  clock+=6*60000;mode='ok';assert.equal((await backend.check()).state,'working');
  clock+=6*60000;mode='removed';assert.equal((await backend.check()).state,'working');
  await backend.close();
  backend=createTubeBackend(options);assert.equal((await backend.status()).state,'unchecked');assert.ok((await backend.status()).lastSuccess);
  assert.equal(backend.jobStatus(id,720).state,'ready');
  clock+=6*60000;mode='large';await backend.prepare(id,480);
  assert.deepEqual(await backend.formats(id),[{height:720}], 'Cached formats should remain available while another quality prepares');
  while((await backend.status()).activeJobs)await new Promise(r=>setTimeout(r,30));
  assert.throws(()=>backend.jobStatus(id,480),/too large/);
  assert.ok(!(await readdir(join(root,'cache'))).some(n=>n.startsWith('work-')));
  const extractionCalls=calls;
  const shared=createTubeBackend({...options,env:{...options.env,NYX_YOUTUBE_CACHE_DIR:join(root,'shared-catalog-cache')},videoInfo:async()=>info});
  try {
    assert.deepEqual(await shared.formats(id),[{height:720}]);
    await shared.prepare(id,720);
    const sharedDeadline=Date.now()+15000;
    while((await shared.status()).activeJobs&&Date.now()<sharedDeadline)await new Promise(r=>setTimeout(r,30));
    assert.equal(shared.jobStatus(id,720).state,'ready');
    assert.equal(calls,extractionCalls,'Native playback must reuse catalog metadata without another extraction');
  } finally {await shared.close();}
  console.log('NyxTube backend: real MP4 audio/video merge, cache reuse, ranges, auth isolation, cooldown/recovery, owner access and cleanup passed.');
} finally {await backend?.close();await new Promise(r=>server?server.close(r):r());await rm(root,{recursive:true,force:true});}
