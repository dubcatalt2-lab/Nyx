import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const server=express().use(express.static(process.env.NYX_TEST_STATIC_ROOT||'dist')).listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const browser=await chromium.launch({channel:'msedge'});
try {
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  await page.addInitScript(()=>{
    if(!/^https?:$/.test(location.protocol))return;
    localStorage.setItem('nyx.setupComplete','true');
    localStorage.setItem('nyx.browserShellMode','true');
    localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');
    localStorage.setItem('nyx.releaseNotes.2026-09-26-nyx-1.3.6.7.seen','2026-09-26-nyx-1.3.6.7');
  });
  await page.route('**/api/**',route=>route.fulfill({json:{}}));
  const base=process.env.NYX_TEST_BASE_URL||'http://127.0.0.1:'+server.address().port;
  await page.goto(base+'/');
  await page.waitForTimeout(10000);
  const dismiss=page.getByRole('button',{name:'Got it',exact:true});
  if(await dismiss.isVisible())await dismiss.click();
  const ai=page.getByRole('button',{name:'AI',exact:true});
  await ai.click();
  await page.waitForTimeout(1500);
  console.log('Shell frames',page.frames().map(frame=>frame.url()));
  await page.screenshot({path:'.codex-artifacts/a1-shell-before-check.png'});
  await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(frame=>new URL(frame.src,location.href).pathname==='/ai.html'));
  for(let attempt=0;attempt<4;attempt++) {
    const frame=page.frames().find(frame=>new URL(frame.url(),base).pathname==='/ai.html');
    assert(frame,'A1 frame is attached');
    await frame.getByRole('textbox',{name:'Message N7X A1',exact:true}).waitFor();
    assert(await frame.getByRole('textbox',{name:'Message N7X A1',exact:true}).isVisible());
    if(attempt<3)await frame.goto(base+'/ai.html');
  }
  await page.screenshot({path:'.codex-artifacts/a1-shell-loaded.png'});
  console.log('PASS A1 opens in the N7X shell and remains visible across four frame loads');
} finally {await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
