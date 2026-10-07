import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const origin=process.env.NYX_TEST_ORIGIN||'http://localhost:8080';
const localAds=process.env.NYX_TEST_LOCAL_ADS!=='false';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const width of [1365,390]){
  const context=await browser.newContext({viewport:{width,height:900},userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'});
  await context.addInitScript(()=>{if(window!==top)return;localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');localStorage.setItem('nyx.releaseNotes.2026-10-02-nyx-1.6.8.seen','2026-10-02-nyx-1.6.8');const c=document.createElement('canvas');c.width=64;c.height=64;const g=c.getContext('2d');g.fillStyle='#234567';g.fillRect(0,0,64,64);localStorage.setItem('nyx.customBgData',c.toDataURL());});
  await context.route('**/api/**',r=>r.fulfill({json:{enabled:false,online:0,users:[],apps:[],videos:[],songs:[],items:[],results:[]}}));
  await context.route('**/apps/sponsor/*.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><script>parent.postMessage({type:"nyx:sponsor-ready"},"*")</script>'}));
  await context.route('https://cdn.jsdelivr.net/gh/luminsdk/**',r=>r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/study.html');
  await page.waitForFunction(()=>document.body?.classList.contains('workspace-shell')&&!document.body.classList.contains('nyx-loading-active'));
  await page.waitForFunction(()=>document.querySelector('#customBgImage').src.startsWith('blob:')&&document.querySelector('#customBgImage').naturalWidth===64);
  assert.equal(await page.locator('body > #app').count(),1);
  for(const selector of ['#customBgImage','#desktop','#nyxAwayCover','.nyx-visual-dock','#nyxWorkspaceTabSidebar'])assert.equal(await page.locator('#app '+selector).count(),1,selector);
  assert((await page.locator('html').getAttribute('style')).length<5000);
  assert.equal(await page.locator('iframe[title="Advertisement"]').count(),0);
  const config=await page.evaluate(()=>__NYX_RUNTIME_CONFIG__);assert.equal(config.publisherAdsEnabled,localAds);if(localAds)assert.equal(config.publisherAdsAdkidOnly,true);
  await page.locator('[data-nyx-dock-item="games"]').click();await page.waitForURL(origin+'/history');
  await page.waitForFunction(()=>[...document.querySelectorAll('iframe.view')].some(f=>f.src.includes('/assets/games/')));
  assert.equal(await page.locator('[data-workspace-shell-url]').inputValue(),origin+'/history');
  await page.reload();await page.waitForFunction(()=>document.body&&!document.body.classList.contains('nyx-loading-active')&&document.querySelector('[data-workspace-shell-url]')?.value.endsWith('/history'));
  await page.locator('[data-nyx-dock-item="music"]').click();await page.waitForURL(origin+'/arts');
  await page.waitForFunction(()=>[...document.querySelectorAll('iframe.view')].some(f=>f.src.includes('/apps/nyxify/')));
  await page.locator('[data-nyx-dock-item="home"]').click();await page.waitForURL(origin+'/study.html');
  if(width>900&&localAds){
   await page.evaluate(()=>{__nyxPublisherMode='adkid';dispatchEvent(new Event('nyx:publisher-change'))});
   await page.waitForFunction(()=>document.querySelectorAll('iframe[title="Advertisement"]').length===3);
   await page.locator('[data-nyx-dock-item="games"]').click();await page.waitForURL(origin+'/history');
   await page.waitForFunction(()=>!document.querySelector('iframe[title="Advertisement"]'));
   await page.locator('[data-nyx-dock-item="home"]').click();await page.waitForURL(origin+'/study.html');
   await page.waitForFunction(()=>document.querySelectorAll('iframe[title="Advertisement"]').length===3);
  }
  assert.equal(await page.locator('#app #desktop').count(),1,'Overlay cleanup must retain the grouped interface');
  await page.screenshot({path:'.codex-artifacts/compact-local-'+width+'.png'});
  assert.deepEqual(errors,[]);console.log('PASS localhost compact DOM, uploaded wallpaper, Games/history, reload/deep link, Music/arts, Home, Adkid-only ads and app cleanup:',width);await context.close();
 }
}finally{await browser.close();}
