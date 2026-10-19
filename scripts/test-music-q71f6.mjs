import assert from 'node:assert/strict';
import express from 'express';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {q64c1,q51fa} from '../lib/q51fa.mjs';
assert.deepEqual(q64c1('[00:02.5][00:09.125]Second\n[ar:fixture]\n[00:01]First').map(x=>x.at),[1,2.5,9.125]);
const mock=async()=>new Response(JSON.stringify({syncedLyrics:'[00:01]Fixture line',plainLyrics:'Fixture line'}),{headers:{'content-type':'application/json'}});
assert.equal((await q51fa({title:'Fixture '+Date.now(),artist:'Test'},mock)).lines.length,1);
await assert.rejects(q51fa({title:'',artist:'Test'},mock),/required/);
const app=express();app.use(express.static(resolve(process.env.NYX_TEST_ASSET_ROOT||'.')));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const wav=Buffer.alloc(44+30*8000*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
const tracks=[1,2,3,4,5].map(id=>({id:String(id),title:'Fixture '+id,artist:'Test',album:'Test',duration:30,catalog:'deezer',cover:''}));
const browser=await chromium.launch({channel:'chrome'});
try{
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',route=>{
   const u=new URL(route.request().url()),p=u.pathname;
   if(p.endsWith('/home'))return route.fulfill({json:{tracks,artists:[],albums:[]}});
   if(p.endsWith('/lyrics')){const id=Number(u.searchParams.get('title').split(' ').at(-1));return route.fulfill({status:id===5?502:200,json:id===1?{lines:[{at:0,text:'First fixture line'},{at:5,text:'Second fixture line'},{at:10,text:'<img src=x onerror=alert(1)>'},...Array.from({length:18},(_,i)=>({at:11+i,text:'Later line '+i}))]}:id===2?{lines:[],plain:'Untimed fixture'}:id===3?{lines:[],instrumental:true}:id===4?{lines:[],plain:''}:{error:'Unavailable'}});}
   if(p.includes('/playback/'))return route.fulfill({json:{mode:'meting',streamUrl:'/api/nyxify/audio/1',durationSeconds:30}});
   if(p.includes('/audio/')){const m=route.request().headers().range?.match(/bytes=(\d+)-(\d*)/);const start=Number(m?.[1]||0),end=Math.min(Number(m?.[2]||wav.length-1),wav.length-1);return route.fulfill({status:m?206:200,contentType:'audio/wav',body:wav.subarray(start,end+1),headers:{'Accept-Ranges':'bytes',...(m?{'Content-Range':`bytes ${start}-${end}/${wav.length}`}:{})}});}
   return route.fulfill({json:{enabled:false}});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/apps/nyxify/');
  for(const background of ['/assets/backgrounds/leaves.jpg','/assets/backgrounds/moonlight.jpg']){await page.evaluate(value=>{localStorage.setItem('nyx.customBgUrl',value);dispatchEvent(new StorageEvent('storage',{key:'nyx.customBgUrl',newValue:value}));},background);await page.waitForFunction(value=>getComputedStyle(document.querySelector('.q48e2')).backgroundImage.includes(value),background);}
  const choose=async id=>page.locator('.row').nth(id-1).dblclick({timeout:10000}).catch(async e=>{console.log(JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(0,1500)}));throw e});
  await choose(1);await page.locator('#q38d4 button').nth(2).waitFor();
  await page.waitForFunction(()=>document.querySelector('audio').currentTime>0);
  if(width>1100){const rail=await page.locator('#musicLibrary').boundingBox(),main=await page.locator('#musicMain').boundingBox();assert(rail.x>=main.x+main.width);assert(rail.y<150);assert(rail.x+rail.width<=width);assert(await page.locator('#nowPlayingTitle').isVisible());const panel=await page.locator('#q71f6').boundingBox();assert(panel.y<850);}
  await page.locator('#q76a2').click();
  assert(await page.locator('#q82f1').evaluate(d=>d.open));
  const box=await page.locator('#q82f1').boundingBox();assert(box.x>=0&&box.y>=0&&box.width<=width);
  await page.locator('audio').evaluate(a=>{a.pause();a.currentTime=6});
  await page.waitForFunction(()=>document.querySelector('#q38d4 button[aria-current=true]')?.textContent.normalize('NFKC')==='Second fixture line');
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#q38d4 [aria-current=true]')).backgroundColor!=='rgba(0, 0, 0, 0)');
  const contrast=await page.locator('#q38d4').evaluate(el=>{const active=el.querySelector('[aria-current=true]'),other=el.querySelector('button:not([aria-current])');return {active:getComputedStyle(active).color,other:getComputedStyle(other).color,background:getComputedStyle(active).backgroundColor}});assert.notEqual(contrast.active,contrast.other);assert.notEqual(contrast.background,'rgba(0, 0, 0, 0)');
  await page.locator('#q38d4').dispatchEvent('pointerdown');
  await page.locator('audio').evaluate(a=>{a.currentTime=23});
  await page.waitForFunction(()=>document.querySelector('#q38d4 [aria-current=true]')?.textContent==='Later line 12');
  await page.waitForFunction(()=>{const box=document.querySelector('#q38d4'),row=box.querySelector('[aria-current=true]');const a=box.getBoundingClientRect(),b=row.getBoundingClientRect();return box.scrollTop>0&&Math.abs(b.top+b.height/2-a.top-a.height/2)<4});
  await page.locator('#q38d4 button').first().click();assert((await page.locator('audio').evaluate(a=>a.currentTime))<1);
  assert.equal(await page.locator('#q38d4 img').count(),0);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#q82f1').evaluate(d=>d.open),false);
  assert(await page.locator('#q76a2').evaluate(b=>b===document.activeElement));
  for(const [id,expected] of [[2,'timing unavailable'],[3,'Instrumental'],[4,'No lyrics'],[5,'temporarily unavailable']]){await choose(id);await page.waitForFunction(s=>document.querySelector('#q29c3').textContent.normalize('NFKC').includes(s),expected);assert.equal(await page.locator('#q38d4 button').count(),0);}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS timed highlighting, line seeking, safe text, track resets, plain/instrumental/missing/error states and mobile layout');
}finally{await browser.close();await new Promise(r=>server.close(r));}
