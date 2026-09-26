import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {mkdtemp,symlink,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const transport=process.env.NYX_TEST_TRANSPORT || 'libcurl';
const nativeRelay=process.env.NYX_TEST_NATIVE_RELAY==='1';
assert(['libcurl','epoxy'].includes(transport));
const temporary=await mkdtemp(resolve(tmpdir(),'nyx-relay-browser-'));
const staticRoot=resolve(temporary,'public');await symlink(resolve(process.env.NYX_TEST_BUILT==='1'?'dist':'.'),staticRoot,process.platform==='win32'?'junction':'dir');
const child=fork('server.js',[],{silent:true,env:{...process.env,PORT:'0',WISP_URL:'',NYX_STATIC_ROOT:staticRoot,NYX_PROJECT_ROOT:process.cwd(),FIREBASE_PROJECT_ID:'',FIREBASE_CLIENT_EMAIL:'',FIREBASE_PRIVATE_KEY:'',FIREBASE_WEB_API_KEY:'',NYX_GAME_REPORT_FILE:resolve(temporary,'reports.json')}});
let browser;
try{
 const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Backend startup timeout')),20000);child.once('exit',code=>{clearTimeout(timer);reject(new Error('Backend exited '+code));});child.on('message',m=>{if(m.type==='nyx:listening'){clearTimeout(timer);resolve(m.port);}});});
 const base=`http://127.0.0.1:${port}`;browser=await chromium.launch({channel:'msedge'});
 for(const brand of ['nyx','tutsi']){
  const context=await browser.newContext();
  await context.route('**/api/**',r=>new URL(r.request().url()).pathname.startsWith('/api/tutsi-relay/')?r.continue():r.fulfill({json:{}}));
  await context.addInitScript(({transport,nativeRelay})=>{localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');localStorage.setItem('nyx.releaseNotes.2026-09-14-nyx-1.0.3.seen','2026-09-14-nyx-1.0.3');localStorage.setItem('nyx.httpBridge',String(!nativeRelay));localStorage.setItem('nyx.browserMode','scramjet');localStorage.setItem('nyx.transport',transport==='libcurl'?'libcurlRaw':transport);localStorage.setItem('tutsi.customize.seen','1');localStorage.setItem('tutsi.settings.v1',JSON.stringify({transport,httpBridge:!nativeRelay,closePrevention:false}));if(!nativeRelay)window.WebSocket=class{constructor(){throw new Error('Native WebSockets disabled for HTTP test');}};},{transport,nativeRelay});
  const page=await context.newPage();let batches=0,legacy=0;const runtimeUrls=[];page.on('request',r=>{if(r.url().startsWith(base))runtimeUrls.push(r.url());if(r.url().endsWith('/api/tutsi-relay/send-batch'))batches++;if(r.url().endsWith('/api/tutsi-relay/send'))legacy++;});
  await page.goto(base+(brand==='nyx'?'/nyx':'/tutsi'));await page.waitForTimeout(8500);
  const input=page.locator(brand==='nyx'?'[data-browser-shell-url]:visible':'#query').first();
  await input.fill('https://example.com/');const start=Date.now();await input.press('Enter');
  await page.frameLocator(brand==='nyx'?'.browser-body iframe.view.active':'#browser-stage iframe:not([hidden])').getByRole('heading',{name:'Example Domain'}).waitFor({timeout:45000});
  if(!nativeRelay)assert(batches>0);else assert.equal(batches,0);assert.equal(legacy,0);
  if(process.env.NYX_TEST_BUILT==='1'){assert(!runtimeUrls.some(url=>/scramjet|libcurl|epoxy|\/~sj\/|\/~\/sj\//i.test(url)),runtimeUrls.join('\n'));assert.equal(await page.evaluate(()=>typeof window.$scramjet),'undefined');assert.notEqual(await page.evaluate(()=>typeof window.$studyjet),'undefined');assert(runtimeUrls.some(url=>new URL(url).pathname.startsWith(transport==='epoxy'?'/atlas/':'/textlib/')),'Selected saved transport must load its renamed implementation');}
  console.log(`${brand}: real ${transport} navigation over ${nativeRelay?'native WebSocket':'batched HTTP'}, ${batches} batches, ${Date.now()-start}ms${nativeRelay?'':'; native WebSockets unavailable'}`);
  await context.close();
 }
}finally{await browser?.close();child.kill();await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);});await unlink(staticRoot);await rmdir(temporary);}
