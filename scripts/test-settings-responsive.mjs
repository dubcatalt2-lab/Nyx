import assert from 'node:assert/strict';
import {chromium} from 'playwright';
for(const channel of ['chrome','msedge']){
 const browser=await chromium.launch({channel});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  await page.addInitScript(()=>{
   if(window!==window.top)return;
   localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');
   localStorage.setItem('nyx.releaseNotes.2026-10-02-nyx-1.6.8.seen','2026-10-02-nyx-1.6.8');
   const Native=MutationObserver,observers=[];let count=0;window.__trips=0;window.__beats=0;
   setInterval(()=>{count=0;window.__beats++},25);
   window.MutationObserver=class extends Native{constructor(cb){super((records,o)=>{if(++count>500){window.__trips++;observers.forEach(x=>x.disconnect());return;}cb(records,o)});observers.push(this)}};
  });
  await page.route('**/api/**',r=>r.fulfill({json:{enabled:false,models:[],apps:[],preferences:{}}}));
  await page.goto('http://localhost:8080/');
  await page.waitForFunction(()=>document.querySelector('.browser-home.n7x-minimal-home')&&document.getElementById('n3e8549522c8c')?.getAttribute('aria-hidden')==='true'&&!document.body.classList.contains('n7x-loading-active'));
  await page.waitForTimeout(1300);
  const close=page.locator('[data-n7x-release-notes-close]').first();if(await close.isVisible())await close.click();
  const responsive=async()=>{const before=await page.evaluate(()=>__beats);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>__trips),0,'No runaway observer callbacks');assert((await page.evaluate(()=>__beats))>before,'Timers advance after clicks');};
  await page.locator('[data-n7x-dock-item="settings"]').click();await responsive();
  try { await page.locator('[data-settings-category-button]').first().waitFor(); }
  catch(error){console.log(await page.evaluate(()=>({body:document.body.className,overlay:document.querySelector('.browser-shell-settings-overlay')?.outerHTML.slice(0,1000),trips:window.__trips})),errors);await page.screenshot({path:'.codex-artifacts/settings-test-failure.png'});throw error;}
  const categories=await page.locator('[data-settings-category-button]').evaluateAll(nodes=>nodes.map(n=>n.dataset.settingsCategoryButton));
  assert(categories.length>=6);
  for(const category of categories){await page.locator(`[data-settings-category-button="${category}"]`).click();await responsive();assert(await page.locator(`[data-settings-category-button="${category}"]`).evaluate(el=>el.classList.contains('active')));}
  await page.getByRole('searchbox',{name:'Filter settings'}).fill('performance');await responsive();
  assert(await page.locator('[data-n7x-performance-tier="low"]').isVisible());
  await page.getByRole('searchbox',{name:'Filter settings'}).fill('install');await responsive();
  assert(await page.locator('[data-n7x-install-card]').isVisible(),'Dynamically added install card is searchable');
  await page.getByRole('searchbox',{name:'Filter settings'}).fill('');
  await page.locator('[data-settings-category-button="appearance"]').click();
  for(const tier of ['low','medium']){await page.locator(`[data-n7x-performance-tier="${tier}"]`).click();await responsive();}
  await page.locator('[data-n7x-dock-item="home"]').click();await responsive();
  await page.locator('[data-n7x-dock-item="settings"]').click();await responsive();
  await page.locator('[data-settings-category-button="advanced"]').click();await responsive();
  assert.equal(await page.locator('[data-n7x-install-card]').count(),1,'No duplicate install cards after reopen');
  assert.deepEqual(errors,[], 'Settings interactions must not throw');
  console.log(`PASS ${channel}: Settings open/reopen, ${categories.length} categories, filter, performance buttons, Home; timers responsive`);
 }finally{await browser.close()}
}
