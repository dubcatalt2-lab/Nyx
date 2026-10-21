import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const app=express(); app.use(express.static(process.env.NYX_TEST_DIST||'dist'));
const server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
const base=process.env.NYX_TEST_BASE_URL||`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'msedge'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:940}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{if(!/^https?:$/.test(location.protocol))return;localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');});
 await page.route('**/api/**',r=>r.fulfill({json:{}}));
 await page.goto(base); await page.waitForTimeout(12000);
 const dismiss=page.getByRole('button',{name:'Got it',exact:true});if(await dismiss.isVisible())await dismiss.click();
 for(const [label,path] of [['Music','/apps/nyxify/'],['Chat','/apps/chat/']]) {
  await page.getByRole('button',{name:label,exact:true}).first().click();
  const frame=page.locator(`iframe[src$="${path}"]`).last();
  await frame.waitFor({state:'visible',timeout:15000});
  const box=await frame.boundingBox(); assert(box.width>600&&box.height>300,`${label} occupies the tab content area`);
  await frame.contentFrame().locator('body').waitFor({state:'visible'});
  console.log('PASS shell tab visibly opens '+label);
 }
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'.codex-artifacts/builtin-tabs-verified.png'});
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
