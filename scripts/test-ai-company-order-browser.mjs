import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const app=express();app.use(express.static(process.env.NYX_TEST_STATIC_ROOT||'.'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge'});
const companies=['openai','anthropic','meta-llama','x-ai','google','deepseek','qwen','mistralai','inception'];
const models=companies.flatMap((company,index)=>[2,1].map(rank=>({id:company+'/model-'+rank,label:company+' model '+rank,catalogRank:rank+index*10,text:true}))).reverse();
try{
 for(const shell of ['nyx','tutsi']){
  const page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('tutsi.customize.seen','1'));
  await page.route('**/api/**',r=>r.fulfill({json:{}}));
  await page.route('**/api/nyx-ai/providers',r=>r.fulfill({json:{providers:[{id:'shared',label:'OpenRouter'}]}}));
  await page.route('**/api/*-ai/models',r=>r.fulfill({json:{models}}));
  await page.goto(`http://127.0.0.1:${server.address().port}`+(shell==='nyx'?'/ai.html':'/apps/tutsi/index.html#ai'));
  const root=shell==='nyx'?page:page.frameLocator('#app-host iframe:not([hidden])');
  await root.locator('#modelOptions [data-model-id]').first().waitFor({state:'attached'});
  await root.locator('#modelTrigger').click();
  const ids=await root.locator('#modelOptions [data-model-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.modelId));
  assert.deepEqual(ids,companies.flatMap(c=>[1,2].map(rank=>c+'/model-'+rank)));
  await root.locator('#modelOptions [data-model-id="openai/model-1"]').click();
  assert.equal(await root.locator('#model').inputValue(),'openai/model-1');
  assert.deepEqual(errors,[]);await page.close();console.log('PASS '+shell+': all company groups in requested order and ranked models in actual shell');
 }
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
