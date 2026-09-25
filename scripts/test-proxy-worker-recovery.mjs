import express from 'express';
import {readFile} from 'node:fs/promises';
let generation=0;
const root=process.env.NYX_TEST_BUILT==='1'?'dist':'.';
const app=express();
const workerPaths=['/scramjet.sw.js','/tutsi-runtime.sw.js'];
const workerUrls=new Set([...workerPaths,...workerPaths.map(path=>proxyAssetNames[path]).filter(Boolean)]);
app.use(async(req,res,next)=>{if(!workerUrls.has(req.path))return next();res.set('Service-Worker-Allowed','/');res.type('js').send(await readFile(root+req.path,'utf8')+'\n// generation '+generation);});
app.get('/tutsi',(req,res)=>res.redirect('/apps/tutsi/'));
app.use(express.static(root));app.use(express.static('dist'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
process.env.NYX_TEST_BASE_URL='http://127.0.0.1:'+server.address().port;
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {proxyAssetNames} from './build-proxy-assets.mjs';
const base=process.env.NYX_TEST_BASE_URL||'http://localhost:9192';
const browser=await chromium.launch({channel:'msedge'});
try{for(const brand of (process.env.NYX_TEST_BRANDS||'nyx,tutsi').split(',')){
 const context=await browser.newContext();
 await context.route('**/api/**',r=>r.fulfill({json:{}}));
 await context.route('**/api/tutsi-relay/sessions',r=>r.fulfill({json:{token:'fixture'}}));
 await context.route('**/api/tutsi-relay/receive',r=>r.fulfill({contentType:'application/octet-stream',body:Buffer.from([9,0,0,0,3,0,0,0,0,10,0,0,0])}));
 await context.route('**/assets/games/',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><h1>Games fixture</h1>'}));
 const paths=['/assets/transports/libcurl-scramjet.mjs','/assets/transports/epoxy-scramjet.mjs'];
 await context.route(url=>paths.some(p=>url.pathname===p||url.pathname===proxyAssetNames[p]),r=>r.fulfill({contentType:'text/javascript',body:`export default class {ready=true;async init(){}close(){}connect(){return [()=>{},()=>{}]}async request(raw){const u=new URL(String(raw));if(u.href.includes('slow'))await new Promise(r=>setTimeout(r,3000));const text=['duckduckgo.com','www.google.com','www.bing.com'].includes(u.hostname)?'<h1>Search results</h1><article id="search" class="b_algo" data-testid="result"><a id="result" target="_blank" href="https://example.com/destination">Open result</a></article>':'<h1>'+u.pathname+'</h1>';return {status:200,statusText:'OK',headers:[['content-type','text/html']],body:new Response('<!doctype html><html><head><title>Fixture</title></head><body>'+text+'</body></html>').body};}}` }));
 await context.addInitScript(engine=>{localStorage.setItem('nyx.engine',engine);localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.releaseNotes.2026-09-14-nyx-1.0.3.seen','2026-09-14-nyx-1.0.3');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');localStorage.setItem('tutsi.customize.seen','1');localStorage.setItem('tutsi.settings.v1',JSON.stringify({engine,transport:'libcurl',httpBridge:true,closePrevention:false}));},process.env.NYX_TEST_ENGINE||'duckduckgo');
 const page=await context.newPage();page.on('pageerror',e=>console.log('PAGEERROR',e.message));await page.goto(base+(brand==='tutsi'?'/tutsi':'/'));await page.waitForTimeout(8500);
 const input=()=>brand==='nyx'?page.locator('[data-browser-shell-url]:visible').first():page.locator('#address');
 const activeFrame=()=>brand==='nyx'?page.locator('.browser-body iframe.view.active'):page.locator('#browser-stage iframe:not([hidden])');
 const submit=async value=>{const box=brand==='tutsi'&&await page.locator('#query').isVisible()?page.locator('#query'):input();await box.fill(value);if(brand==='nyx'&&await activeFrame().count()){await activeFrame().evaluate(f=>f.dispatchEvent(new Event('load')));await page.waitForTimeout(150);assert.equal(await box.inputValue(),value,'page completion must preserve typed search');}await box.press('Enter');};
 const heading=async text=>{const locator=page.frameLocator(brand==='nyx'?'.browser-body iframe.view.active':'#browser-stage iframe:not([hidden])');try{await locator.getByRole('heading',{name:text,exact:true}).waitFor({timeout:30000});}catch(e){console.log('FAIL STATE',await page.evaluate(()=>[...document.querySelectorAll('iframe.view,#browser-stage iframe')].map(f=>({src:f.src,text:f.contentDocument?.body?.innerText?.slice(0,1000)}))));throw e;}return locator;};
 await submit('https://example.com/old');await heading('/old');await page.waitForTimeout(6000);
 await activeFrame().evaluate(f=>f.contentDocument.body.dataset.preserved='yes');
 generation++;
 await page.evaluate(async()=>{
   const registrations=await navigator.serviceWorker.getRegistrations();
   for(const registration of registrations){
     const old=registration.active;await registration.update();
     const until=Date.now()+10000;
     while(registration.active===old||registration.active?.state!=='activated'){
       if(Date.now()>until)throw new Error('Fixture worker was not replaced');
       await new Promise(resolve=>setTimeout(resolve,50));
     }
   }
 });
 await page.waitForTimeout(300);
 assert.equal(await activeFrame().evaluate(f=>f.contentDocument.body.dataset.preserved),'yes','Worker recovery must preserve the existing document');
 const recoveryStart=Date.now();
 await submit('https://example.com/slow');await activeFrame().evaluate(f=>f.dispatchEvent(new Event('load')));await page.waitForTimeout(1000);
 assert.match(await input().inputValue(),/example.com\/slow/,'old document must not overwrite pending address');await heading('/slow');
 assert(Date.now()-recoveryStart<12000,'Worker recovery must not enter repeated seven-second route retries');
 console.log(brand,'replacement recovery ms',Date.now()-recoveryStart);
 if(brand==='nyx'){await submit('/assets/games/');await heading('Games fixture');}
 else {await page.evaluate(()=>location.hash='games');await page.frameLocator('#app-view iframe').getByRole('heading',{name:'Games fixture'}).waitFor();await page.keyboard.press('Alt+h');}
 await submit('test search');const frame=await heading('Search results');
 const frameCount=page.frames().length;const tabs=await page.locator(brand==='nyx'?'.browser-tabs .browser-tab':'#browser-tabs [role=tab]').count();
 await frame.locator('#result').click();await heading('/destination');
 assert.equal(page.frames().length,frameCount);assert.equal(await page.locator(brand==='nyx'?'.browser-tabs .browser-tab':'#browser-tabs [role=tab]').count(),tabs);assert.equal(context.pages().length,1);
 console.log(brand+': pending address, app-to-search and same-frame result click passed');await context.close();
}}finally{await browser.close();server.close();}
