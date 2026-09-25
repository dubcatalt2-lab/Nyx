import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {proxyAssetNames} from './build-proxy-assets.mjs';
const base=process.env.NYX_TEST_BASE_URL||'http://localhost:9192';
const browser=await chromium.launch({channel:'msedge'});
try{for(const brand of (process.env.NYX_TEST_BRANDS||'nyx,tutsi').split(',')){
 const context=await browser.newContext();
 await context.route('**/api/**',r=>r.fulfill({json:{}}));
 await context.route('**/assets/games/',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><h1>Games fixture</h1>'}));
 const paths=['/assets/transports/libcurl-scramjet.mjs','/assets/transports/epoxy-scramjet.mjs'];
 await context.route(url=>paths.some(p=>url.pathname===p||url.pathname===proxyAssetNames[p]),r=>r.fulfill({contentType:'text/javascript',body:`export default class {ready=true;async init(){}close(){}connect(){return [()=>{},()=>{}]}async request(raw){const u=new URL(String(raw));if(u.href.includes('slow'))await new Promise(r=>setTimeout(r,3000));const text=['duckduckgo.com','www.google.com','www.bing.com'].includes(u.hostname)?'<h1>Search results</h1><article id="search" class="b_algo" data-testid="result"><a id="result" target="_blank" href="https://example.com/destination">Open result</a></article>':'<h1>'+u.pathname+'</h1>';return {status:200,statusText:'OK',headers:[['content-type','text/html']],body:new Response('<!doctype html><html><head><title>Fixture</title></head><body>'+text+'</body></html>').body};}}` }));
 await context.addInitScript(engine=>{localStorage.setItem('nyx.engine',engine);localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.releaseNotes.2026-09-14-nyx-1.0.3.seen','2026-09-14-nyx-1.0.3');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');localStorage.setItem('tutsi.customize.seen','1');localStorage.setItem('tutsi.settings.v1',JSON.stringify({engine,transport:'libcurl',httpBridge:true,closePrevention:false}));},process.env.NYX_TEST_ENGINE||'duckduckgo');
 const page=await context.newPage();page.on('pageerror',e=>console.log('PAGEERROR',e.message));await page.goto(base+(brand==='tutsi'?'/tutsi':'/'));await page.waitForTimeout(8500);
 const input=()=>brand==='nyx'?page.locator('[data-browser-shell-url]:visible').first():page.locator('#address');
 const activeFrame=()=>brand==='nyx'?page.locator('.browser-body iframe.view.active'):page.locator('#browser-stage iframe:not([hidden])');
 const submit=async value=>{const box=brand==='tutsi'&&await page.locator('#query').isVisible()?page.locator('#query'):input();await box.fill(value);if(brand==='nyx'&&await activeFrame().count()){await activeFrame().evaluate(f=>f.dispatchEvent(new Event('load')));await page.waitForTimeout(150);assert.equal(await box.inputValue(),value,'page completion must preserve typed search');}await box.press('Enter');};
 const heading=async text=>{const locator=page.frameLocator(brand==='nyx'?'.browser-body iframe.view.active':'#browser-stage iframe:not([hidden])');try{await locator.getByRole('heading',{name:text,exact:true}).waitFor({timeout:30000});}catch(e){console.log('FAIL STATE',await page.evaluate(()=>[...document.querySelectorAll('iframe.view,#browser-stage iframe')].map(f=>({src:f.src,text:f.contentDocument?.body?.innerText?.slice(0,1000)}))));throw e;}return locator;};
 await submit('https://example.com/old');await heading('/old');
 await submit('https://example.com/slow');await activeFrame().evaluate(f=>f.dispatchEvent(new Event('load')));await page.waitForTimeout(1000);
 assert.match(await input().inputValue(),/example.com\/slow/,'old document must not overwrite pending address');await heading('/slow');
 if(brand==='nyx'){await submit('/assets/games/');await heading('Games fixture');}
 else {await page.evaluate(()=>location.hash='games');await page.frameLocator('#app-view iframe').getByRole('heading',{name:'Games fixture'}).waitFor();await page.keyboard.press('Alt+h');}
 await submit('test search');const frame=await heading('Search results');
 const frameCount=page.frames().length;const tabs=await page.locator(brand==='nyx'?'.browser-tabs .browser-tab':'#browser-tabs [role=tab]').count();
 await frame.locator('#result').click();await heading('/destination');
 assert.equal(page.frames().length,frameCount);assert.equal(await page.locator(brand==='nyx'?'.browser-tabs .browser-tab':'#browser-tabs [role=tab]').count(),tabs);assert.equal(context.pages().length,1);
 console.log(brand+': pending address, app-to-search and same-frame result click passed');await context.close();
}}finally{await browser.close();}

