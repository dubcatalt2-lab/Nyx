import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.NYX_TEST_BASE_URL||'http://127.0.0.1:8199',browser=await chromium.launch({channel:"msedge"});
try{
 const page=await browser.newPage();page.on('pageerror',error=>console.error('PAGE',error.message));page.on('console',message=>{if(message.type()==='error')console.error('BROWSER',message.text())});page.setDefaultTimeout(15000);
 await page.route('**/api/founder-profile/auth-config',r=>r.fulfill({json:{}}));
 await page.route('**/api/nyx-ai/providers',r=>r.fulfill({json:{providers:[{id:'shared',label:'OpenRouter'}]}}));
 await page.route('**/api/nyx-ai/models*',r=>r.fulfill({json:{models:[{id:'qwen/qwen3.7-flash',label:'Qwen'}]}}));
 let request;
 await page.route('**/api/nyx-ai',r=>{request=r.request().postDataJSON();return r.fulfill({contentType:'text/event-stream',body:'data: {"choices":[{"delta":{"content":"Saved reply"}}]}\n\ndata: [DONE]\n\n'});});
 await page.goto(base+'/ai.html');
 await page.evaluate(()=>{
  const messages=Array.from({length:62},(_,n)=>({role:n%2?'assistant':'user',content:`Message ${n}`}));
  localStorage.setItem('nyx.aiThreads.v1',JSON.stringify(Array.from({length:45},(_,n)=>({id:`thread-${n}`,title:`Conversation ${n}`,messages:n===0?messages:[{role:'user',content:`Old chat ${n}`}],createdAt:1000,updatedAt:10000-n}))));
  localStorage.setItem('nyx.aiActiveThread','thread-0');
 });
 await page.reload();await page.locator('#input').waitFor();
 if(process.env.NYX_HISTORY_REPRO==='1'){
  console.log(JSON.stringify({savedMessages:62,visibleMessages:await page.locator('.ai-message').count(),savedThreads:45,visibleThreads:await page.locator('[data-thread-id]').count()}));
 }else{
  await page.getByRole('button',{name:/Load earlier messages/}).click();
  assert.equal(await page.locator('.ai-message').count(),62);assert.equal(await page.locator('[data-thread-id]').count(),45);
  await page.locator('#input').fill('Keep all my messages');await page.locator('#form').evaluate(f=>f.requestSubmit());
  await page.waitForFunction(()=>!document.querySelector('#send').disabled);
  assert.ok(request.messages.length<=20,'Provider context must stay bounded independently of saved history');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('nyx.aiThreads.v1')));
  assert.equal(saved.length,45);assert.equal(saved.find(t=>t.id==='thread-0').messages.length,64);assert.equal(saved.find(t=>t.id==='thread-0').messages[0].content,'Message 0');
  await page.reload();await page.getByRole('button',{name:/Load earlier messages/}).click();assert.equal(await page.locator('.ai-message').count(),64);
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='nyx.aiThreads.v1')throw new DOMException('Storage full','QuotaExceededError');return original.call(this,key,value);};});
  await page.locator('#input').fill('Unsaved message');await page.locator('#form').evaluate(f=>f.requestSubmit());await page.waitForFunction(()=>!document.querySelector('#send').disabled);
  await page.getByText(/could not save your chat/i).waitFor();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download chats'}).click();assert.equal((await download).suggestedFilename(),'nyx-ai-chats.json');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('nyx.aiThreads.v1')).find(t=>t.id==='thread-0').messages.length),64,'Failed saves must preserve the last durable history');
  console.log('PASS AI history: >40 messages and conversations retained, earlier-message loading, bounded provider context, reload and visible storage-failure recovery');
 }
}finally{await browser.close();}
