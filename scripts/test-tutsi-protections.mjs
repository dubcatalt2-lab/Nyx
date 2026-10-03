import {readFile} from 'node:fs/promises';
﻿import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {isAdUrl,riskyFile,protectTransport,policyFrom,protectionSource} from '../apps/tutsi/protections.mjs';
assert(isAdUrl('https://ads.doubleclick.net/a'));
assert(!isAdUrl('https://doubleclick.net.example.com/a'));
assert(!isAdUrl('https://example.com/?q=doubleclick.net'));
assert(riskyFile('https://example.com/file%2Eexe'));
assert(!riskyFile('https://example.com/main.js'));
let policy=policyFrom({}),calls=0;
const upstream={request:async url=>{calls++;return {status:200,headers:[['content-disposition','attachment; filename="report.pdf"']],body:new Response('test').body}},connect:()=>[]};
const guarded=protectTransport(upstream,()=>policy,{checkDownload:async()=> 'blocked'});
assert.equal((await guarded.request(new URL('https://doubleclick.net/ad'))).status,200);assert.equal(calls,0);
assert.equal((await guarded.request(new URL('https://example.com/report.pdf'))).status,403);
policy=policyFrom({adBlock:false,downloadBlock:false});assert.equal((await guarded.request(new URL('https://doubleclick.net/ad'))).status,200);assert.equal(calls,2);
const base=process.env.TUTSI_TEST_ORIGIN||'http://localhost:9091';
const aliases=JSON.parse(await readFile('dist/proxy-assets.json','utf8')).aliases;
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage();page.on('pageerror',e=>console.log('Page error:',e.message));
 await page.goto(base+'/tutsi#settings');
 await page.locator('#close-prevention').uncheck();await page.selectOption('#blocker','');await page.selectOption('#transport','epoxy');
 for(const id of ['ad-block','popup-block','download-block'])assert(await page.locator('#'+id).isChecked());
 await page.locator('#ad-block').uncheck();await page.reload();assert(!(await page.locator('#ad-block').isChecked()));await page.locator('#ad-block').check();
 // Actual controller/rewriter with harmless upstream responses; no live ads or files.
 const html=`<!doctype html><html><head><title>Protection fixture</title></head><body><h1>Fixture</h1><div class="ad-banner">Advertisement</div><p id="normal">Normal content</p><script src="https://doubleclick.net/ad.js"></script><button id="popup" onclick="window.open('https://example.com/')">Popup</button><a id="download" href="https://fixture.test/installer.exe" download="installer.exe">Download</a></body></html>`;
 const client=`export default class {ready=false;async init(){this.ready=true}async request(url){const ad=url.hostname==='doubleclick.net';return {status:200,statusText:'OK',headers:[['content-type',ad?'text/javascript':'text/html']],body:new Response(ad?'document.documentElement.dataset.fixtureAd="loaded"':${JSON.stringify(html)}).body}}connect(){return [()=>{},()=>{}]}}`;
 await page.route(url=>[ '/assets/transports/epoxy-scramjet.mjs',aliases['/assets/transports/epoxy-scramjet.mjs'] ].includes(url.pathname),r=>r.fulfill({contentType:'text/javascript',body:client}));
 let popups=0,downloads=0;page.on('popup',async p=>{popups++;await p.close()});page.on('download',()=>downloads++);
 await page.goto(base+'/tutsi#home');await page.fill('#query','https://fixture.test/');await page.locator('#search button').click();
 const frame=page.frameLocator('#browser-stage iframe');try{await frame.getByRole('heading',{name:'Fixture'}).waitFor();}catch(error){console.log('Browser status:',await page.locator('#browser-stage').innerText());console.log('Frames:',page.frames().map(f=>f.url()));for(const f of page.frames().slice(1))console.log((await f.locator('body').innerText()).slice(0,1800));throw error;}
 assert(await frame.locator('body').evaluate(el=>{const ad=el.querySelector('.ad-banner');return !ad||getComputedStyle(ad).display==='none'}));
 assert.equal(await frame.locator('html').getAttribute('data-fixture-ad'),null);
 await frame.locator('#popup').click();await frame.locator('#download').click();await page.waitForTimeout(150);assert.equal(popups,0);assert.equal(downloads,0);
 // Disabling the ad toggle reloads the current page and restores its resources.
 await page.goto(base+'/tutsi#settings');await page.locator('#ad-block').uncheck();
 await page.goto(base+'/tutsi#browser');
 await frame.locator('.ad-banner').waitFor({state:'visible'});
 await page.waitForTimeout(500);assert.equal(await frame.locator('html').getAttribute('data-fixture-ad'),'loaded');
 await page.goto(base+'/tutsi#settings');await page.locator('#popup-block').uncheck();await page.locator('#download-block').uncheck();await page.reload();
 assert(!(await page.locator('#popup-block').isChecked()));assert(!(await page.locator('#download-block').isChecked()));
 // Independent page guard checks: native calls continue when toggles are off.
 const fixture=await browser.newPage();await fixture.setContent('<a id="file" download="installer.exe" href="data:text/plain,test">File</a>');
 await fixture.evaluate(()=>{window.opens=0;window.open=()=>{window.opens++;return null}});
 await fixture.addScriptTag({content:protectionSource({adBlock:false,popupBlock:false,downloadBlock:false})});
 await fixture.evaluate(()=>window.open('https://example.com'));assert.equal(await fixture.evaluate(()=>window.opens),1);
 // The static preview serves files before VPS middleware; test crawler routes on a backend origin only.
 if(process.env.TUTSI_TEST_CRAWLERS==='1'){
 for(const agent of ['Googlebot','GPTBot','ClaudeBot','bingbot'])assert.equal((await fetch(base+'/tutsi',{headers:{'User-Agent':agent}})).status,403);
 assert.equal((await fetch(base+'/tutsi/resource-index')).status,404);
 assert.equal((await fetch(base+'/proxy-assets.json')).status,404);
 assert.equal((await fetch(base+'/tutsi',{headers:{'User-Agent':'Mozilla/5.0'}})).status,200);
 }
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log('Protection checks passed: actual rewritten page, ad requests/cosmetics, popup/download blocking, toggles/reload, domain boundaries, reputation rejection and mobile (crawler checks opt-in for backend origins).');
}finally{await browser.close()}
