import assert from 'node:assert/strict';
import express from 'express';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=process.env.NYX_TEST_ASSET_ROOT||'.';
const app=express();
app.get('/apps/nyxcloud/',async(_req,res)=>{
 const html=await readFile(root+'/apps/nyxcloud/index.html','utf8');
 res.type('html').send(html.replace(/<script\b(?=[^>]*type=["']?module\b)[^>]*>[\s\S]*?<\/script>/g,'<script type="module" src="./app.js"></script>'));
});
app.get('/apps/nyxcloud/app.js',(_req,res)=>res.type('js').send(`import {loremDesktop} from './lorem.js'; window.dispose=loremDesktop({screen:document.getElementById('screen'),status:t=>document.getElementById('status').textContent=t,reconnect:()=>{},connected:()=>{},api:async(path)=>path==='/lorem/vms'?{vms:[],queued:true}:path==='/lorem/cancel'?{}:{status:'queued',position:1,reason:'capacity'}});`));
app.use(express.static(root));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base='http://127.0.0.1:'+server.address().port;
const tracks=Array.from({length:12},(_,i)=>({id:String(i+1),title:'Track '+(i+1),artist:'Artist '+(i+1),album:'Album '+(i+1),cover:'',duration:210}));
const albums=tracks.slice(0,8).map(t=>({id:t.id,key:t.album,artist:t.artist,cover:''}));
const browser=await chromium.launch({channel:'msedge'});
await mkdir('.codex-artifacts/design',{recursive:true});
try{
 for(const width of [1440,768,390,320]){
  const page=await browser.newPage({viewport:{width,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',r=>{
   const p=new URL(r.request().url()).pathname;
   return r.fulfill({json:p.endsWith('/home')?{tracks,albums,artists:[]}:p.endsWith('/search')?{data:tracks}:p.includes('/album/')?{title:'Album 1',name:'Album 1',artist:'Artist 1',cover:'',tracks}: {enabled:false}});
  });
  await page.goto(base+'/apps/nyxify/');await page.locator('.home-track-list .row').first().waitFor();
  await page.screenshot({path:'.codex-artifacts/design/music-'+width+'.png'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Music horizontal overflow at '+width);
  await page.locator('.home-track-list .row .like-btn').first().click();
  await page.locator('.sidebar [data-filter=liked]').click();assert.equal(await page.locator('#trackList .row').count(),1);
  await page.locator('#trackList .like-btn').click();assert.equal(await page.locator('#trackList .row:visible').count(),0);
  await page.locator('[data-filter=queue]').click();assert.match((await page.locator('#emptyTitle').innerText()).normalize('NFKC'),/queue is empty/i);
  await page.locator('#navNewPlaylist').click();await page.locator('#playlistName').fill('Night listening');await page.locator('#playlistCreateForm button').click();assert.equal(await page.locator('.sidebar-playlist').count(),1);
  await page.locator('#searchInput').fill('music');await page.locator('#searchInput').press('Enter');await page.locator('#detailView .row').first().waitFor();
  await page.locator('.sidebar [data-filter=home]').click();await page.locator('.album-shelf .card').first().click();await page.locator('.group-head').waitFor();
  await page.evaluate(()=>{localStorage.setItem('nyx.appearance','light');window.dispatchEvent(new StorageEvent('storage',{key:'nyx.appearance'}));});
  assert.equal(await page.locator('html').getAttribute('data-n7x-appearance'),'light');
  const lightMusic=await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor);
  assert.notEqual(lightMusic,'rgb(0, 0, 0)');
  await page.evaluate(()=>{localStorage.setItem('nyx.appearance','dark');window.dispatchEvent(new StorageEvent('storage',{key:'nyx.appearance'}));});
  await page.goto(base+'/apps/nyxcloud/');await page.locator('.boot-cancel').waitFor();
  await page.screenshot({path:'.codex-artifacts/design/desktop-'+width+'.png'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'VM horizontal overflow at '+width);
  const button=await page.locator('.boot-cancel').boundingBox();assert(button.width>0&&button.x>=0&&button.x+button.width<=width);
  await page.locator('.boot-cancel').click();assert.match((await page.locator('.boot-card h1').innerText()).normalize('NFKC'),/left the queue/);
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.boot-scan').evaluate(e=>getComputedStyle(e,'::after').animationName),'none');
  assert.deepEqual(errors,[]);await page.close();console.log('PASS browse/likes/queue/playlist/search/album and VM queue layout at '+width+'px');
 }
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
