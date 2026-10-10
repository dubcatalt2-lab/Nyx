import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import express from 'express';
import {chromium} from 'playwright';

const cover=await readFile('dist/index.html','utf8');
assert.match(cover,/<meta http-equiv="refresh" content="1;url=study.html">/);
assert(!/<script\b/i.test(cover),'The cover must navigate without JavaScript');
assert.match(cover,/<title>ռʏӼ<\/title>/);
assert.match(cover,/assets\/icons\/nyx-cat-moon-small\.svg/);
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
  const withoutJs=await workspace.newContext({javaScriptEnabled:false});await withoutJs.route(/^https:\/\//,route=>route.abort());
  const first=await withoutJs.newPage();first.setDefaultTimeout(15000);await first.goto(base,{waitUntil:'domcontentloaded'});await first.waitForURL(base+'/study.html',{waitUntil:'domcontentloaded'});
  await withoutJs.close();
  for(const [width,savedTitle,savedIcon=''] of [[1365,''],[1365,'DeltaMath','./assets/icons/deltamath.png?v=1'],[1365,'StudyHub \u2014 Where Education Is Achievable'],[390,'Learning Commons \u2014 Where Education Is Achievable'],[1365,'My personal notes'],[390,'Learning Commons \u2014 Where Education Is Achievable','data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E']]){
    const context=await workspace.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],documents=[];page.setDefaultTimeout(15000);console.log('Checking identity',width,savedTitle);
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())documents.push(new URL(request.url()).pathname);});
    await context.route(/^https:\/\//,route=>route.abort());
    await context.addInitScript(({savedTitle,savedIcon})=>{
      if(window!==window.top)return;
      localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');
      if(!localStorage.getItem('nyx.fixture.saved')){localStorage.setItem('nyx.tabTitle',savedTitle);localStorage.setItem('nyx.tabFavicon',savedIcon);localStorage.setItem('nyx.tabIdentityVersion',savedTitle==='DeltaMath'?'deltamath-v5':'learning-commons-v4');if(savedTitle==='DeltaMath')localStorage.setItem('nyx.logo','deltamath');localStorage.setItem('nyx.b\u0072owserBookmarks','[{"url":"https://example.com/","title":"Saved"}]');localStorage.setItem('nyx.b\u0072owserBackground','lofiPurple');}
      localStorage.setItem('nyx.fixture.saved','unchanged');
    },{savedTitle,savedIcon});
    await page.goto(base);
    await page.waitForURL(base+'/study.html');
    await page.locator('[data-nyx-dock-item="home"]').waitFor({state:'visible'});
    assert.deepEqual(documents,['/','/study.html']);
    const migrated=(!savedIcon||savedIcon.includes('deltamath.png'))&&(!savedTitle||/^(StudyHub|Learning Commons|DeltaMath)/.test(savedTitle));
    const expectedTitle=migrated?'ռʏӼ':savedTitle;
    await page.waitForFunction(title=>document.title===title,expectedTitle);
    if(migrated){
      assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.logo')),'nyx');
      assert.match(await page.locator('#appFavicon').getAttribute('href'),/(?:nyx-cat-moon-small\.svg|^data:image\/|^blob:)/);
      assert.equal((await context.request.get(base+'/assets/icons/nyx-cat-moon-small.svg')).status(),200);
    }
    if(savedIcon&&!migrated)assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.tabFavicon')),savedIcon);
    assert.equal(await page.evaluate(()=>document.body.classList.contains('workspace-shell')),true);
    assert.equal(await page.locator('.workspace-home').count(),1);
    assert.equal(await page.locator('#nyxStudyHubStartup,#nyxStudyHubBackground,#setupScreen,#setupLaunchScreen').count(),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.fixture.saved')),'unchanged');
    assert.equal(await page.locator('.nyx-home-sponsor iframe,.nyx-social-sponsor iframe').count(),0);
    await page.reload();await page.locator('[data-nyx-dock-item="home"]').waitFor({state:'visible'});
    await page.waitForFunction(title=>document.title===title,expectedTitle);
    assert.deepEqual(documents,['/','/study.html','/study.html']);
    assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.workspaceBookmarks')),'[{"url":"https://example.com/","title":"Saved"}]');
    assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.b\u0072owserBookmarks')),null);
    if(!savedTitle){
      await page.waitForFunction(()=>!document.body.classList.contains('nyx-loading-active'));
      await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:2200}).catch(()=>{});
      await page.locator('[data-nyx-dock-item="settings"]').click();
      const settings=page.locator('.workspace-shell-settings-overlay');
      await settings.locator('[data-settings-category-button="workspace"]').click();
      assert.equal(await settings.locator('[data-preset-select]').inputValue(),'nyx');
      await settings.locator('[data-preset-select]').selectOption('google');
      await page.waitForFunction(()=>document.title==='Google');
      await settings.getByRole('button',{name:'Reset',exact:true}).click();
      await page.waitForFunction(()=>document.title==='ռʏӼ');
      assert.equal(await settings.locator('[data-preset-select]').inputValue(),'nyx');
      assert.match(await page.locator('#appFavicon').getAttribute('href'),/(?:nyx-cat-moon-small\.svg|^data:image\/|^blob:)/);
    }
    assert.deepEqual(errors,[]);
    console.log(`PASS ${width}px: HTML-only redirect, one cover, study entry/reload, saved settings/title migration (${savedTitle}), production ads disabled.`);
    await context.close();
  }
}finally{await workspace.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
