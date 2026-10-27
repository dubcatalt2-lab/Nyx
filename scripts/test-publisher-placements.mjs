import assert from 'node:assert/strict';
import express from 'express';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {domHookAlias} from './build-dom-hooks.mjs';
const root=process.env.NYX_TEST_STATIC_ROOT||'.',aliases=root==='.'?{}:JSON.parse(await readFile(root+'/frontend-assets.json','utf8')).aliases;
const app=express();app.get('/fixture',(_q,r)=>r.type('html').send(`<meta name="viewport" content="width=device-width"><main class="${root==='.'?'library':domHookAlias('class','library')}"><header>Games</header></main><section role="dialog" aria-modal="true" hidden></section><script>window.__nyxPublisherAccount={state:'guest'}</script><script type="module">import {startPlacements} from '${aliases['/js/publisher-placements.js']||'/js/publisher-placements.js'}';startPlacements('games');</script>`));app.use(express.static(root));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:390,height:700}}),tags=[];
 await page.route('https://bicea.org/**',r=>{tags.push(r.request().url());return r.fulfill({contentType:'application/javascript',body:`const image=new Image();image.src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"><rect width="100" height="60" fill="blue"/></svg>';const target=${r.request().url().includes('/21/')?'true':'false'}?document.getElementById('container-9c738b5defae15a3c8d545815ad6e73e'):document.body;if(!target)throw Error("Provider container renamed");target.append(image);`});});
 await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');await page.locator('aside[data-ready]').nth(1).waitFor();
 assert(tags.some(t=>t.includes('6c667b12a78757a74b77d313e1aec445')));assert(tags.some(t=>t.includes('9c738b5defae15a3c8d545815ad6e73e')));assert(!tags.some(t=>t.includes('/14/')),'Social bar is homepage only');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.locator('[role=dialog]').evaluate(e=>e.hidden=false);await page.waitForFunction(()=>!document.querySelector('aside'));
 await page.locator('[role=dialog]').evaluate(e=>e.hidden=true);await page.locator('aside[data-ready]').nth(1).waitFor();
 await page.evaluate(()=>{window.__nyxPublisherAccount={state:'ready',role:'member',subscriptionStatus:'premium'};dispatchEvent(new Event('nyx:publisher-change'));});await page.waitForFunction(()=>!document.querySelector('aside'));
 console.log('PASS games horizontal/native placements, no social bar, mobile fit, gameplay cleanup and premium exemption; provider creatives intercepted');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
