import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';

const app=express();
app.get('/runtime-config.js',(_,res)=>res.type('js').send('window.__NYX_RUNTIME_CONFIG__={publisherAdsEnabled:false};'));
app.use('/api',(_,res)=>res.json({enabled:false,online:0,users:[],apps:[]}));
app.use(express.static('dist'));
const server=app.listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const base=process.env.NYX_TEST_ORIGIN||`http://127.0.0.1:${server.address().port}`;
const workspace=await chromium.launch({channel:'msedge',headless:true});
try{
  for(const [setup,width] of [[null,1365],['false',390],['true',1365]]){
    const context=await workspace.newContext({viewport:{width,height:900}});
    await context.route(/^https:\/\//,route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
    await context.addInitScript(setup=>{
      if(setup!==null)localStorage.setItem('nyx.setupComplete',setup);
      if(setup!==null){
        localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');
        localStorage.setItem('nyx.userName','Saved student');
        localStorage.setItem('nyx.theme','midnight');
      }
    },setup);
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${base}/study.html`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.body?.classList.contains('workspace-shell')&&!document.body.classList.contains('nyx-loading-active')&&!document.body.classList.contains('nyx-startup-prep'),null,{timeout:20000});
    assert.equal(await page.locator('#setupScreen').count(),0);
    assert.equal(await page.locator('body.setup-active').count(),0);
    if(setup===null){
      await page.locator('[data-nyx-tos-agree]').click();
      assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.tosAcceptedVersion')),'2026-07-30');
    }
    await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:2500}).catch(()=>{});
    const input=page.locator('.nyx-minimal-search input').first();
    assert.equal(await input.getAttribute('placeholder'),'Find a topic or enter an address');
    assert.equal(await input.getAttribute('aria-label'),'Find a topic or enter an address');
    assert.equal(await input.getAttribute('data-search-engine'),'duckduckgo');
    await input.fill('Home is ready');
    assert.equal(await input.inputValue(),'Home is ready');
    await page.locator('[data-nyx-dock-item="settings"]').click();
    await page.getByRole('button',{name:'Workspace',exact:true}).click();
    const settings=page.locator('[data-settings-category="workspace"]');
    await settings.waitFor({state:'visible'});
    assert(!/\btabs?\b/i.test(await settings.innerText()),'Workspace settings must use page wording');
    await settings.locator('[data-page-heading]').fill('My Coursework');
    await settings.locator('[data-tab-cloak-apply]').click();
    await page.waitForFunction(()=>document.title==='My Coursework');
    assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.tabTitle')),'My Coursework');
    await page.locator('[data-nyx-dock-item="home"]').click();
    if(setup!==null){
      assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.userName')),'Saved student');
      assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.theme')),'midnight');
    }
    await page.reload();
    await input.waitFor({state:'visible'});
    await page.waitForFunction(()=>document.title==='My Coursework');
    assert.equal(await page.locator('#setupScreen').count(),0);
    assert.deepEqual(errors,[]);
    console.log(`PASS setup=${setup}, ${width}px: no wizard, Home usable, Terms and saved preferences retained.`);
    await context.close();
  }
}finally{
  await workspace.close();
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
}
