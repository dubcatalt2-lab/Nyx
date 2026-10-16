import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const app=express();app.get('/fixture',(_req,res)=>res.type('html').send('<!doctype html><title>Embedded apps</title><body><main>Parent</main></body>'));app.use(express.static(process.env.NYX_TEST_DIST||'dist'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage();
 await page.route('**/api/**',r=>r.fulfill({json:{enabled:false,tracks:[],albums:[],artists:[],models:[],apps:[],preferences:{}}}));
 await page.route('https://**',r=>r.abort());
 for(const path of ['/assets/games/','/apps/nyxify/','/apps/nyxtube/','/apps/nyxcloud/','/apps/movies/','/ai.html']){
  await page.goto(origin+'/fixture');
  await page.evaluate(path=>{const frame=document.createElement('iframe');frame.id='app';frame.sandbox='allow-scripts allow-same-origin allow-forms allow-modals allow-presentation';frame.src=path;document.body.append(frame);},path);
  await page.waitForFunction(()=>{const doc=document.getElementById('app')?.contentDocument;return doc?.readyState==='complete'&&doc.body?.textContent.trim().length>40&&!doc.documentElement.dataset.appPresentation;},null,{timeout:15000});
  const result=await page.locator('#app').evaluate(f=>({body:f.contentDocument.body.textContent.trim().length,visible:getComputedStyle(f.contentDocument.body).visibility,scripts:f.contentDocument.scripts.length,styles:f.contentDocument.styleSheets.length}));
  assert.equal(result.visible,'visible',path);assert(result.scripts>1);assert(result.styles>0);console.log('PASS embedded',path,result.body,'characters');
 }
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
