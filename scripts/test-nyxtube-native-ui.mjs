import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import express from 'express';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
const root=await mkdtemp(join(tmpdir(),'nyx-native-ui-'));
let server,browser;
try {
  const file=join(root,'fixture.mp4');
  await promisify(execFile)(process.env.NYX_FFMPEG_BIN||'ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','color=c=blue:s=640x360:r=24','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','30','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',file]);
  const video={id:'YE7VzlLtp-4',title:'Native player test',creator:'Test creator',description:'A test video.',durationSeconds:30,captions:true};
  let busyReplies=2,failed=false,hold=false,checks=0,detailCalls=0,ownerState='working',ownerRole='owner';
  const app=express();
  app.get('/assets/vendor/hls.min.js',(_req,res)=>res.sendFile(createRequire(import.meta.url).resolve('hls.js/dist/hls.min.js')));
  app.use('/api/nyxtube',(req,res)=>{
    if(req.path==='/status')return res.json({configured:true,nativeAvailable:true});
    if(req.path==='/video'){detailCalls++;return res.json({videos:[{...video,description:'Loaded full details',likeCount:null}]});}
    if(req.path==='/channel')return res.json({channel:{title:'Creator profile',subscriberCount:null},videos:[{...video,detailsPending:true}]});
    if(req.path.startsWith('/native/media/'))return res.sendFile(file);
    if(req.path.startsWith('/native/formats/') && busyReplies-->0)return res.status(429).json({code:'busy',error:'Another video is being prepared.'});
    if(req.path.startsWith('/native/formats/'))return failed?res.status(503).json({error:'Unavailable'}):res.json({formats:[{height:360},{height:720}]});
    if(req.path.startsWith('/native/prepare/'))return res.json(hold?{state:'preparing'}:{state:'ready',url:`/api/nyxtube/native/media/${video.id}-${req.path.split('/').pop()}.mp4`});
    if(req.path.startsWith('/native/jobs/'))return res.json({state:'preparing'});
    if(req.path==='/community')return res.json({comments:{available:true,comments:[]},transcript:{available:true,segments:[{startSeconds:5,text:'Five seconds'}]}});
    return res.json({videos:[{...video,detailsPending:true}]});
  });
  app.get('/owner-test',(_req,res)=>res.send('<link rel="stylesheet" href="/css/owner-dashboard.css"><link rel="stylesheet" href="/css/owner-dashboard-polish.css"><script src="/js/owner-dashboard.js"></script>'));
  app.use('/api/owner-dashboard',(req,res)=>{
    if(req.path==='/nyxtube/check'){checks++;ownerState='working';}
    if(req.path.startsWith('/nyxtube'))return res.json({enabled:true,state:ownerState,lastSuccess:'2026-09-08T12:00:00Z',cacheLimitBytes:5*1024**3,cacheBytes:1024,activeJobs:0});
    return res.json({access:{role:ownerRole,founder:ownerRole==='owner',permissions:[]},users:[],metrics:{},pagination:{total:0,page:1,pages:1},recentActivity:[]});
  });
  app.use(express.static(process.env.NYX_TEST_STATIC_ROOT||process.cwd()));server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('Page error:',e.message);});
  await page.addInitScript(()=>{window.YT={PlayerState:{PLAYING:1,PAUSED:2},Player:class{
    constructor(id,o){this.options=o;this.node=document.getElementById(id);this.node.innerHTML='<div data-test-embed style="height:100%">YouTube fallback</div>';setTimeout(()=>o.events.onReady({target:this}),0);}
    seekTo(){}setVolume(){}setPlaybackRate(){}mute(){}playVideo(){}pauseVideo(){}getPlayerState(){return 2;}getCurrentTime(){return 0;}getDuration(){return 30;}getAvailablePlaybackRates(){return [1];}getPlaybackRate(){return 1;}destroy(){this.node.replaceChildren();}
  }};});
  await page.goto(base+'/apps/nyxtube/');await page.locator('.video-cover').first().click();
  const spinner=page.locator('.watch-loading-spinner');assert.ok(await spinner.isVisible());
  await page.waitForFunction(()=>document.querySelector('[data-watch-loading]').textContent.includes('Preparing video'));
  assert.match(await page.locator('[data-watch-loading]').innerText(),/Preparing video/);
  const rotation=await spinner.evaluate(el=>getComputedStyle(el).transform);await page.waitForTimeout(150);
  assert.notEqual(await spinner.evaluate(el=>getComputedStyle(el).transform),rotation,'Download circle must rotate');
  const player=page.locator('[data-watch-player] video');await page.waitForFunction(()=>document.querySelector('[data-watch-player] video')?.currentTime>0.1);
  assert.equal(detailCalls,1);assert.equal(await page.locator('[data-watch-description]').innerText(),'Loaded full details');
  assert.equal(await page.locator('[data-watch-likes]').innerText(),'Unavailable');
  assert.ok(await page.locator('[data-watch-loading]').isHidden(),'Loading indicator should hide when ready');
  assert.ok(await player.evaluate(v=>v.videoWidth>0 && v.getBoundingClientRect().height>100),'Native picture is missing or collapsed');
  await player.evaluate(v=>v.dispatchEvent(new Event('waiting')));
  assert.ok(await spinner.isVisible(),'Buffering after playback must show a spinner');
  assert.match(await page.locator('[data-watch-loading]').innerText(),/Loading video chunks/);
  const bufferedRotation=await spinner.evaluate(el=>getComputedStyle(el).transform);await page.waitForTimeout(150);
  assert.notEqual(await spinner.evaluate(el=>getComputedStyle(el).transform),bufferedRotation);
  await page.locator('[data-watch-stage]').screenshot({path:'.codex-artifacts/nyxtube-chunk-buffering.png'});
  await player.evaluate(v=>v.dispatchEvent(new Event('playing')));assert.ok(await spinner.isHidden());
  await page.locator('[data-watch-toggle]').click();assert.ok(await player.evaluate(v=>v.paused));
  await player.evaluate(v=>{v.currentTime=5;v.volume=0;v.playbackRate=1.5;v.muted=true;});
  await page.locator('[data-watch-quality]').selectOption('360');
  await page.waitForFunction(()=>{const v=document.querySelector('[data-watch-player] video');return v?.src.endsWith('-360.mp4')&&v.readyState>=2;});
  const saved=await player.evaluate(v=>({time:v.currentTime,volume:v.volume,rate:v.playbackRate,muted:v.muted,paused:v.paused}));
  assert.ok(Math.abs(saved.time-5)<.5);assert.equal(saved.volume,0);assert.equal(saved.rate,1.5);assert.ok(saved.paused&&saved.muted);
  await page.locator('[data-watch-info-tab="transcript"]').click();await page.locator('.transcript-line').click();
  await page.locator('[data-watch-fullscreen]').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));await page.evaluate(()=>document.exitFullscreen());
  for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow at ${width}`);}
  for(const width of [1280,390,320]) {
    await page.setViewportSize({width,height:900});
    const centered=await page.locator('#icon-settings').evaluate(el=>{const p=el.querySelector('path').getBBox(),c=el.querySelector('circle');return Math.abs(p.x+p.width/2-c.cx.baseVal.value)<.01&&Math.abs(p.y+p.height/2-c.cy.baseVal.value)<.01;});
    assert.ok(centered,'Gear outline and center circle share a center');
    await page.locator('[data-watch-stage]').screenshot({path:`.codex-artifacts/nyxtube-controls-${width}.png`});
    await page.locator('[data-watch-settings]').screenshot({path:`.codex-artifacts/nyxtube-gear-${width}.png`,scale:'css'});
    await page.locator('[data-watch-settings]').click();
    const menu=page.locator('[data-watch-settings-menu]');assert.ok(await menu.isVisible());
    assert.ok(await menu.evaluate(el=>{const a=el.getBoundingClientRect(),b=el.closest('.watch-player').getBoundingClientRect();return a.top>=b.top && a.bottom<=b.bottom;}),'Settings clipped by player');
    await page.locator('[data-watch-speed]').selectOption('1.25');assert.equal(await player.evaluate(v=>v.playbackRate),1.25);
    await page.locator('[data-watch-volume]').fill('35');assert.ok(Math.abs(await player.evaluate(v=>v.volume)-.35)<.01);
    await page.keyboard.press('Escape');assert.ok(await menu.isHidden());
    assert.equal(await page.locator('[data-watch-settings]').getAttribute('aria-expanded'),'false');
  }
  await page.setViewportSize({width:1280,height:900});
  await page.locator('[data-watch-stage]').focus();
  await player.evaluate(v=>{v.pause();v.currentTime=5;v.playbackRate=1.25;});
  await page.keyboard.press('ArrowRight');assert.ok(Math.abs(await player.evaluate(v=>v.currentTime)-15)<.3);
  await page.keyboard.press('ArrowLeft');assert.ok(Math.abs(await player.evaluate(v=>v.currentTime)-5)<.3);
  await page.keyboard.press('Space');await page.waitForFunction(()=>!document.querySelector('[data-watch-player] video').paused);
  await page.keyboard.press('Space');assert.ok(await player.evaluate(v=>v.paused));
  await page.keyboard.down('Space');await page.waitForTimeout(450);assert.equal(await player.evaluate(v=>v.playbackRate),2);
  await page.keyboard.up('Space');assert.equal(await player.evaluate(v=>v.playbackRate),1.25);assert.ok(await player.evaluate(v=>v.paused));
  const picture=await player.boundingBox();await page.mouse.move(picture.x+picture.width*.25,picture.y+picture.height*.25);
  await page.mouse.down();await page.waitForTimeout(450);assert.equal(await player.evaluate(v=>v.playbackRate),2);
  await page.mouse.up();assert.equal(await player.evaluate(v=>v.playbackRate),1.25);assert.ok(await player.evaluate(v=>v.paused));
  await page.mouse.down();await page.waitForTimeout(450);await page.evaluate(()=>dispatchEvent(new Event('blur')));assert.equal(await player.evaluate(v=>v.playbackRate),1.25);await page.mouse.up();
  await player.evaluate(v=>v.pause());await page.locator('[data-watch-settings]').click();await page.locator('[data-watch-speed]').focus();await page.keyboard.press('Space');assert.ok(await player.evaluate(v=>v.paused),'Form controls must not control video');await page.keyboard.press('Escape');
  failed=true;
  await page.locator('[data-watch-quality]').selectOption('720');await page.locator('[data-test-embed]').waitFor();await page.waitForFunction(()=>document.querySelector('[data-watch-engine]').value==='youtube');
  assert.ok(await page.locator('[data-watch-quality]').isDisabled());
  failed=false;
  await page.getByRole('button',{name:'Switch to NyxTube',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-watch-player] video')?.readyState>=1);
  await page.getByRole('button',{name:'Switch to embedded',exact:true}).click();await page.locator('[data-test-embed]').waitFor();
  hold=true;await page.getByRole('button',{name:'Switch to NyxTube',exact:true}).click();await page.locator('[data-back]').click();await page.waitForTimeout(1700);assert.equal(await page.locator('[data-watch-player] video').count(),0);
  await page.goto(base+'/owner-test');await page.evaluate(()=>NyxOwnerDashboard.open({getToken:async()=> 'mock'}));
  await page.locator('[data-owner-tube-state="working"]').waitFor();
  for (const [width,height] of [[1920,1080],[1280,720],[1024,600],[390,844]]) {
    await page.setViewportSize({width,height});
    const boxes=await page.evaluate(()=>{const rect=s=>document.querySelector(s).getBoundingClientRect();return {status:rect('[data-owner-tube-status]').bottom,metricsTop:rect('[data-owner-metrics]').top,metricsBottom:Math.max(rect('[data-owner-metrics]').bottom,...[...document.querySelectorAll('.nyx-owner-metric')].map(el=>el.getBoundingClientRect().bottom)),workspace:rect('.nyx-owner-workspace').top,toolbar:rect('.nyx-owner-panel-head').top};});
    assert.ok(boxes.status<=boxes.metricsTop && boxes.metricsBottom<=boxes.workspace && boxes.metricsBottom<=boxes.toolbar,`Dashboard overlap at ${width}x${height}: ${JSON.stringify(boxes)}`);
  }
  ownerState='login_required';await page.locator('[data-owner-refresh]').first().click();await page.locator('[data-owner-tube-state="login_required"]').waitFor();
  await page.locator('[data-owner-tube-check]').click();await page.locator('[data-owner-tube-state="working"]').waitFor();assert.equal(checks,1);
  await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('[data-owner-tube-status]').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  ownerRole='admin';await page.locator('[data-owner-refresh]').first().click();await page.locator('[data-owner-tube-status]').waitFor({state:'hidden'});
  assert.deepEqual(errors,[]);console.log('Native UI: real video playback, seek, fullscreen, quality state restoration, fallback, cancellation, 320/390px layout and Owner status passed.');
}finally{await browser?.close();await new Promise(r=>server?server.close(r):r());await rm(root,{recursive:true,force:true});}
