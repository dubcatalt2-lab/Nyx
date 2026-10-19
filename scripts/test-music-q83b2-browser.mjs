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
 for(const width of [1280,390]) for(const reverse of [false,true]){
  const primary=reverse?"/api/nyxify/audio/2":"/api/nyxify/q83b2/Ab12",secondary=reverse?"/api/nyxify/q83b2/Cd34":"/api/nyxify/audio/1";
  const page=await browser.newPage({viewport:{width,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',route=>{
   const u=new URL(route.request().url()),p=u.pathname;
   if(p.endsWith('/home'))return route.fulfill({json:{tracks,artists:[],albums:[]}});
   if(p.endsWith('/lyrics')){const id=Number(u.searchParams.get('title').split(' ').at(-1));return route.fulfill({status:id===5?502:200,json:id===1?{lines:[{at:0,text:'First fixture line'},{at:5,text:'Second fixture line'},{at:10,text:'<img src=x onerror=alert(1)>'}]}:id===2?{lines:[],plain:'Untimed fixture'}:id===3?{lines:[],instrumental:true}:id===4?{lines:[],plain:''}:{error:'Unavailable'}});}
   if(p.includes('/playback/'))return route.fulfill({json:{mode:'meting',provider:'audius',streamUrl:primary,durationSeconds:30,alternatives:[{mode:'meting',provider:'meting',streamUrl:secondary,durationSeconds:30}]}});
   if(p===primary)return route.fulfill({status:502,body:'Unavailable'});
   if(p===secondary){const m=route.request().headers().range?.match(/bytes=(\d+)-(\d*)/);const start=Number(m?.[1]||0),end=Math.min(Number(m?.[2]||wav.length-1),wav.length-1);return route.fulfill({status:m?206:200,contentType:'audio/wav',body:wav.subarray(start,end+1),headers:{'Accept-Ranges':'bytes',...(m?{'Content-Range':`bytes ${start}-${end}/${wav.length}`}:{})}});}
   return route.fulfill({json:{enabled:false}});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/apps/nyxify/');
  await page.locator('.row').first().dblclick();
  await page.waitForFunction(()=>document.querySelector('audio').currentTime>0);
  assert.equal(await page.locator('audio').getAttribute('src'),secondary);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS audio failure switches in both provider directions and plays on desktop/mobile');
}finally{await browser.close();await new Promise(r=>server.close(r));}
