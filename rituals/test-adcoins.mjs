import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
import {advanceAdcoins,adcoinsPeriod,adcoinsBreak} from '../parables/adcoins.js';

let state={};
for(let now=1000;now<=adcoinsPeriod;now+=1000){
 state=advanceAdcoins(state,now-1000,now,true);
 state=advanceAdcoins(state,now-1000,now,true);
 if(now<adcoinsPeriod)assert.equal(state.freeUntil,0);
}
assert.equal(state.freeUntil,adcoinsPeriod+adcoinsBreak);
assert.equal(state.progress,0);
assert.deepEqual(advanceAdcoins(state,600000,601000,true),state);
state=advanceAdcoins(state,780000,781000,true);
assert.equal(state.progress,1000);
assert.equal(state.freeUntil,0);
assert.equal(advanceAdcoins(state,781000,900000,true).progress,1000,'sleep must not earn time');
assert.equal(advanceAdcoins(state,781000,782000,false).progress,1000,'hidden tabs must not earn time');
assert.equal(advanceAdcoins({progress:Infinity},0,1000,true).progress,1000);

const app=express();
app.get('/',(_,res)=>res.send('<body class="browser-shell"><div class="browser-window browser-blank"><main class="browser-home nyx-minimal-home" style="height:400px"></main></div><iframe class="view" src="/frame"></iframe><script type="module">import {startAdcoins} from "/parables/adcoins.js";import {publisherMode} from "/parables/publisher-config.js";window.mode=publisherMode;startAdcoins();window.ready=true;</script>'));
app.get('/frame',(_,res)=>res.send('<script type="module">import {publisherMode} from "/parables/publisher-config.js";window.mode=publisherMode;</script>'));
app.use('/parables',express.static('parables'));
const server=app.listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext();
 await context.addInitScript(()=>{
  window.now=1000000;Date.now=()=>window.now;
  window.__nyxPublisherMode='standard';
  window.testHidden=false;Object.defineProperty(document,'hidden',{get:()=>window.testHidden});
 });
 const url=`http://127.0.0.1:${server.address().port}`;
 const first=await context.newPage();await first.goto(url);await first.waitForFunction(()=>window.ready);
 const second=await context.newPage();await second.goto(url);await second.waitForFunction(()=>window.ready);
 await first.evaluate(async()=>{
  localStorage.setItem('nyx.adcoins.v1',JSON.stringify({progress:599000,lastEnd:1000000,freeUntil:0}));
  window.now+=1000;dispatchEvent(new Event('nyx:publisher-change'));
  await navigator.locks.request('nyx.adcoins.v1',()=>{});
 });
 await first.waitForFunction(()=>window.mode()==='off');
 await second.waitForFunction(()=>window.mode()==='off');
 assert.match(await first.locator('.nyx-adcoins').textContent(),/Ad-free for 3:00/);
 await first.frames()[1].waitForFunction(()=>window.mode?.()==='off');
 await first.reload();await first.waitForFunction(()=>window.ready&&window.mode()==='off');
 assert.equal(await first.evaluate(()=>JSON.parse(localStorage.getItem('nyx.adcoins.v1')).progress),0);
 await first.evaluate(async()=>{
  window.now=1182000;window.testHidden=true;document.dispatchEvent(new Event('visibilitychange'));
  await navigator.locks.request('nyx.adcoins.v1',()=>{});
 });
 await first.waitForFunction(()=>window.__nyxAdcoinsFreeUntil===0&&window.mode()==='off');
 await second.waitForFunction(()=>window.mode()==='standard');
 assert.equal(await first.evaluate(()=>JSON.parse(localStorage.getItem('nyx.adcoins.v1')).progress),0);
 await first.evaluate(()=>{window.__NYX_RUNTIME_CONFIG__={publisherAdsEnabled:false};dispatchEvent(new Event('nyx:publisher-change'));});
 await first.waitForFunction(()=>document.querySelector('.nyx-adcoins').hidden);
 await second.evaluate(()=>document.querySelector('.browser-window').classList.remove('browser-blank'));
 assert.equal(await second.evaluate(()=>window.mode()),'off','regular ads stop on app/search tabs');
 await second.evaluate(()=>{window.__nyxPublisherMode='adkid';});
 assert.equal(await second.evaluate(()=>window.mode()),'adkid','Adkid remains enabled outside home');
 assert.equal(await second.frames()[1].evaluate(()=>window.mode()),'adkid','Adkid applies to app frames');
 await first.setViewportSize({width:390,height:844});
 await first.evaluate(()=>{window.__NYX_RUNTIME_CONFIG__.publisherAdsEnabled=true;window.__nyxPublisherMode='adkid';dispatchEvent(new Event('nyx:publisher-change'));});
 await first.waitForFunction(()=>!document.querySelector('.nyx-adcoins').hidden);
 assert.ok(await first.locator('.nyx-adcoins').evaluate(el=>el.getBoundingClientRect().width<390));
 await first.evaluate(()=>{window.__nyxPublisherMode='off';dispatchEvent(new Event('nyx:publisher-change'));});
 await first.waitForFunction(()=>document.querySelector('.nyx-adcoins').hidden);
 console.log('PASS Adcoins: ten-minute union, three-minute break, hidden/suspended tabs, shared tabs and app frames, reload, expiry, disabled/premium modes, mobile.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
