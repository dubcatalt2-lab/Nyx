import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.NYX_TEST_BASE_URL||'http://127.0.0.1:8199';
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.setDefaultTimeout(15000);
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/founder-profile/auth-config',r=>r.fulfill({json:{}}));
 await page.route('**/api/nyx-ai/providers',r=>r.fulfill({json:{providers:[{id:'shared',label:'OpenRouter'}]}}));
 await page.route('**/api/nyx-ai/models*',r=>r.fulfill({json:{models:[{id:'qwen/qwen3.7-flash',label:'Qwen 3.7 Flash'}]}}));
 let request;
 await page.route('**/api/nyx-ai',r=>{
  request=r.request().postDataJSON();
  const events=[{nyx_metadata:{summary:'Compared clear instructions and everyday ingredients.',sources:[]}},
   {choices:[{delta:{content:'Here are two cupcake recipe sites to try.\n\nBoth include ingredient lists and baking instructions.'}}]},
   {nyx_metadata:{sources:[{url:'https://example.com/cupcakes?a=1&b=2',title:'Easy vanilla cupcakes'},{url:'https://recipes.example/chocolate',title:'Chocolate cupcakes'},{url:'javascript:alert(1)',title:'Unsafe'},{url:'https://example.com/cupcakes?a=1&b=2',title:'Duplicate'}]}}];
  return r.fulfill({contentType:'text/event-stream',body:events.map(v=>'data: '+JSON.stringify(v)+'\n\n').join('')+'data: [DONE]\n\n'});
 });
 await page.goto(base+'/ai.html');await page.locator('#input').fill('Find me websites with cupcake recipes');await page.locator('#form').evaluate(f=>f.requestSubmit());
 await page.locator('.ai-source').first().waitFor();await page.waitForFunction(()=>!document.querySelector('#send').disabled);
 assert.equal(await page.locator('.ai-source').count(),2);assert.equal(await page.locator('.ai-message-assistant .ai-sources').count(),1);
 assert.equal(await page.locator('.ai-source').first().getAttribute('href'),'https://example.com/cupcakes?a=1&b=2');
 assert.equal(await page.locator('.ai-source').first().getAttribute('rel'),'noopener noreferrer');
 await page.locator('.ai-reasoning summary').click();assert.ok(await page.getByText('Compared clear instructions and everyday ingredients.',{exact:true}).isVisible());
 await page.screenshot({path:'.codex-artifacts/ai-inline-sources.png',fullPage:true});
 await page.reload();await page.locator('.ai-source').first().waitFor();assert.equal(await page.locator('.ai-source').count(),2);assert.equal(await page.locator('.ai-reasoning').count(),1);
 await page.locator('#input').fill('Thanks');await page.locator('#form').evaluate(f=>f.requestSubmit());await page.waitForFunction(()=>!document.querySelector('#send').disabled);
  assert.ok(request.messages.every(m=>typeof m.content==='string'));assert.ok(request.messages.every(m=>!m.content.includes('Compared clear instructions')),'Summary is saved separately from model conversation');
 await page.route('**/api/nyx-ai',r=>r.fulfill({contentType:'text/event-stream',body:'data: {"choices":[{"delta":{"content":"Incomplete answer"}}]}\n\ndata: {"error":{"message":"Search unavailable"}}\n\n'}));
 await page.locator('#input').fill('Search again');await page.locator('#form').evaluate(f=>f.requestSubmit());await page.locator('.ai-message-error').getByText('Search unavailable',{exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);console.log('PASS inline AI web UI: sources and expandable summary inside message, safe/deduplicated links, saved reload, conversation separation and mobile bounds');
}finally{await browser.close();}
