import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import express from 'express';
import {chromium} from 'playwright';
import {proxyAssetNames} from './build-proxy-assets.mjs';

const builtAliases=JSON.parse(await readFile((process.env.NYX_TEST_DIST||'dist')+'/proxy-assets.json','utf8')).aliases;
const app=express(),root=process.env.NYX_TEST_DIST||(process.env.NYX_TEST_BUILT==='1'?'dist':'.');
app.use((req,res,next)=>{res.set('Service-Worker-Allowed','/');next();});
app.get('/healthz',(_req,res)=>res.json({ok:true}));
app.use(express.static(root));app.use(express.static('dist'));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base='http://127.0.0.1:'+server.address().port;
const html=`<!doctype html><html><head><title>Navigation fixture</title></head><body>
<h1 id="ready">Ready</h1><textarea id="draft"></textarea>
<a id="external" href="https://destination.test/page">External link</a>
<a id="chain" href="https://redirect.test/start">Redirect chain</a>
<a id="login" href="https://accounts.test/login">Sign in</a>
<form action="https://destination.test/results"><input name="q" value="fixture"><button id="submit">Search</button></form>
<button id="jslogin" onclick="location.href='https://accounts.test/login'">Sign in</button>
<script>window.redirectTo=url=>{location.href=url};window.metaTo=url=>{const meta=document.createElement('meta');meta.httpEquiv='refresh';meta.content='0;url='+url;document.head.append(meta)};document.body.dataset.source=location.href;document.body.dataset.instance=String(Math.random());</script>
</body></html>`;
const transport=`export default class {ready=false;async init(){this.ready=true}close(){}connect(){return [()=>{},()=>{}]}async request(raw){const u=new URL(String(raw));globalThis.__navRequests??=[];globalThis.__navRequests.push(u.href);if(u.hostname==='redirect.test' || u.pathname==='/automatic-hop')return{status:302,statusText:'Found',headers:[['location','https://destination.test/page']],body:new Response('').body};return {status:200,statusText:'OK',headers:[['content-type','text/html']],body:new Response(u.pathname==='/static-refresh'?${JSON.stringify(html)}.replace('<title>','<meta http-equiv=refresh content=\"0;url=https://unwanted.test/static\"><title>'):${JSON.stringify(html)}).body};}}`;
const browser=await chromium.launch({channel:'msedge',headless:true});
try{for(const brand of ['nyx']){
 const context=await browser.newContext();
 await context.routeWebSocket('**/api/tutsi-relay/socket/',socket=>socket.send(Buffer.from([3,0,0,0,0,10,0,0,0])));
 await context.addInitScript(()=>{
  if(!/^https?:$/.test(location.protocol))return;
  localStorage.setItem('tutsi.customize.seen','1');localStorage.setItem('tutsi.settings.v1',JSON.stringify({closePrevention:false,httpBridge:true}));
  localStorage.setItem('drop.setupComplete','1');localStorage.setItem('drop.settings',JSON.stringify({connection:'bridge',restore:false}));
  localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');localStorage.setItem('nyx.releaseNotes.2026-09-26-nyx-1.3.6.7.seen','2026-09-26-nyx-1.3.6.7');localStorage.setItem('nyx.browserMode','scramjet');
 });
 await context.route('**/api/**',r=>r.fulfill({json:{}}));
 await context.route('**/api/tutsi-relay/sessions',r=>r.fulfill({json:{token:'fixture'}}));
 await context.route('**/api/tutsi-relay/receive',r=>r.fulfill({contentType:'application/octet-stream',body:Buffer.from([9,0,0,0,3,0,0,0,0,10,0,0,0])}));
 const paths=['/assets/transports/epoxy-scramjet.mjs','/assets/transports/libcurl-scramjet.mjs'];
 const loadedTransports=new Set();
 await context.route(url=>paths.some(p=>url.pathname===p||url.pathname===proxyAssetNames[p]||url.pathname===builtAliases[p]),r=>{
  const pathname=new URL(r.request().url()).pathname;
  loadedTransports.add(paths.find(p=>pathname===p||pathname===proxyAssetNames[p]||pathname===builtAliases[p]));
  return r.fulfill({contentType:'text/javascript',body:transport});
 });
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 if(process.argv.includes('--debug')){page.on('request',r=>{if(/transports|studyjet/.test(r.url()))console.log('REQUEST',r.url())});page.on('framenavigated',f=>console.log('NAV',f.url()));page.on('console',m=>{console.log(m.type(),m.text().slice(0,700),m.location());});}
 await page.goto(base+(brand==='nyx'?'/index.html':'/apps/'+brand+'/'));await page.waitForTimeout(8500);
 const dismiss=page.getByRole('button',{name:'Got it',exact:true});if(await dismiss.isVisible())await dismiss.click();
 const query=page.locator('[data-browser-blank-input]:visible').first();
 await query.fill('https://source.test/start');await query.press('Enter');
 const frame=page.frameLocator('.browser-body iframe.view.active');
 const address=page.locator('[data-browser-shell-url]:visible').first();
 const source=()=>frame.locator('body').getAttribute('data-source');
 const requests=()=>page.evaluate(()=>globalThis.__navRequests||[]);
 async function go(url){await address.fill(url);await address.press('Enter');await page.waitForTimeout(1800);await frame.locator('#ready').waitFor();assert.equal(await source(),url);}
 try{await frame.locator('#ready').waitFor({timeout:30000});}catch(e){console.log('INITIAL FAILURE',[...loadedTransports],errors,await requests(),await page.locator('body').innerText());throw e;}
 await frame.locator('#draft').fill('Keep me');
 const instance=await frame.locator('body').getAttribute('data-instance');
 // Script-initiated cross-site navigation must never reach the transport.
 await frame.locator('body').evaluate(()=>{setTimeout(()=>window.redirectTo('https://unwanted.test/ad'),50)});
 await page.waitForTimeout(1800);
 if(process.argv.includes('--debug'))console.log('STATE',await requests(),errors,await frame.locator('body').innerText());
 assert.equal(await frame.locator('body').getAttribute('data-instance'),instance);
 assert.equal(await frame.locator('#draft').inputValue(),'Keep me');
 assert.ok(!(await requests()).some(url=>url.includes('unwanted.test')));
 assert.equal(await address.inputValue(),'https://source.test/start');
 // Meta refresh follows the same policy.
 await frame.locator('body').evaluate(()=>{window.metaTo('https://unwanted.test/meta')});
 await page.waitForTimeout(1800);
 if(process.argv.includes('--debug'))console.log('STATE',await requests(),errors,await frame.locator('body').innerText());
 assert.equal(await frame.locator('body').getAttribute('data-instance'),instance);
 assert.ok(!(await requests()).some(url=>url.includes('unwanted.test')));
 // Synthetic clicks do not mint navigation permission.
 await frame.locator('#external').evaluate(link=>link.click());await page.waitForTimeout(1000);
 assert.equal(await frame.locator('body').getAttribute('data-instance'),instance);
 // An automatic same-origin request must not authorize its cross-site 302.
 await frame.locator('body').evaluate(()=>window.redirectTo('/automatic-hop'));await page.waitForTimeout(1500);
 assert.equal(await frame.locator('body').getAttribute('data-instance'),instance);
 // Explicit user links and their HTTP redirect chains work.
 await frame.locator('#external').click();await page.waitForTimeout(1800);
 assert.equal(await source(),'https://destination.test/page');
 await go('https://source.test/start');
 await frame.locator('#chain').click();await page.waitForTimeout(1800);
 assert.equal(await source(),'https://destination.test/page');
 await go('https://source.test/start');
 await frame.locator('#submit').click();await page.waitForTimeout(1800);
 assert.equal(await source(),'https://destination.test/results?q=fixture');
 // Authentication initiated by a real click can return after verification.
 await go('https://source.test/start');
 await frame.locator('#jslogin').click();await page.waitForTimeout(1800);
 assert.equal(await source(),'https://accounts.test/login');
 await frame.locator('body').evaluate(()=>{window.redirectTo('https://source.test/callback')});await page.waitForTimeout(1800);
 assert.equal(await source(),'https://source.test/callback');
 // Same-origin application navigation and assets remain available.
 await frame.locator('body').evaluate(()=>{window.redirectTo('/next')});await page.waitForTimeout(1800);
 assert.equal(await source(),'https://source.test/next');
 await go('https://source.test/static-refresh');await page.waitForTimeout(1000);
 assert.ok(!(await requests()).some(url=>url.includes('unwanted.test')));
 assert.equal(await source(),'https://source.test/static-refresh');
 await frame.locator('body').evaluate(()=>window.metaTo('/refreshed'));await page.waitForTimeout(1800);
 assert.equal(await source(),'https://source.test/refreshed');
 await go('https://source.test/history');
 await go('https://destination.test/history');
 await page.locator('[data-browser-shell-back]:visible').click();await page.waitForTimeout(1800);
 assert.equal(await source(),'https://source.test/history');
 await page.locator('[data-browser-shell-forward]:visible').click();await page.waitForTimeout(1800);
 assert.equal(await source(),'https://destination.test/history');
 assert.equal(new URL(page.url()).origin,base,'Outer browser stays in Nyx');
 assert.deepEqual(errors,[]);
 console.log('PASS',root,'automatic script/meta redirects blocked before transport; document retained; clicked links, HTTP redirects, GET forms, JS sign-in/return and same-origin navigation work');
 await context.close();
}}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
