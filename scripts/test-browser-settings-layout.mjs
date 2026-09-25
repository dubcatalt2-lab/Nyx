import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.NYX_TEST_BASE_URL||'http://127.0.0.1:8199',browser=await chromium.launch();
try{
 for(const width of [1365,390]){
  const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(20000);
  page.on('pageerror',e=>console.log('Settings page error:',e.message));
  await page.addInitScript(()=>{localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');localStorage.setItem('nyx.releaseNotes.2026-09-14-nyx-1.0.3.seen','2026-09-14-nyx-1.0.3');});
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-browser-shell-settings]').first().waitFor({state:'attached'});
  await page.waitForFunction(()=>typeof document.querySelector('[data-nyx-dock-item="movies"]')?.onclick==='function');
  await page.waitForFunction(()=>!document.querySelector('#nyxStudyHubStartup')&&!document.body.classList.contains('nyx-loading-active'));
  await page.locator('[data-nyx-dock-item="settings"]').click();
  await page.screenshot({path:`.codex-artifacts/settings-open-${width}.png`});
  await page.locator('[data-settings-category-button="browser"]').click();
  const category=page.locator('[data-settings-category="browser"]');
  await category.getByText('Tab appearance',{exact:true}).waitFor();
  assert.equal(await category.locator('.nyx-browser-settings-card').count(),3);
  await category.getByLabel('Tab title',{exact:true}).fill('Study notes');
  await category.locator('[data-tab-cloak-apply]').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.tabTitle')),'Study notes');
  const field=category.locator('[data-cloak-redirect-url]');await field.fill('https://example.com/');
  await category.locator('[data-save-cloak]').click();assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.cloakRedirectUrl')),'https://example.com/');
  const bounds=await category.evaluate(el=>[...el.querySelectorAll('input:not([type=hidden]),select,button')].filter(el=>el.getClientRects().length).every(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;}));
  assert.ok(await category.evaluate(el=>{const dock=document.querySelector('.nyx-visual-dock').getBoundingClientRect();return [...el.querySelectorAll('input:not([type=hidden]),select,button')].filter(e=>e.getClientRects().length).every(e=>e.getBoundingClientRect().right<=dock.left+1);}),`Controls must not sit beneath the sidebar at ${width}`);
  assert.ok(bounds,`Browser settings overflow at ${width}`);
  await page.screenshot({path:`.codex-artifacts/browser-settings-${width}.png`,fullPage:true});await page.close();
 }
 console.log('PASS Browser settings: desktop/mobile layout, labelled fields, tab title and launch settings persistence');
}finally{await browser.close();}
