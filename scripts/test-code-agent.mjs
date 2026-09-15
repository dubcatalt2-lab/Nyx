import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});let answer={summary:'Created a Python program and edited JavaScript',files:[{language:'python',code:'print("created")'},{language:'javascript',code:'console.log("edited")'}]},request,hold=false,release,finishReason=null;
 await page.addInitScript(()=>localStorage.setItem('nyx.codeStudio.v1',JSON.stringify({language:'javascript',codes:{javascript:'console.log("original")'}})));
 await page.route('**/api/founder-profile/auth-config',r=>r.fulfill({json:{}}));
 await page.route('**/api/nyx-ai/providers',r=>r.fulfill({json:{providers:[{id:'shared'}]}}));
 await page.route('**/api/nyx-ai/models',r=>r.fulfill({json:{models:[{id:'mercury',label:'Mercury'}]}}));
 await page.route('**/api/nyx-ai',async r=>{request=r.request().postDataJSON();if(hold)await new Promise(resolve=>{release=resolve});await r.fulfill({json:{text:typeof answer==='string'?answer:JSON.stringify(answer),finishReason}})});
 await page.goto((process.env.NYX_TEST_BASE_URL||'http://localhost:8080')+'/apps/code-studio/');
 const prompt=page.locator('[data-ai-prompt-input]'),send=page.locator('[data-ai-send]');
 async function ask(text){await prompt.fill(text);await send.click();await page.waitForFunction(()=>!document.querySelector('[data-ai-send]').disabled);}
 await ask('Create Python and edit JS');assert.equal(request.model,'mercury');
 assert.equal(await page.locator('[data-code-input]').inputValue(),'print("created")');
 await page.getByRole('combobox',{name:'Workspace files'}).selectOption('javascript');assert.equal(await page.locator('[data-code-input]').inputValue(),'console.log("edited")');
 assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('nyx.codeStudio.v1')).versions.some(v=>v.code==='console.log("original")')));
 await page.getByRole('button',{name:'Undo changes',exact:true}).click();assert.equal(await page.locator('[data-code-input]').inputValue(),'console.log("original")');
 assert.equal(await page.getByRole('combobox',{name:'Workspace files'}).locator('option').count(),1);
 assert.equal(request.task,'code-edit');
 answer={summary:'Small patch',files:[{language:'javascript',edits:[{search:'original',replace:'patched'}]}]};await ask('Change the message');assert.equal(await page.locator('[data-code-input]').inputValue(),'console.log("patched")');
 await page.getByRole('button',{name:'Undo changes',exact:true}).last().click();
 answer={summary:'Atomic failure',files:[{language:'python',code:'print(1)'},{language:'javascript',edits:[{search:'missing',replace:'bad'}]}]};await ask('Mismatch');assert.equal(await page.getByRole('combobox',{name:'Workspace files'}).locator('option').count(),1);assert.equal(await page.locator('[data-code-input]').inputValue(),'console.log("original")');
 answer={summary:'Truncated',files:[{language:'javascript',code:'bad'}]};finishReason='length';await ask('Truncated output');assert.equal(await page.locator('[data-code-input]').inputValue(),'console.log("original")');finishReason=null;
 answer='';await ask('Empty output');assert.equal(await page.locator('[data-code-input]').inputValue(),'console.log("original")');
 answer={summary:'bad',files:[{language:'__proto__',code:'bad'}]};await ask('Invalid response');assert.equal(await page.locator('[data-code-input]').inputValue(),'console.log("original")');
 answer='incomplete JSON';await ask('Incomplete response');assert.equal(await page.locator('[data-code-input]').inputValue(),'console.log("original")');
 await page.locator('[data-code-input]').fill('repeat repeat');answer={summary:'Ambiguous patch',files:[{language:'javascript',edits:[{search:'repeat',replace:'bad'}]}]};await ask('Ambiguous');assert.equal(await page.locator('[data-code-input]').inputValue(),'repeat repeat');
 await page.locator('[data-code-input]').fill('console.log("original")');
 answer={summary:'edit',files:[{language:'javascript',code:'console.log("stale")'}]};hold=true;await prompt.fill('Edit this');await send.click();while(!release)await new Promise(r=>setTimeout(r,20));await page.locator('[data-code-input]').fill('console.log("my new edits")');release();await page.waitForFunction(()=>!document.querySelector('[data-ai-send]').disabled);assert.equal(await page.locator('[data-code-input]').inputValue(),'console.log("my new edits")');
 await page.screenshot({path:'.codex-artifacts/code-agent-desktop.png'});await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'.codex-artifacts/code-agent-mobile.png'});
 console.log('PASS agent file creation, edits, selected model, versions, undo, invalid response, stale edit protection, mobile bounds');
}finally{await browser.close()}
