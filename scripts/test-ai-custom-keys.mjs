import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{for(const width of [1280,390]){
 const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/founder-profile/auth-config',r=>r.fulfill({json:{}}));
 await page.route('**/api/nyx-ai/providers',r=>r.fulfill({json:{providers:[{id:'shared',label:'OpenRouter'}]}}));
 await page.route('**/api/nyx-ai/models',r=>r.fulfill({json:{models:[{id:'google/gemini-2.5-flash-lite',label:'Gemini',vision:true}]}}));
 const calls=[];
 await page.route('**/api/v1/ai',r=>{calls.push({url:r.request().url(),body:r.request().postDataJSON(),headers:r.request().headers()});return r.fulfill({json:{choices:[{message:{content:'Nyx custom reply'}}]}});});
 await page.route('https://openrouter.ai/api/v1/chat/completions',r=>{calls.push({url:r.request().url(),body:r.request().postDataJSON(),headers:r.request().headers()});return r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({choices:[{delta:{content:'OpenRouter custom reply'}}]})+'\n\ndata: [DONE]\n\n'});});
 await page.goto((process.env.NYX_TEST_BASE_URL||'http://127.0.0.1:8765')+'/ai.html');await page.locator('#modelTrigger').waitFor();
 for(const [key,reply] of [['n_api_'+'a'.repeat(43),'Nyx custom reply'],['sk-or-v1-'+'b'.repeat(64),'OpenRouter custom reply']]){
  await page.locator('#customKeyButton').click();await page.locator('#customKeyInput').fill(key);await page.locator('#customKeyForm').evaluate(f=>f.requestSubmit());
  await page.waitForFunction(()=>!document.querySelector('#customKeyDialog').open);
  await page.locator('#input').fill('Hello');await page.locator('#form').evaluate(f=>f.requestSubmit());
  await page.getByText(reply,{exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('#send').disabled);
  assert.equal(calls.at(-1).headers.authorization,'Bearer '+key);
  assert.ok(!await page.evaluate(k=>JSON.stringify({...localStorage,...sessionStorage}).includes(k),key));
  assert.equal(await page.locator('#customKeyInput').inputValue(),'');
 }
 assert.equal(calls[0].body.stream,false);assert.equal(calls[1].body.stream,true);
 await page.locator('#customKeyButton').click();await page.screenshot({path:'.codex-artifacts/custom-key-'+width+'.png'});await page.locator('#customKeyRemove').click();
 assert.equal(await page.locator('#providerSelect').inputValue(),'shared');assert.deepEqual(errors,[]);await page.close();
}console.log('PASS: Nyx and OpenRouter custom keys, correct endpoint/auth, JSON and streaming playback, memory-only secrets, shared restore, desktop/mobile');}finally{await browser.close();}
