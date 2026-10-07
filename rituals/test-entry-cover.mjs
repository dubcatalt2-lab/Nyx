import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import express from 'express';
import {chromium} from 'playwright';

const cover=await readFile('dist/index.html','utf8');
assert.match(cover,/<meta http-equiv="refresh" content="1;url=study.html">/);
assert(!/<script\b/i.test(cover),'The cover must navigate without JavaScript');
const source=await readFile('study.html','utf8');
assert(!source.includes('id="nyxStudyHubStartup"'),'No second startup cover');
const manifest=JSON.parse(await readFile('dist/frontend-assets.json','utf8'));
assert(manifest.entryDocuments['study.html']);
assert(!manifest.entryDocuments['index.html']);
const app=express();
app.get('/runtime-config.js',(_,res)=>res.type('js').send('window.__NYX_RUNTIME_CONFIG__={publisherAdsEnabled:false};'));
app.use('/api',(_,res)=>res.json({enabled:false,online:0,users:[],apps:[]}));
app.use(express.static('dist'));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const withoutJs=await browser.newContext({javaScriptEnabled:false});
  const first=await withoutJs.newPage();await first.goto(base);await first.waitForURL(base+'/study.html');
  await withoutJs.close();
  for(const width of [1365,390]){
    const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],documents=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())documents.push(new URL(request.url()).pathname);});
    await context.route(/^https:\/\//,route=>route.abort());
    await context.addInitScript(()=>{
      if(window!==window.top)return;
      localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');
      localStorage.setItem('nyx.fixture.saved','unchanged');
    });
    await page.goto(base);
    await page.waitForURL(base+'/study.html');
    await page.locator('[data-nyx-dock-item="home"]').waitFor({state:'visible'});
    assert.deepEqual(documents,['/','/study.html']);
    assert.equal(await page.locator('#nyxStudyHubStartup,#nyxStudyHubBackground').count(),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.fixture.saved')),'unchanged');
    assert.equal(await page.locator('.nyx-home-sponsor iframe,.nyx-social-sponsor iframe').count(),0);
    await page.reload();await page.locator('[data-nyx-dock-item="home"]').waitFor({state:'visible'});
    assert.deepEqual(documents,['/','/study.html','/study.html']);
    assert.deepEqual(errors,[]);
    console.log(`PASS ${width}px: HTML-only redirect, one cover, study entry/reload, saved settings, production ads disabled.`);
    await context.close();
  }
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
