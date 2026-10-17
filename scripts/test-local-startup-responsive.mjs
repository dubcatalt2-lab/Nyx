import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.NYX_TEST_BASE || 'http://localhost:8080';
for(const channel of ['chrome','msedge']){
 const browser=await chromium.launch({channel});
 try{const page=await browser.newPage();page.setDefaultTimeout(20000);
 await page.addInitScript(()=>{
  localStorage.setItem('nyx.setupComplete','true');
  localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');
  localStorage.setItem('nyx.tabTitle','N7X');
  const Native=MutationObserver,observers=[];let count=0;
  window.__loopTrips=0;window.__timerBeats=0;
  setInterval(()=>{count=0;window.__timerBeats++},25);
  window.MutationObserver=class extends Native {constructor(cb){super((records,o)=>{
   if(++count>500){window.__loopTrips++;observers.forEach(x=>x.disconnect());return;}
   cb(records,o);
  });observers.push(this)}};
 });
                                                                                      
 await page.route('**/api/**',r=>r.fulfill({json:{enabled:false,models:[],apps:[],preferences:{}}}));
 for(let visit=0;visit<2;visit++){
  if(visit)await page.reload();else await page.goto(base+'/');
  await page.locator('#n3e8549522c8c').waitFor({state:'attached'});
  await page.evaluate(()=>{
   window.__maxProgress=Number(document.querySelector('.n7x-loading-progress')?.getAttribute('aria-valuenow'))||0;
   addEventListener('nyx:loading-progress',event=>{window.__maxProgress=Math.max(window.__maxProgress,event.detail.value)});
   const enforce=()=>{if(document.title!=='Classes')document.title='Classes'};
   enforce();new MutationObserver(enforce).observe(document.head,{subtree:true,childList:true,characterData:true});
  });
  await page.waitForFunction(()=>document.getElementById('n3e8549522c8c')?.getAttribute('aria-hidden')==='true'&&!document.body.classList.contains('n7x-loading-active'));
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>__loopTrips),0,'No runaway mutation microtasks');
  assert(await page.evaluate(()=>__timerBeats)>8);
  assert.equal(await page.title(),'Classes');
  assert.equal(await page.evaluate(()=>__maxProgress),100);
  console.log(`PASS ${channel} ${visit?'reload':'startup'}: 100%, loading unlocked, tab title preserved, timers responsive`);
 }
 }finally{await browser.close()}
}
