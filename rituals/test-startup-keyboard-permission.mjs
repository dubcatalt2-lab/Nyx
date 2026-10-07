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
  for(const [mode,width] of [['pending',1365],['pending',390],['denied',1365],['unavailable',390],['granted',1365]]){
    const context=await workspace.newContext({viewport:{width,height:900}});
    await context.route(/^https:\/\//,route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
    await context.addInitScript(mode=>{
      if(window!==window.top)return;
      localStorage.setItem('nyx.setupComplete','true');
      localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');
      localStorage.setItem('nyx.userName','Saved student');
      window.keyboardRequests=0;
      Object.defineProperty(navigator,'keyboard',{configurable:true,value:mode==='unavailable'?undefined:{
        lock(){
          window.keyboardRequests++;
          if(mode==='denied')return Promise.reject(new DOMException('Permission denied','NotAllowedError'));
          if(mode==='pending')return new Promise(resolve=>{window.finishKeyboardRequest=resolve;});
          return Promise.resolve();
        },
        unlock(){}
      }});
    },mode);
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${base}/study.html`,{waitUntil:'domcontentloaded'});
    try{
      await page.waitForFunction(()=>document.body?.classList.contains('workspace-shell')&&!document.body.classList.contains('nyx-loading-active')&&!document.body.classList.contains('nyx-startup-prep'),null,{timeout:15000});
    }catch(error){
      console.error('Startup state',mode,width,await page.evaluate(()=>({requests:window.keyboardRequests,progress:document.querySelector('.nyx-loading-progress')?.outerHTML})));
      throw error;
    }
    if(mode!=='unavailable')assert((await page.evaluate(()=>window.keyboardRequests))>0,'Exercise the keyboard permission request');
    await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:2200}).catch(()=>{});
    const input=page.locator('.nyx-minimal-search input').first();
    await input.fill('startup still works');
    assert.equal(await input.inputValue(),'startup still works');
    assert.equal(await page.locator('#setupLaunchScreen').getAttribute('aria-hidden'),'true');
    assert.equal(await input.evaluate(element=>Boolean(element.closest('[inert]'))),false);
    assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.userName')),'Saved student');
    if(mode==='pending'){
      await page.evaluate(()=>window.finishKeyboardRequest());
      await page.waitForTimeout(100);
      assert.equal(await input.inputValue(),'startup still works','Late permission completion must not reset the page');
    }
    assert.deepEqual(errors,[]);
    console.log(`PASS ${mode}, ${width}px: startup completes and Home remains usable with settings intact.`);
    await context.close();
  }
}finally{
  await workspace.close();
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
}
