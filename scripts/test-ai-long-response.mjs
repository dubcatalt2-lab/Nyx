import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{for(const tutsi of [false,true]){
 const page=await browser.newPage();let requests=0;
 await page.route('**/api/founder-profile/auth-config',r=>r.fulfill({json:{}}));
 await page.route('**/api/nyx-ai/providers',r=>r.fulfill({json:{providers:[{id:'shared',label:'OpenRouter'}]}}));
 await page.route('**/api/nyx-ai/models',r=>r.fulfill({json:{models:[{id:'anthropic/claude-test',label:'Claude Test',text:true}]}}));
 const long='A detailed paragraph about the project.\n\n'.repeat(800)+'END OF LONG RESPONSE';
 await page.route('**/api/nyx-ai',r=>{requests++;return r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({choices:[{delta:{content:requests===1?long:'The rest of the response.'},finish_reason:requests===1?'length':'stop'}]})+'\n\ndata: [DONE]\n\n'});});
 await page.goto('http://localhost:6767/ai.html');await page.locator('#model option[value="anthropic/claude-test"]').waitFor({state:'attached'});
 if(tutsi)await page.evaluate(async()=>{const {decorateEmbedded}=await import('/apps/tutsi/embedded.mjs');decorateEmbedded(document,'ai')});
 await page.locator('#input').fill('Write a long response');await page.locator('#send').click();await page.getByRole('button',{name:'Continue response'}).waitFor();assert((await page.locator('.ai-answer').innerText()).includes('END OF LONG RESPONSE'));
 await page.reload();await page.getByRole('button',{name:'Continue response'}).waitFor();assert((await page.locator('.ai-answer').innerText()).includes('END OF LONG RESPONSE'));await page.getByRole('button',{name:'Continue response'}).click();await page.getByText('The rest of the response.',{exact:true}).waitFor();assert.equal(requests,2);await page.close();
 }console.log('PASS Nyx/Tutsi long reply rendering, reload persistence and continuation');
}finally{await browser.close();}
