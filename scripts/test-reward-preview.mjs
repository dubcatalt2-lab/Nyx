import assert from 'node:assert/strict';
import express from 'express';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=process.env.NYX_TEST_STATIC_ROOT||'.';
const aliases=root==='.'?{}:JSON.parse(await readFile(root+'/frontend-assets.json','utf8')).aliases;
const modulePath=aliases['/js/rewarded-unlocks.js']||'/js/rewarded-unlocks.js';
const app=express();app.get('/fixture',(_req,res)=>res.type('html').send(`<main></main><script type="module">import {mountRewardPreview} from '${modulePath}';mountRewardPreview(document.querySelector('main'));</script>`));app.use(express.static(root));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:360,height:640},reducedMotion:'reduce'});const requests=[];page.on('request',r=>requests.push(r.url()));
 await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);await page.getByRole('button',{name:'Video rewards',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Video rewards'});await dialog.waitFor();assert((await dialog.textContent()).includes('Two completed videos · 24 hours'));
 assert((await dialog.textContent()).includes('aren’t available yet'));assert.equal(await dialog.getByRole('button').count(),1,'No fake watch/claim control');
 const box=await dialog.boundingBox();assert(box.width<=360&&box.x>=0);assert.equal(await dialog.locator('svg').count(),3);
 await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert(await page.getByRole('button',{name:'Video rewards',exact:true}).evaluate(el=>el===document.activeElement));
 assert(!requests.some(url=>/\/api\/|adinplay|bicea|asiafilm/.test(url)),'Inactive preview makes no entitlement/ad calls');
 console.log('PASS inactive reward cards, mobile layout, reduced motion, keyboard close/focus and no ad or entitlement requests');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
