import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    if(window!==top)return;
    localStorage.setItem('nyx.theme','ruby');
    localStorage.setItem('nyx.codeStudio.v1',JSON.stringify({language:'html',codes:{html:'<!doctype html><h1>Hello, Nyx</h1>',javascript:'console.log("Runtime verified")',python:'print("ok")',java:'class Main {}'}}));
  });
  await page.route('**/api/founder-profile/auth-config',r=>r.fulfill({json:{}}));
  await page.route('**/api/nyx-ai/providers',r=>r.fulfill({json:{providers:[]}}));
  await page.route('**/api/code-studio/run',r=>r.fulfill({json:{ok:true,status:'Accepted',stdout:r.request().postDataJSON().language+' ran',diagnostics:''}}));
  await page.goto((process.env.NYX_TEST_BASE_URL||'http://localhost:8080')+'/apps/code-studio/');
  for(const theme of ['ruby','emerald','sakura','custom']) {
    await page.evaluate(theme=>{localStorage.setItem('nyx.theme',theme);dispatchEvent(new StorageEvent('storage',{key:'nyx.theme'}));},theme);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--studio-accent').trim()),'#cba6f7');
    assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.theme')),theme);
  }
  await page.locator('[data-run]').click();
  await page.frameLocator('[data-preview]').getByText('Hello, Nyx').waitFor();
  assert.equal(await page.locator('[data-preview]').getAttribute('sandbox'),'allow-scripts');
  await page.locator('[data-refresh-preview]').click();
  await page.frameLocator('[data-preview]').getByText('Hello, Nyx').waitFor();
  const download=page.waitForEvent('download');await page.locator('[data-download-code]').click();assert.equal((await download).suggestedFilename(),'index.html');
  await page.getByRole('combobox',{name:'Workspace files'}).selectOption('javascript');
  await page.locator('[data-run]').click();await page.locator('[data-result-mode="terminal"]').click();await page.getByText('log: Runtime verified').waitFor();
  for(const language of ['python','java']) {
    await page.getByRole('combobox',{name:'Workspace files'}).selectOption(language);
    await page.locator('[data-run]').click();await page.getByText(language+' ran',{exact:true}).waitFor();
  }
  for(const panel of ['assistant','preview']){await page.locator(`[data-toggle-panel="${panel}"]`).click();await page.locator(`[data-toggle-panel="${panel}"]`).click();}
  await page.locator('[data-resize-panel="assistant"]').focus();await page.keyboard.press('ArrowRight');
  await page.locator('[data-clear-code]').click();assert.equal(await page.locator('[data-code-input]').inputValue(),'');
  await page.locator('[data-load-starter]').click();assert((await page.locator('[data-code-input]').inputValue()).length>0);
  for(const width of [1440,1024,768,390]) {
    await page.setViewportSize({width,height:900});
    if(width<=940){await page.locator('[data-mobile-view="ai"]').click();assert(await page.locator('[data-ai-prompt-input]').isVisible());await page.getByRole('button',{name:'Close Nyx AI'}).click();}
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const bounds=await page.locator('.project-controls select,.toolbar-actions button').evaluateAll(elements=>elements.filter(el=>el.getClientRects().length).every(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;}));
    assert(bounds,`File controls overflow at ${width}`);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS isolated HTML/JS preview, run service fixtures, download, clear/restore, panels, Catppuccin isolation and responsive controls');
} finally {await browser.close();}
