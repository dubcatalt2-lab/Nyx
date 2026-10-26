import assert from 'node:assert/strict';import express from 'express';import {readFile} from 'node:fs/promises';import {chromium} from 'playwright';
const root=process.env.NYX_TEST_STATIC_ROOT||'.';let aliases={};if(root!=='.')aliases=JSON.parse(await readFile(root+'/frontend-assets.json','utf8')).aliases;
const app=express();app.get('/fixture',(_req,res)=>res.type('html').send(`<html><head></head><body><main class="n2ac0604c6ebc q6139d8ecebcdf8e8c1"><section class="q4f959b063679fe3afa n7x-minimal-home" style="position:relative;width:1100px;height:700px"></section></main><script type="module" src="${aliases['/js/publisher-sides.js']||'/js/publisher-sides.js'}"></script></body></html>`));app.use(express.static(root));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1200,height:850}});let loads=0,popups=0;
 await page.route('https://bicea.org/**',route=>{loads++;return route.fulfill({contentType:'application/javascript',body:`const img=document.createElement('img');img.width=160;img.height=600;img.src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="600"><rect width="160" height="600" fill="blue"/></svg>';document.body.append(img);`});});
 await page.addInitScript(()=>{window.__nyxNativeOpen=()=>{window.testPopups=(window.testPopups||0)+1;return {opener:null,document:{createElement:()=>({}),head:{append(){}}},location:{replace(){}}};};});
 const local=`http://127.0.0.1:${server.address().port}`,publicOrigin=process.env.NYX_TEST_PUBLISHER_ORIGIN;
 if(publicOrigin)await page.route(publicOrigin+'/**',async route=>route.fulfill({response:await route.fetch({url:local+new URL(route.request().url()).pathname})}));
 await page.goto((publicOrigin||local)+'/fixture');await page.waitForTimeout(150);assert.equal(loads,0,'No ads during auth restoration');
 const set=account=>page.evaluate(account=>{window.__nyxPublisherAccount=account;dispatchEvent(new Event('nyx:publisher-change'));},account);
 for(const account of [{state:'ready',role:'member',subscriptionStatus:'premium'},{state:'ready',role:'member',subscriptionStatus:'trialing'},...['owner','co_owner','admin','manager','developer','moderator','support'].map(role=>({state:'ready',role,subscriptionStatus:'free'})),{state:'ready',role:'member',subscriptionStatus:'free',permissions:['accounts:disable']}]){
  await set(account);await page.mouse.click(550,300);await page.waitForTimeout(20);assert.equal(loads,0);assert.equal(await page.evaluate(()=>window.testPopups||0),0);
 }
 await set({state:'ready',role:'member',subscriptionStatus:'free'});await page.locator('aside[data-ready]').nth(1).waitFor();assert.equal(loads,2);
 await page.mouse.click(550,300);await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>window.testPopups),1);
 await page.waitForTimeout(1100);await page.mouse.click(550,300);await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>window.testPopups),2);
 await page.waitForTimeout(1100);await page.mouse.click(550,300);await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>window.testPopups),2,'Two-popunder cap');
 await set({state:'ready',role:'member',subscriptionStatus:'premium'});await page.waitForTimeout(50);assert.equal(await page.locator('aside').count(),0,'Upgrade removes active ads');
 await set({state:'pending'});await page.mouse.click(550,300);assert.equal(await page.locator('aside').count(),0);
 await set({state:'guest'});await page.locator('aside[data-ready]').nth(1).waitFor();assert.equal(loads,4);
 console.log('PASS pending auth, premium/trial, seven staff roles/custom staff, regular member/guest banners, cleanup on upgrade, and two-popunder rate cap; provider requests intercepted.');
 await page.close();
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
