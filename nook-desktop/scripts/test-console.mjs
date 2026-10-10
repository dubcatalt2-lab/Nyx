import {createRequire} from 'node:module';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{_electron}=require('../../node_modules/playwright-core');
const folder=path.resolve(import.meta.dirname,'..'),data=mkdtempSync(path.join(tmpdir(),'nook-console-'));
const env={...process.env,NOOK_TEST_DATA:data};delete env.ELECTRON_RUN_AS_NODE;
const installed=process.env.NOOK_INSTALLED_EXE;
const app=await _electron.launch({executablePath:installed||require('electron'),args:installed?['--user-data-dir='+data]:[folder],env});
try {
  const page=await app.firstWindow(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.locator('#accountSetup').waitFor();
  await app.evaluate(({app})=>{
    const require=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json'),{Provider}=require('./src/provider.cjs');
    Provider.prototype.request=async function(route,body){
      if(route.endsWith('/models'))return {models:[{id:'anthropic/claude-haiku-5.5',label:'Anthropic: Claude Haiku 5.5',reasoning:true},{id:'google/gemini-2.5-flash',label:'Google: Gemini 2.5 Flash'}]};
      globalThis.nookTestMessages=body.messages;
      await new Promise(resolve=>setTimeout(resolve,600));
      return {model:body.model,choices:[{message:{content:JSON.stringify({message:'Verified fixture answer',done:true}),reasoning_details:[{type:'reasoning.summary',summary:'Compared the supplied information.'}]},finish_reason:'stop'}]};
    };
  });
  await page.locator('#manualKey summary').click();await page.locator('#key').fill('n_api_'+'a'.repeat(43));await page.locator('#connectAccount').click();await page.locator('#accountSetup').waitFor({state:'hidden'});
  await page.locator('[data-page=memory]').click();await page.locator('#memoryText').fill('I use Windows');await page.locator('#memoryForm button').click();await page.locator('#memories input').check();
  await page.locator('[data-page=skills]').click();await page.locator('#skillTitle').fill('Review');await page.locator('#skillBody').fill('Check error handling');await page.locator('#skillForm button').first().click();await page.locator('#skillsList input').check();
  await page.locator('[data-page=profiles]').click();await page.locator('#profileTitle').fill('Assistant');await page.locator('#profileBody').fill('Be concise');await page.locator('#profileModel').selectOption('google/gemini-2.5-flash');await page.locator('#profileForm button').first().click();await page.locator('#profilesList input').check();
  assert.equal(await page.locator('#model').inputValue(),'google/gemini-2.5-flash');
  await page.locator('[data-page=agent]').click();await page.locator('#prompt').fill('First conversation');await page.locator('#run').click();
  await page.locator('.thinking-message img').waitFor();assert.match(await page.locator('.thinking-message img').getAttribute('src'),/gemini-color/);
  await page.locator('.reasoning-summary').waitFor();await page.locator('.reasoning-summary summary').click();assert.match(await page.locator('.reasoning-summary').textContent(),/Compared/);
  await page.waitForFunction(()=>!document.getElementById('run').disabled);
  await page.locator('#prompt').fill('Follow up');await page.locator('#run').click();await page.waitForFunction(()=>!document.getElementById('run').disabled);
  const context=await app.evaluate(()=>globalThis.nookTestMessages);assert(context.some(item=>item.content==='First conversation'));assert.match(context[0].content,/I use Windows/);assert.match(context[0].content,/Check error handling/);assert.match(context[0].content,/Be concise/);
  await page.locator('#newChat').click();await page.locator('[data-page=search]').click();await page.locator('#sessionQuery').fill('First conversation');await page.locator('#sessionResults button').click();assert.equal(await page.locator('.message.assistant').count(),2);
  await page.locator('#modelTrigger').click();await page.locator('#modelQuery').fill('haiku');await page.locator('.model-option').click();await page.locator('#prompt').fill('Switch models');await page.locator('#run').click();await page.locator('.thinking-message img').waitFor();assert.match(await page.locator('.thinking-message img').getAttribute('src'),/claude-color/);await page.waitForFunction(()=>!document.getElementById('run').disabled);
  assert.equal(await page.locator('.message.assistant').first().locator('strong').textContent(),'Google: Gemini 2.5 Flash');assert.equal(await page.locator('.message.assistant').last().locator('strong').textContent(),'Anthropic: Claude Haiku 5.5');
  await page.screenshot({path:path.join(data,'console.png')});
  await page.locator('[data-page=tasks]').click();await page.locator('#todoTitle').fill('Write tests');await page.locator('#todoForm button').click();await page.locator('#todosList input').check();
  await page.locator('[data-page=conductor]').click();
  for(const title of ['Step one','Step two']) {await page.locator('#queueTitle').fill(title);await page.locator('#queueBody').fill('Explain '+title);await page.locator('#queueForm button').click();}
  const review=app.waitForEvent('window');await page.locator('#runQueue').click();await(await review).locator('#allow').click();await page.waitForFunction(()=>document.getElementById('queueStatus').textContent==='Queue complete.');
  const workspace=await page.evaluate(()=>window.nook.invoke('workspace'));assert.equal(workspace.items.filter(item=>item.kind==='queue'&&item.enabled).length,2);
  await page.locator('#collapseSidebar').click();assert(await page.locator('body').evaluate(el=>el.classList.contains('sidebar-collapsed')));await page.locator('[data-page=memory]').click();assert(await page.locator('[data-panel=memory]').isVisible());
  assert.deepEqual(errors,[]);
  console.log('PASS model picker/icons, thinking/summary, context opt-in, profiles, skills, persistent multi-turn sessions, task checklist, approved sequential queue and collapsed navigation. Screenshot: '+path.join(data,'console.png'));
} finally {await app.close();}
