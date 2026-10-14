import assert from 'node:assert/strict';
import {chromium} from 'playwright';
for (const channel of ['chrome','msedge']) {
 const browser=await chromium.launch({channel});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.addInitScript(()=>{if(window!==top)return;localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');localStorage.setItem('nyx.releaseNotes.2026-10-02-nyx-1.6.8.seen','2026-10-02-nyx-1.6.8');});
  await page.route('**/api/**',r=>r.fulfill({json:{enabled:false,models:[],apps:[],preferences:{}}}));
  await page.route('https://bicea.org/**',r=>r.abort());
  await page.goto('http://localhost:8080');
  await page.waitForFunction(()=>document.querySelector('.browser-home.n7x-minimal-home')&&!document.body.classList.contains('n7x-loading-active')&&!document.body.classList.contains('n7x-startup-prep'));
  const cat=page.locator('#n7x-pointer-cat');await cat.waitFor({state:'visible'});
  assert.equal(await cat.count(),1);assert.equal(await cat.evaluate(n=>getComputedStyle(n).pointerEvents),'none');
  const before=await cat.boundingBox();await page.mouse.move(700,400);await page.waitForTimeout(1500);
  const after=await cat.boundingBox();assert(after.x>before.x+50);assert(after.y>before.y);
  assert(await cat.evaluate(n=>n.complete&&n.naturalWidth>0));
  await page.locator('[data-n7x-dock-item="settings"]').click();await page.waitForTimeout(400);
  await page.locator('[data-settings-category-button]').first().waitFor();
  await page.locator('[data-settings-category-button="appearance"]').click();
  const toggle=page.locator('[data-switch="n7x.pointerCat"]');
  assert.equal(await toggle.getAttribute('aria-checked'),'true');
  await toggle.click();assert(await cat.isHidden());assert.equal(await toggle.getAttribute('aria-checked'),'false');
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('.browser-home.n7x-minimal-home')&&!document.body.classList.contains('n7x-loading-active')&&!document.body.classList.contains('n7x-startup-prep'));
  assert(await cat.isHidden());
  await page.locator('[data-n7x-dock-item="settings"]').click();
  await page.locator('[data-settings-category-button="appearance"]').click();
  assert.equal(await toggle.getAttribute('aria-checked'),'false');
  await toggle.click();await cat.waitFor({state:'visible'});
  assert.equal(await toggle.getAttribute('aria-checked'),'true');

  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(200);assert(await cat.isHidden());
  await page.emulateMedia({reducedMotion:'no-preference'});await cat.waitFor({state:'visible'});
  await page.screenshot({path:`.codex-artifacts/oneko-${channel}.png`});
  console.log(`PASS ${channel}: local sprites, pointer following, click-through, persisted Settings toggle, single instance, reduced-motion pause/resume`);
 } finally {await browser.close();}
}
