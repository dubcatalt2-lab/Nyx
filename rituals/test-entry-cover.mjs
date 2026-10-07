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
const workspace=await chromium.launch({channel:'msedge',headless:true});
try{
  const withoutJs=await workspace.newContext({javaScriptEnabled:false});
  const first=await withoutJs.newPage();await first.goto(base);await first.waitForURL(base+'/study.html');
  await withoutJs.close();
  for(const [width,savedTitle] of [[1365,'StudyHub \u2014 Where Education Is Achievable'],[390,'StudyHub \u2014 Where Education Is Achievable'],[1365,'My personal notes']]){
    const context=await workspace.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],documents=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())documents.push(new URL(request.url()).pathname);});
    await context.route(/^https:\/\//,route=>route.abort());
    await context.addInitScript(savedTitle=>{
      if(window!==window.top)return;
      localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');
      if(!localStorage.getItem('nyx.fixture.saved')){localStorage.setItem('nyx.tabTitle',savedTitle);localStorage.setItem('nyx.tabIdentityVersion','studyhub-v3');localStorage.setItem('nyx.b\u0072owserBookmarks','[{"url":"https://example.com/","title":"Saved"}]');localStorage.setItem('nyx.b\u0072owserBackground','lofiPurple');}
      localStorage.setItem('nyx.fixture.saved','unchanged');
    },savedTitle);
    await page.goto(base);
    await page.waitForURL(base+'/study.html');
    await page.locator('[data-nyx-dock-item="home"]').waitFor({state:'visible'});
    assert.deepEqual(documents,['/','/study.html']);
    const expectedTitle=savedTitle.startsWith('StudyHub')?'Learning Commons \u2014 Where Education Is Achievable':savedTitle;
    await page.waitForFunction(title=>document.title===title,expectedTitle);
    assert.equal(await page.evaluate(()=>document.body.classList.contains('workspace-shell')),true);
    assert.equal(await page.locator('.workspace-home').count(),1);
    assert.equal(await page.locator('#nyxStudyHubStartup,#nyxStudyHubBackground').count(),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.fixture.saved')),'unchanged');
    assert.equal(await page.locator('.nyx-home-sponsor iframe,.nyx-social-sponsor iframe').count(),0);
    await page.reload();await page.locator('[data-nyx-dock-item="home"]').waitFor({state:'visible'});
    assert.deepEqual(documents,['/','/study.html','/study.html']);
    assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.workspaceBookmarks')),'[{"url":"https://example.com/","title":"Saved"}]');
    assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.b\u0072owserBookmarks')),null);
    assert.deepEqual(errors,[]);
    console.log(`PASS ${width}px: HTML-only redirect, one cover, study entry/reload, saved settings/title migration (${savedTitle}), production ads disabled.`);
    await context.close();
  }
}finally{await workspace.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
