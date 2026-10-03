import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
const source=readFileSync('js/ai-workspace.js','utf8');
const start=source.indexOf('  const aiBrand='),end=source.indexOf('    const parts=responseParts(text);',start);
const browser=await chromium.launch();
try{
 const page=await browser.newPage();await page.setContent('<article class="ai-message-assistant"><div class="ai-message-content"></div></article>');
 await page.evaluate(code=>{eval(code+'};window.renderTest=setMessageContent;');},source.slice(start,end));
 for(const app of ['', 'ai']){
  await page.evaluate(app=>document.documentElement.dataset.tutsiApp=app,app);
  await page.evaluate(()=>renderTest(document.querySelector('article'),'Nyx AI could not finish this reply. Please try again.',{error:true}));
  assert.equal(await page.locator('.ai-message-content').textContent(),`${app?'Tutsi':'Nyx'} AI could not finish this reply. Please try again.`);
  assert.equal(await page.locator('article').evaluate(el=>el._nyxMessageText),await page.locator('.ai-message-content').textContent());
  await page.evaluate(()=>renderTest(document.querySelector('article'),'',{thinking:true}));
  assert.equal(await page.locator('.ai-thinking').getAttribute('aria-label'),`${app?'Tutsi':'Nyx'} AI is thinking`);
 }
 await page.evaluate(()=>{const el=document.querySelector('article');el.className='ai-message-user';renderTest(el,'What is Nyx AI?');});
 assert.equal(await page.locator('.ai-message-content').textContent(),'What is Nyx AI?');
 console.log('PASS Nyx/Tutsi error and thinking labels, copied error text, and unchanged user content.');
}finally{await browser.close()}
