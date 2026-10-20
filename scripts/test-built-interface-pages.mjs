import assert from 'node:assert/strict';import express from 'express';import {chromium} from 'playwright';
const server=express().use(express.static('dist')).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge'});
try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>r.fulfill({json:{enabled:false,models:[],apps:[],preferences:{}}}));
 await page.goto(base+'/index.html');await page.locator('#n79425056e076.show').waitFor();await page.waitForFunction(()=>document.__nyxSetupEnterBind===true);await page.waitForFunction(()=>!document.body.classList.contains('n7x-loading-active')&&document.getElementById('n3e8549522c8c')?.getAttribute('aria-hidden')==='true');
 assert(await page.locator('#n79425056e076').evaluate(el=>/[\u{1d5a0}-\u{1d5d3}]/u.test(el.textContent)),'Wizard labels must be Unicode');
 await page.locator('[data-q61f324a3819a606a84]:visible').click();await page.locator('.n7x-tos-gate').waitFor();
 assert(await page.locator('.n7x-tos-gate').evaluate(el=>/[\u{1d5a0}-\u{1d5d3}]/u.test(el.textContent)),'Terms labels must be Unicode');
 assert.equal(await page.locator('.n7x-release-notes-overlay').count(),0,'Update dialog must wait for consent');
 await page.locator('[data-n7x-tos-agree]').click();await page.waitForFunction(()=>localStorage.getItem('nyx.tosAcceptedVersion')==='2026-07-30');
 assert.equal(await page.locator('#setupBrowserMode option[value="ultraviolet"]').count(),0);
 await page.goto(base+'/about-nyx.html');assert(!/StudyHub|\bNyx\b/i.test(await page.locator('body').innerText()));
 assert.equal((await page.request.get(base+'/apps/nyxcloud/')).status(),404);
 assert.deepEqual(errors,[]);console.log('PASS built startup wizard and terms render Unicode; skip, consent persistence, retired selector removal and About branding work without page exceptions.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
