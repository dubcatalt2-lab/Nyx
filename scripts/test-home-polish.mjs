import assert from 'node:assert/strict';
import {chromium} from 'playwright';
for (const channel of ['chrome','msedge']) {
 const browser=await chromium.launch({channel});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],weather=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/open-meteo|weather/i.test(r.url()))weather.push(r.url());});
 await page.addInitScript(()=>{if(window!==window.top)return;localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');localStorage.setItem('nyx.releaseNotes.2026-10-02-nyx-1.6.8.seen','2026-10-02-nyx-1.6.8');});
 await page.route('**/api/**',r=>r.fulfill({json:{enabled:false,models:[],apps:[],preferences:{}}}));
 // Exercise real ad-frame lifecycle without requesting billable test impressions.
 await page.route('https://bicea.org/**',r=>r.fulfill({contentType:'application/javascript',body:`const img=document.createElement('img');img.width=160;img.height=600;img.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="600"><rect width="160" height="600" fill="orange"/></svg>');document.body.append(img);`}));
 await page.goto('http://localhost:8080/');
 await page.waitForFunction(()=>document.querySelector('.q4f959b063679fe3afa.n7x-minimal-home')&&document.getElementById('n3e8549522c8c')?.getAttribute('aria-hidden')==='true'&&!document.body.classList.contains('n7x-loading-active'));
 const close=page.locator('[data-n7x-release-notes-close]').first();if(await close.isVisible())await close.click();
 await page.waitForTimeout(1500);
 assert.equal(await page.locator('#weatherPanel,#weatherRestore,[data-open="weather"]').count(),0);
 assert.deepEqual(weather,[]);
 const letters=page.locator('.n7x-minimal-brand h1 .n7x-wordmark-letter');assert.equal(await letters.count(),3);
 const motions=await letters.evaluateAll(ns=>ns.map(n=>({name:getComputedStyle(n).animationName,delay:getComputedStyle(n).animationDelay})));
 assert.equal(motions[0].delay,'0.24s');assert.equal(motions[1].delay,'0.12s');assert.equal(motions[2].delay,'0s');
 const title=page.locator('.n7x-minimal-brand h1');
 for(let selected=0;selected<3;selected++) {
  await letters.nth(selected).hover();await page.waitForTimeout(300);
  const zoom=await page.locator('.n7x-wordmark-glyph').evaluateAll(ns=>ns.map(n=>getComputedStyle(n).transform));
  for(let i=0;i<3;i++) if(i===selected)assert.match(zoom[i],/1\.18/);else assert.equal(zoom[i],'none');
 }
 await page.mouse.move(10,10);await page.waitForTimeout(300);
 assert.deepEqual(await page.locator('.n7x-wordmark-glyph').evaluateAll(ns=>ns.map(n=>getComputedStyle(n).transform)),['none','none','none']);
 assert.equal(await title.textContent(),'N7X');
 assert.deepEqual(await page.locator('.n7x-wordmark-glyph').evaluateAll(ns=>ns.map(n=>getComputedStyle(n).fontWeight)),['700','700','700'],'Each bubble glyph retains bold weight');
 assert(await page.evaluate(()=>document.fonts.check('700 32px N7xRounded')),'Bundled bubble font loaded');
 const overlay=await page.evaluate(()=>({image:getComputedStyle(document.body,'::after').backgroundImage,filter:getComputedStyle(document.body,'::before').filter}));
 assert.match(overlay.image,/gradient/);assert(!overlay.filter.includes('blur'));
 await page.waitForFunction(()=>document.querySelectorAll('.n7x-home-sponsor[data-ready="true"]').length===2);
 await page.locator('[data-n7x-dock-item="settings"]').click();await page.waitForTimeout(200);
 assert.equal(await page.locator('.n7x-home-sponsor').count(),0,'Home ads removed when settings opens');
 await page.locator('[data-n7x-dock-item="home"]').click();
 await page.context().route('https://asiafilm.org/**',r=>r.fulfill({contentType:'text/html',body:'<p>Local popup fixture</p>'}));
 const home=page.locator('.q4f959b063679fe3afa.n7x-minimal-home:not(.hidden)');
 const opened=[];page.context().on('page',p=>opened.push(p));
 await home.evaluate(n=>n.dispatchEvent(new MouseEvent('click',{bubbles:true})));await page.waitForTimeout(100);assert.equal(opened.length,0,'Synthetic clicks cannot open ads');
 for(let i=0;i<2;i++){await home.click({position:{x:250,y:300}});await page.waitForTimeout(1150);assert.equal(opened.length,i+1);await opened[i].close();await page.bringToFront();}
 await home.click({position:{x:250,y:300}});await page.waitForTimeout(150);assert.equal(opened.length,2,'Popup limit enforced');
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await letters.first().evaluate(n=>getComputedStyle(n).animationName),'none');
 assert.deepEqual(errors,[]);
 console.log(`PASS ${channel}: weather removed, crisp dark overlay, staggered letters, hover zoom, reduced motion, local home ad lifecycle`);
 } finally {await browser.close();}
}
