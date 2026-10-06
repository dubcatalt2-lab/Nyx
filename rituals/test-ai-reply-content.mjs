import {sourceFile} from '../scripture/source-layout.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const browser=await chromium.launch({channel:'msedge'});
const answer=String.raw`**Formatted reply** with $e$ and \(\frac{a}{b}\).

\[
x = \frac{1}{2}
\]

Costs $5 and $10.

<script>window.injected=true</script>

| Name | Value |
| --- | --- |
| test | 1 |

`+'```js\nconst literal = "$e$ \\{x\\}";\n'+'z'.repeat(500)+'\n```\n\n'+'Long paragraph. '.repeat(3000)+'END OF LONG REPLY';
try{
 for(const shell of ['nook','drop']){
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://localhost:6767/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   try{const file=resolve('dist','.'+decodeURIComponent(path)+(path.endsWith('/')?'index.html':''));if(!file.startsWith(resolve('dist')+'\\'))throw Error('Invalid path');await route.fulfill({body:await readFile(sourceFile(file)),contentType:({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(file)]||'application/octet-stream'});}catch{await route.continue();}
  });
  await page.route('https://www.gstatic.com/firebasejs/**/firebase-app.js',r=>r.fulfill({contentType:'text/javascript',body:'export const getApps=()=>[];export const initializeApp=()=>({});'}));
  await page.route('https://www.gstatic.com/firebasejs/**/firebase-auth.js',r=>r.fulfill({contentType:'text/javascript',body:'const auth={currentUser:{uid:"fixture-user",getIdToken:async()=>"fixture"}};export const getAuth=()=>auth;export const browserLocalPersistence={};export const setPersistence=async()=>{};export const onAuthStateChanged=(a,f)=>f(a.currentUser);export const signOut=async()=>{};'}));
  await page.route('**/api/**',r=>{
   const url=r.request().url();
   if(url.includes('auth-config'))return r.fulfill({json:{enabled:true,apiKey:'fixture',projectId:'fixture'}});
   if(url.endsWith('/models'))return r.fulfill({json:{models:[{id:'anthropic/claude-test',label:'Anthropic: Claude Test',text:true}]}});
   if(r.request().method()==='POST'&&/ai/.test(url))return r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({model:'anthropic/claude-test',choices:[{finish_reason:'stop',delta:{content:answer}}]})+'\n\ndata: [DONE]\n\n'});
   return r.fulfill({json:{profile:{handle:'tester'}}});
  });
  await page.addInitScript(()=>localStorage.setItem('drop.setupComplete','1'));
  await page.goto('http://localhost:6767/apps/'+(shell==='drop'?'drop':'agents')+'/');
  if(shell==='drop')await page.locator('#aiNav').click();
  const ui=shell==='drop'?page.frameLocator('#aiFrame'):page;
  await ui.locator('#model option[value="anthropic/claude-test"]').waitFor({state:'attached'});
  await ui.locator('#prompt').fill('Explain the equation');await ui.locator('#send').click();
  const reply=ui.locator('.message.assistant .message-content').last();
  await reply.locator('strong').waitFor();
  assert.equal(await reply.locator('.katex').count(),3,shell+' math');
  assert.equal(await reply.locator('script').count(),0);
  assert((await reply.innerText()).includes('Costs $5 and $10.'));
  assert((await reply.locator('pre code').innerText()).includes('$e$ \\{x\\}'));
  assert.equal(await reply.locator('table').count(),1);
  assert((await reply.innerText()).includes('END OF LONG REPLY'));
  await ui.locator('#feed').evaluate(e=>e.scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:'.codex-artifacts/'+shell+'-math-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  if(shell==='nook'&&await ui.locator('#collapseChats').getAttribute('aria-expanded')==='true')await ui.locator('#collapseChats').click();
  if(shell==='drop'&&await page.locator('#collapse').getAttribute('aria-expanded')==='true')await page.locator('#collapse').click();
  await page.waitForTimeout(400);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),shell+' viewport overflow');
  assert(await ui.locator('#feed').evaluate(e=>e.scrollWidth<=e.clientWidth+1),shell+' mobile overflow');
  await mkdir('.codex-artifacts',{recursive:true});
  await page.screenshot({path:'.codex-artifacts/'+shell+'-formatted-reply.png'});
  await page.reload();
  if(shell==='drop')await page.locator('#aiNav').click();
  if(shell==='drop')await ui.locator('#dropHistory').click();
  else if(await ui.locator('#collapseChats').getAttribute('aria-expanded')==='false')await ui.locator('#collapseChats').click();
  await ui.locator('.saved-chat button').first().click();
  await ui.locator('.message.assistant .katex').first().waitFor();
  assert((await ui.locator('.message.assistant').last().innerText()).includes('END OF LONG REPLY'),shell+' persisted formatting');
  assert.deepEqual(errors,[]);
  console.log('PASS',shell,'math, Markdown, code literals, HTML escaping, long replies, mobile width, saved history');
  await page.close();
 }
}finally{await browser.close();}
