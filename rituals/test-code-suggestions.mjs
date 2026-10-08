import express from 'express';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const app=express();app.use(express.static('dist'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true});
try{for(const width of [1365,1024,390]){
const page=await browser.newPage({viewport:{width,height:900}});await page.route('**/api/**',r=>r.fulfill({json:{models:[],providers:[]}}));
await page.goto(base+'/apps/code-studio/');const input=page.locator('[data-code-input]');await input.waitFor();
await page.locator('[data-language]').selectOption('javascript');await input.fill('con');await page.locator('#code-suggestions').waitFor({state:'visible'});await input.press('Enter');assert.equal(await input.inputValue(),'const');
await input.fill('console.lo');await input.press('Escape');await input.press('Control+Space');await input.press('Tab');assert.equal(await input.inputValue(),'console.log()');
await page.locator('[data-language]').selectOption('python');await input.fill('pri');await input.press('Enter');assert.equal(await input.inputValue(),'print');
await input.fill('abc');await input.press('Escape');await input.press('Tab');assert.equal(await input.inputValue(),'abc  ');
if(width>940){for(const panel of ['assistant','preview']){const toggle=page.locator(`[data-toggle-panel="${panel}"]`);if(await toggle.getAttribute('aria-pressed')==='false')await toggle.click();}}
assert(await input.isVisible());const box=await input.boundingBox();assert(box.width>200,JSON.stringify({width,box}));assert(box.height>90,JSON.stringify({width,box}));
if(width===390){await page.locator('[data-mobile-view="preview"]').click();assert(await page.locator('[data-result-card]').isVisible());assert(!(await input.isVisible()));await page.locator('[data-mobile-view="ai"]').click();assert(await page.locator('.assistant-panel').isVisible());await page.locator('[data-close-assistant]').click();assert(await input.isVisible());}
await page.locator('[data-language]').selectOption('html');await input.fill('<h1>Preview check</h1>');await page.locator('[data-run]').first().click();await page.frameLocator('[data-preview]').getByRole('heading',{name:'Preview check'}).waitFor();await page.reload();await page.locator('[data-code-input]').waitFor();assert.equal(await page.locator('[data-code-input]').inputValue(),'<h1>Preview check</h1>');
console.log('Sandbox suggestions/layout passed',width,box.width,box.height);await page.close();
}}finally{await browser.close();server.close();}
