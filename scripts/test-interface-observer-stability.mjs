import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const brand=process.env.NYX_TEST_INSTALL_BRAND==='tutsi'?'tutsi':'nyx';
const attributeBrand=brand==='nyx'?'n7x':brand;
const display=brand==='tutsi'?'Tutsi':'N7X';
const root=process.env.NYX_TEST_ASSET_ROOT || '.';
const [presentation,install]=await Promise.all(['js/interface-text.js',brand==='tutsi'?'apps/tutsi/install.js':'js/pwa-install.js'].map(p=>readFile(`${root}/${p}`,'utf8')));
for(const channel of ['chrome','msedge']){
 const browser=await chromium.launch({channel});
 try {
  const page=await browser.newPage();
  await page.addInitScript(()=>{
   const Native=MutationObserver;const observers=[];let callbacks=0;
   window.__observerTrips=0;window.__heartbeat=0;
   setInterval(()=>{callbacks=0;window.__heartbeat++},25);
   window.MutationObserver=class extends Native {
    constructor(callback){super((records,observer)=>{
     if(++callbacks>150){window.__observerTrips++;observers.forEach(o=>o.disconnect());return;}
     callback(records,observer);
    });observers.push(this);}
   };
  });
  await page.route('http://fixture.test/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><body><main></main><script>${presentation}</script><script>${install}</script></body>`}));
  await page.goto('http://fixture.test/');
  await page.evaluate(brand=>{document.querySelector('main').innerHTML=brand==='nyx'?'<div class="settings-panel"><div class="settings-grid"></div></div>':'<button data-install-tutsi>Install Tutsi</button><p data-install-tutsi-status></p>'},brand);
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>window.__observerTrips),0,'Unicode and install controls must not loop in mutation callbacks');
  assert(await page.evaluate(()=>window.__heartbeat)>4,'Main thread timers must keep running');
  await page.evaluate(()=>{const event=new Event('beforeinstallprompt');event.prompt=async()=>({outcome:'accepted'});window.dispatchEvent(event)});
  await page.waitForTimeout(150);
  assert.equal((await page.locator(`[data-install-${attributeBrand}-status]`).textContent()).normalize('NFKC'),'R3ady to install on this d3vice.');
  await page.getByRole('button',{name:'Install '+display,exact:true}).click();
  await page.waitForTimeout(150);
  assert.equal((await page.locator(`[data-install-${attributeBrand}-status]`).textContent()).normalize('NFKC'),`Finishing the ${brand==='nyx'?'N7x':display} installati0n...`);
  assert.equal(await page.evaluate(()=>window.__observerTrips),0);
  console.log(`PASS ${channel}: install controls preserve Unicode, update status, and leave timers responsive`);
 }finally{await browser.close()}
}
