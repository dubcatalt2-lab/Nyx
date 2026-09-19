import {chromium} from 'playwright';
import express from 'express';
import assert from 'node:assert/strict';
const app=express();
app.get('/api/auth-config',(q,r)=>r.json({enabled:false}));
app.get('/healthz',(q,r)=>r.json({ok:true}));
app.use('/api',(q,r)=>r.json({}));
app.use(express.static('.'));
const server=app.listen(8310);
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  if(window!==window.top)return;
  for(const [key,value] of Object.entries({'nyx.browserShellMode':'false','nyx.setupComplete':'true','nyx.tosAcceptedVersion':'2026-07-30','nyx.releaseNotes.2026-08-31-new-nyx.device':'2026-08-31-new-nyx'})) localStorage.setItem(key,value);
 });
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://localhost:8310'?r.continue():r.abort());
 await page.goto('http://localhost:8310');
 await page.waitForSelector('[data-nyx-dock-item="settings"]');
 // External services are blocked in this local UI test; release the loading input lock.
 await page.evaluate(()=>{document.body.classList.remove('nyx-loading-active');document.querySelectorAll('[inert]').forEach(e=>e.removeAttribute('inert'));document.querySelector('#nyxStudyHubStartup')?.remove()});
 assert(await page.evaluate(()=>document.body.classList.contains('browser-shell')));
 assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.browserShellMode')),null);
 assert.equal(await page.locator('.desktop-shortcuts,.desktop-search,.desktop-app,.dock').count(),0);
 await page.locator('[data-nyx-dock-item="settings"]').click();
 await page.locator('.browser-shell-settings-overlay').waitFor();
 assert.equal(await page.locator('[data-browser-shell-toggle],[data-switch="nyx.browserShellMode"]').count(),0);
 assert(!(await page.locator('.browser-shell-settings-overlay').innerText()).includes('Windows'));
 await page.locator('[data-settings-category-button="credits"]').click();
 await page.locator('[data-settings-category="credits"]').waitFor({state:'visible'});
 await page.locator('[data-settings-category-button="proxy"]').click();
 await page.locator('[data-browser-wisp-url]').waitFor({state:'visible'});
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await page.setViewportSize({width:1280,height:900});
 await page.keyboard.press('Escape');
 await page.locator('.browser-shell-settings-overlay').waitFor({state:'hidden'});
 await page.locator('[data-nyx-dock-item="partners"]').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(f=>{try{return f.contentDocument?.querySelectorAll('[data-nyx-partner-invite]').length===11}catch{return false}}));
 assert(await page.evaluate(()=>document.body.classList.contains('browser-shell')));
 assert.deepEqual(errors,[]);
 console.log('PASS: saved Windows mode migrates; desktop controls absent; Settings/Credits/Proxy, Partners navigation, responsive layout and no page errors.');
}finally{await browser.close();server.close()}
