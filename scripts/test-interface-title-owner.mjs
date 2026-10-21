import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const source=await readFile(`${process.env.NYX_TEST_ASSET_ROOT || '.'}/js/interface-text.js`,'utf8');
for(const channel of ['chrome','msedge']){
 const browser=await chromium.launch({channel});
 try{const page=await browser.newPage();page.on('pageerror',e=>console.log(e.message));
 await page.addInitScript(()=>{
  const Native=MutationObserver,observers=[];let count=0;window.__trips=0;window.__beats=0;
  setInterval(()=>{count=0;window.__beats++},25);
  window.MutationObserver=class extends Native{constructor(cb){super((records,o)=>{if(++count>100){window.__trips++;observers.forEach(x=>x.disconnect());return;}cb(records,o)});observers.push(this)}};
 });
 await page.route('http://fixture.test/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><title>Classes</title><body><h1>Games AI Music</h1><script>
 const enforce=()=>{if(document.title!=='Classes')document.title='Classes'};
 new MutationObserver(enforce).observe(document.head,{subtree:true,childList:true,characterData:true});
 </script><script>${source}</script></body>`}));
 await page.goto('http://fixture.test/');await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>window.__trips),0,'Title ownership must settle without an endless observer loop');
 assert.equal(await page.title(),'Classes','Preserve an explicitly managed tab title');
 assert(await page.evaluate(()=>window.__beats)>4,'Startup timers must remain responsive');
 assert.equal((await page.locator('h1').textContent()).normalize('NFKC'),'Games A1 Music');
 assert.notEqual(await page.locator('h1').textContent(),'Games AI Music');
 console.log(`PASS ${channel}: title owner preserved, Unicode content styled, main thread responsive`);
 }finally{await browser.close()}
}

