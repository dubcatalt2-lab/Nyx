import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync('script.js','utf8');const start=source.indexOf('  function toast(msg,kind){');const end=source.indexOf('\n  }',start)+4;
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.goto('http://localhost:8080/');
 await page.evaluate(code=>{window.testToast=new Function('$',code+';return toast')(id=>document.getElementById(id));},source.slice(start,end));
 await page.clock.install();
 await page.evaluate(()=>testToast('Notification permission denied'));
 assert.equal(await page.locator('#toast svg').count(),1);
 await page.screenshot({path:'.codex-artifacts/toast-desktop.png'});
 await page.clock.runFor(1500);
 await page.evaluate(()=>testToast('Alex mentioned you: <img src=x onerror=alert(1)>','mention'));
 await page.clock.runFor(600);
 assert(await page.locator('#toast').evaluate(e=>e.classList.contains('show')),'Old timer must not dismiss new toast');
 assert.equal(await page.locator('#toast img').count(),0);
 await page.setViewportSize({width:390,height:844});
 assert(await page.locator('#toast').evaluate(e=>e.getBoundingClientRect().right<=innerWidth&&e.getBoundingClientRect().left>=0));
 await page.screenshot({path:'.codex-artifacts/toast-mention-mobile.png'});
 await page.clock.runFor(1400);
 assert.equal(await page.locator('#toast').evaluate(e=>e.classList.contains('show')),false);
 console.log('PASS toast icon, safe mention text, replacement timer, two-second dismissal and mobile bounds');
} finally {await browser.close()}
