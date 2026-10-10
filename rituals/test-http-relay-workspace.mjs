import assert from 'node:assert/strict';
import {unpack} from '../relics/network/frames.mjs';
import {fork} from 'node:child_process';
import {mkdtemp,symlink,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const transport=process.env.NYX_TEST_TRANSPORT || 'libcurl';
const nativeRelay=process.env.NYX_TEST_NATIVE_RELAY==='1';
const trial=process.env.NYX_TEST_SYNC==='1';
assert(['libcurl','epoxy'].includes(transport));
const temporary=await mkdtemp(resolve(tmpdir(),'nyx-relay-workspace-'));
const staticRoot=resolve(temporary,'public');await symlink(resolve(process.env.NYX_TEST_BUILT==='1'?'dist':'.'),staticRoot,process.platform==='win32'?'junction':'dir');
const child=fork('shepherd.js',[],{silent:true,env:{...process.env,PORT:'0',WISP_URL:process.env.NYX_TEST_WISP_URL||'',NYX_SYNC_ENABLED:trial?'1':'0',NYX_STATIC_ROOT:process.env.NYX_TEST_BUILT==='1'?staticRoot:process.cwd(),NYX_PROJECT_ROOT:process.cwd(),FIREBASE_PROJECT_ID:'',FIREBASE_CLIENT_EMAIL:'',FIREBASE_PRIVATE_KEY:'',FIREBASE_WEB_API_KEY:'',NYX_GAME_REPORT_FILE:resolve(temporary,'reports.json')}});
let workspace;
try{
 const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Backend startup timeout')),20000);child.once('exit',code=>{clearTimeout(timer);reject(new Error('Backend exited '+code));});child.on('message',m=>{if(m.type==='nyx:listening'){clearTimeout(timer);resolve(m.port);}});});
 const base=`http://127.0.0.1:${port}`;workspace=await chromium.launch({channel:'msedge',headless:process.env.NYX_TEST_HEADLESS==='1'});
 for(const brand of (process.env.NYX_TEST_BRANDS||'nyx,tutsi,drop').split(',')){
  const context=await workspace.newContext();
  await context.route('**/api/**',r=>new URL(r.request().url()).pathname.startsWith('/api/tutsi-relay/')?r.continue():r.fulfill({json:{}}));
  await context.addInitScript(({transport,nativeRelay,trial})=>{localStorage.setItem('nyx.connectionTrial',JSON.stringify(trial));localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');localStorage.setItem('nyx.releaseNotes.2026-09-26-nyx-1.3.6.7.seen','2026-09-26-nyx-1.3.6.7');localStorage.setItem('nyx.httpBridge',String(!nativeRelay));localStorage.setItem('nyx.workspaceMode','scramjet');localStorage.setItem('nyx.transport',transport==='libcurl'?'libcurlRaw':transport);localStorage.setItem('drop.setupComplete','1');localStorage.setItem('drop.settings',JSON.stringify({connection:nativeRelay?'direct':'bridge',restore:false}));localStorage.setItem('tutsi.customize.seen','1');localStorage.setItem('tutsi.settings.v1',JSON.stringify({transport,httpBridge:!nativeRelay,closePrevention:false}));if(!nativeRelay)window.WebSocket=class{constructor(){throw new Error('Native WebSockets disabled for HTTP test');}};},{transport,nativeRelay,trial});
  const page=await context.newPage();let syncMessages=0;page.on('websocket',socket=>{if(new URL(socket.url()).pathname==='/api/sync')socket.on('framereceived',event=>{try{if(unpack(event.payload).metadata.kind==='result')syncMessages++;}catch{}});});const issues=[];page.on('pageerror',e=>issues.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().includes('/api/tutsi-relay/'))issues.push(r.status()+' '+new URL(r.url()).pathname);});let batches=0,legacy=0;const runtimeUrls=[];page.on('request',r=>{if(r.url().startsWith(base))runtimeUrls.push(r.url());if(r.url().endsWith('/api/tutsi-relay/send-batch'))batches++;if(r.url().endsWith('/api/tutsi-relay/send'))legacy++;});
  await page.goto(base+(brand==='nyx'?'/nyx':brand==='drop'?'/apps/drop/':'/tutsi'));await page.waitForTimeout(8500);
  const input=page.locator(brand==='nyx'?'[data-workspace-blank-input]:visible,.nyx-minimal-search input:visible':'#query').first();
  await page.screenshot({path:'.codex-artifacts/network-startup.png'});
  await input.fill('https://example.com/');const start=Date.now();await input.press('Enter');
  try{await page.frameLocator(brand==='nyx'?'.workspace-body iframe.view.active':brand==='drop'?'#stage iframe:not([hidden])':'#workspace-stage iframe:not([hidden])').getByText(/This domain is for use in/i).first().waitFor({timeout:45000});}catch(error){console.log('WORKSPACE FAILURE',brand,{batches,issues},await page.evaluate(()=>[...document.querySelectorAll('iframe')].map(f=>{try{return {path:new URL(f.src).pathname,text:f.contentDocument?.body?.innerText?.slice(0,700)}}catch{return {path:f.getAttribute('src')}}})));throw error;}
  if(!nativeRelay)assert(batches>0);else assert.equal(batches,0);assert.equal(legacy,0);
  if(process.env.NYX_TEST_BUILT==='1'){assert(!runtimeUrls.some(url=>/scramjet|libcurl|epoxy|\/~sj\/|\/~\/sj\//i.test(url)),runtimeUrls.join('\n'));assert.equal(await page.evaluate(()=>typeof window.$scramjet),'undefined');assert.notEqual(await page.evaluate(()=>typeof window.$studyjet),'undefined');assert(runtimeUrls.some(url=>new URL(url).pathname.startsWith(transport==='epoxy'||brand==='drop'?'/atlas/':'/textlib/')),'Selected saved transport must load its renamed implementation');}
  if(trial && brand==='nyx')assert(syncMessages>0,'The trial must actually return a framed response, not only fall back');
  console.log(`${brand}: real ${brand==='drop'?'epoxy':transport} navigation over ${nativeRelay?'native WebSocket':'batched HTTP'}, ${batches} batches, ${Date.now()-start}ms${nativeRelay?'':'; native WebSockets unavailable'}`);
  await context.close();
 }
}finally{await workspace?.close();child.kill();await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);});await unlink(staticRoot);await rmdir(temporary);}
