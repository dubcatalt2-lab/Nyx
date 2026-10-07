import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const app=express();
app.use('/js',express.static('parables'));
app.get('/apps/sponsor/:file',(_,res)=>res.send('<!doctype html><script>parent.postMessage({type:"nyx:sponsor-ready"},"*")</script>'));
app.get('/',(_,res)=>res.send(`<!doctype html><body class="workspace-shell"><div class="workspace-window workspace-blank"><div id="home" class="workspace-home nyx-minimal-home" style="position:relative;width:1100px;height:700px"><span id="click">Home background</span></div></div><script>
window.__NYX_RUNTIME_CONFIG__={publisherAdsEnabled:true,publisherAdsAdkidOnly:true};window.__nyxPublisherMode='standard';window.selected='home';window.__nyxPublisherHome=()=>selected==='home'?document.getElementById('home'):null;
window.opens=[];window.__nyxNativeOpen=()=>({document:{createElement:()=>({}),head:{append(){}}},location:{replace(url){opens.push(url)}},close(){}});
window.navigate=where=>{selected=where;window.__nyxPublisherNavigation=where;window.dispatchEvent(new Event('nyx:publisher-change'));};
</script><script type="module" src="/js/publisher-home.js"></script>`));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1365,height:900}});let requests=0;
 page.on('request',r=>{if(r.url().includes('/apps/sponsor/'))requests++});
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.waitForTimeout(100);assert.equal(requests,0,'Ordinary accounts stay ad free');
 await page.evaluate(()=>{__nyxPublisherMode='adkid';navigate('home')});
 await page.waitForFunction(()=>document.querySelectorAll('iframe[title="Advertisement"]').length===3);
 await page.locator('#click').click();await page.waitForFunction(()=>opens.length===1);
 for(const where of ['games','search','settings']){
  await page.evaluate(where=>navigate(where),where);
  await page.waitForFunction(()=>!document.querySelector('iframe[title="Advertisement"]'));
  const before=requests;await page.locator('#click').click();await page.waitForTimeout(50);
  assert.equal(requests,before,'Background Home must not load ads');assert.equal(await page.evaluate(()=>opens.length),1);
 }
 await page.evaluate(()=>navigate('home'));await page.locator('.nyx-home-sponsor[data-side="left"] button').click();
 await page.evaluate(()=>navigate('games'));await page.evaluate(()=>navigate('home'));
 await page.waitForTimeout(50);assert.equal(await page.locator('.nyx-home-sponsor[data-side="left"]').count(),0,'Dismissal persists across navigation');
 await page.evaluate(()=>{__nyxAdcoinsFreeUntil=Date.now()+180000;dispatchEvent(new Event('nyx:publisher-change'))});
 await page.waitForFunction(()=>!document.querySelector('iframe[title="Advertisement"]'));
 await page.evaluate(()=>{__nyxAdcoinsFreeUntil=0;__NYX_RUNTIME_CONFIG__.publisherAdsEnabled=false;dispatchEvent(new Event('nyx:publisher-change'))});
 await page.locator('#click').click();assert.equal(await page.evaluate(()=>opens.length),1);
 console.log('PASS Adkid-only preview, 2 home banners + Social Bar, homepage popup, no background-Home/app ads, destroy on navigation, persistent dismissal, ad break, disabled production.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
