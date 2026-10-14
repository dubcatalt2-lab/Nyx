import assert from 'node:assert/strict';import express from 'express';import {chromium} from 'playwright';
const server=express().use(express.static('dist')).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge'});
try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>r.fulfill({json:{enabled:false,models:[],apps:[],preferences:{}}}));
 await page.goto(base+'/index.html');await page.locator('#setupScreen.show').waitFor();await page.waitForFunction(()=>document.__nyxSetupEnterBind===true);await page.waitForFunction(()=>!document.body.classList.contains('n7x-loading-active')&&document.getElementById('setupLaunchScreen')?.getAttribute('aria-hidden')==='true');
 assert(await page.locator('#setupScreen').evaluate(el=>/[\u{1d5a0}-\u{1d5d3}]/u.test(el.textContent)),'Wizard labels must be Unicode');
 await page.locator('[data-skip-setup]:visible').click();await page.locator('.n7x-tos-gate').waitFor();
 assert(await page.locator('.n7x-tos-gate').evaluate(el=>/[\u{1d5a0}-\u{1d5d3}]/u.test(el.textContent)),'Terms labels must be Unicode');
 assert.equal(await page.locator('.n7x-release-notes-overlay').count(),0,'Update dialog must wait for consent');
 await page.locator('[data-n7x-tos-agree]').click();await page.waitForFunction(()=>localStorage.getItem('nyx.tosAcceptedVersion')==='2026-07-30');
 assert.equal(await page.locator('#setupBrowserMode option[value="ultraviolet"]').count(),0);
 await page.goto(base+'/about-nyx.html');assert(!/StudyHub|\bNyx\b/i.test(await page.locator('body').innerText()));
 await page.goto(base+'/apps/nyxcloud/');
 await page.waitForFunction(()=>document.querySelector('.brand-caption')?.textContent.normalize('NFKC')==='Desktop workspace' && document.querySelector('.brand-caption')?.textContent!=='Desktop workspace');
 assert.equal((await page.title()).normalize('NFKC'),'VMs');assert.notEqual(await page.title(),'VMs','BOM-prefixed desktop page must receive Unicode script');
 assert.deepEqual(errors,[]);console.log('PASS built startup wizard and terms render Unicode; skip, consent persistence, retired selector removal and About branding work without page exceptions.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
