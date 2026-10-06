import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const app=express();app.use(express.static(process.env.NYX_TEST_STATIC_ROOT||'.'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
const authors=['apodex','heygen','togethercomputer','voyageai','respan','jaredpalmer','fish-audio','nex-agi','deepgram','krea','sourceful','canopylabs','sesame','hexgrad','thenlper','intfloat','sentence-transformers','baai'];
let models=[{id:'openai/gpt-6-luna',label:'GPT-6 Luna'},{id:'anthropic/claude-haiku-4.5',label:'Claude Haiku 4.5'},...authors.map(key=>({id:key+'/fixture',label:key}))];
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[],badAssets=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/icons/')&&r.status()!==200)badAssets.push(r.url());});
 await page.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname;return route.fulfill({json:path.endsWith('/models')?{models}:path.endsWith('/providers')?{providers:[{id:'shared',label:'OpenRouter'}]}:{}});});
 await page.goto(base+'/ai.html');await page.locator('#modelTrigger').click();
 const pinned=page.locator('.ai-company-pinned [data-model-company="anthropic"]');await pinned.waitFor();
 await page.waitForTimeout(250);const top=(await pinned.boundingBox()).y;await page.waitForTimeout(2500);assert.equal((await pinned.boundingBox()).y,top,'Anthropic stays visible while other companies animate');
 assert.equal(await page.locator('#modelCompanies .ai-company-initial').count(),0);
 assert.equal(await page.locator('#modelOptions .ai-company-initial').count(),0);
 await page.waitForFunction(()=>[...document.querySelectorAll('#modelCompanies img')].every(i=>i.complete&&i.naturalWidth>0));
 for(const logo of await page.locator('#modelCompanies [style*="--company-logo"]').all()){
  const path=(await logo.getAttribute('style')).match(/url\('([^']+)'\)/)[1];assert.equal((await fetch(base+path)).status,200,path);
 }
 await pinned.click();assert.equal(await page.locator('#modelOptions [data-model-id]').count(),1);
 assert.equal(await page.locator('#modelOptions [data-model-id]').getAttribute('data-model-id'),'anthropic/claude-haiku-4.5');
 await page.screenshot({path:'.codex-artifacts/ai-anthropic-pinned.png'});
 await page.setViewportSize({width:390,height:844});const bounds=await page.locator('#modelMenu').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=390);
 await page.screenshot({path:'.codex-artifacts/ai-anthropic-mobile.png'});
 await page.locator('#modelSearch').press('Escape');
 await page.evaluate(async()=>{const {decorateEmbedded}=await import('/chapels/tutsi/embedded.mjs');decorateEmbedded(document,'ai');});
 await page.locator('#modelTrigger').click();
 await page.waitForFunction(()=>document.querySelector('#modelCompanies').dataset.layout==='tutsi');assert.equal(await page.locator('.ai-company-pinned').count(),0);
 await page.locator('#modelCompanies [data-model-company="anthropic"]').click();assert.equal(await page.locator('#modelOptions [data-model-id]').count(),1);
 models=[{id:'openai/gpt-6-luna',label:'GPT-6 Luna'}];await page.reload();await page.locator('#modelTrigger').click();await pinned.click();assert.equal(await page.locator('#modelOptions [data-model-id]').count(),0);assert.match(await page.locator('.ai-model-empty').innerText(),/available for this account/);
 assert.deepEqual(errors,[]);assert.deepEqual(badAssets,[]);
 console.log('PASS 18 provider icons, no letter placeholders, pinned Anthropic/filter, mobile bounds, Tutsi layout and account-restricted empty state');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
