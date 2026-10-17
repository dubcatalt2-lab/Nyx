import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const server=express().use(express.static('dist')).listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const base='http://127.0.0.1:'+server.address().port;
try{
 for(const channel of ['chrome','msedge']){
  const browser=await chromium.launch({channel});
  try{
   for(const saved of ['', 'StudyHub — Where Education Is Achievable', 'DeltaMath', 'My workspace']){
    const context=await browser.newContext(),page=await context.newPage(),errors=[],requests=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
    await page.route('**/api/**',route=>route.fulfill({json:{enabled:false,models:[],apps:[],preferences:{}}}));
    await page.addInitScript(saved=>{
     if(window!==top)return;
     localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');
     localStorage.setItem('nyx.logo',saved==='DeltaMath'?'deltamath':'nyx');
     if(saved)localStorage.setItem('nyx.tabTitle',saved);
     localStorage.setItem('nyx.testSavedState','preserve-this');
    },saved);
    await page.goto(base+'/index.html');
    await page.waitForFunction(()=>document.body?.classList.contains('q6172f40672fb949e9c'));
    const expected=saved==='My workspace'?saved:'N7X';
    await page.waitForFunction(expected=>document.title===expected,expected);
    await page.waitForFunction(expected=>localStorage.getItem('nyx.tabTitle')===expected,expected);
    assert.equal(await page.locator('#nyxStudyHubStartup,#nyxStudyHubBackground').count(),0);
    assert(!requests.some(url=>/startup-studyhub|deltamath/i.test(url)));
    assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.testSavedState')),'preserve-this');
    assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.tabTitle')),expected);
    await page.reload();await page.waitForFunction(expected=>document.title===expected,expected);
    assert.deepEqual(errors,[]);
    await context.close();
   }
   console.log('PASS '+channel+': N7X title, removed startup cloak, old preset migration, custom title and stored state preserved after reload');
  }finally{await browser.close();}
 }
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
