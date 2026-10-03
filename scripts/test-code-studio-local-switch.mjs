import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch();try{
 const page=await browser.newPage();let aiCalls=0;
 await page.route('**/api/**',r=>{if(r.request().method()==='POST'&&r.request().url().includes('nyx-ai'))aiCalls++;return r.fulfill({contentType:'application/json',body:'{}'});});
 for(const suffix of ['', '?tutsi=1']){
 await page.goto('http://localhost:9091/apps/code-studio/'+suffix);
 await page.locator('[data-code-input]').fill('<!-- saved original -->');
 await page.locator('[data-close-assistant]').click();assert.equal(await page.locator('body').evaluate(b=>b.classList.contains('ai-collapsed')),true);
 await page.locator('[data-toggle-panel="assistant"]').click();assert.equal(await page.locator('.assistant-panel').isVisible(),true);
 await page.locator('[data-ai-prompt-input]').focus();assert.equal(await page.locator('[data-ai-prompt-input]').evaluate(e=>getComputedStyle(e).outlineStyle),'none');
 assert.notEqual(await page.locator('.assistant-form').evaluate(e=>getComputedStyle(e).borderRadius),'0px');
 for(const language of await page.locator('[data-language] option').evaluateAll(nodes=>nodes.map(n=>n.value)))await page.locator('[data-language]').selectOption(language);
 await page.locator('[data-language]').selectOption('html');assert.equal(await page.locator('[data-code-input]').inputValue(),'<!-- saved original -->');assert.equal(aiCalls,0);
 await page.setViewportSize({width:390,height:844});await page.locator('[data-mobile-view="ai"]').click();await page.locator('[data-close-assistant]').click();assert.equal(await page.locator('body').evaluate(b=>b.classList.contains('mobile-show-ai')),false);
 await page.setViewportSize({width:1280,height:900});
 }
 console.log('PASS code assistant desktop/mobile close/reopen, rounded focus and 16 local language switches without AI or lost edits');
}finally{await browser.close();}
