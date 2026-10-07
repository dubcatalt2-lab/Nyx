import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const app=express();
app.get('/runtime-config.js',(_,res)=>res.type('js').send('window.__NYX_RUNTIME_CONFIG__={publisherAdsEnabled:false};'));
app.use(express.static('dist'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base=process.env.NYX_TEST_ORIGIN||'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true});
const apps=['link-checker','link-generator','jsdelivr-publisher','api-keys','code-studio','nyxtube','chat','nyxify','agents','movies','nyxcloud','cloud-gaming','tutsi','drop'];
const failures=[];
try{
 for(const width of [1365,390]){
  const context=await browser.newContext({viewport:{width,height:900},userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'});
  await context.addInitScript(()=>{if(window!==top)return;localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');localStorage.setItem('nyx.releaseNotes.2026-10-02-nyx-1.6.8.seen','2026-10-02-nyx-1.6.8');localStorage.setItem('tutsi.customize.seen','1');localStorage.setItem('drop.setupComplete','1')});
  await context.route('**/api/**',r=>r.fulfill({json:{enabled:false,online:0,users:[],items:[],results:[],models:[],playlists:[],tracks:[],songs:[],videos:[],channels:[],keys:[],sources:[],providers:[]}}));
  await context.route('https://cdn.jsdelivr.net/gh/luminsdk/**',r=>r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/study.html');await page.waitForFunction(()=>document.body?.classList.contains('workspace-shell')&&!document.body.classList.contains('nyx-loading-active'));
  await page.locator('[data-nyx-dock-item="settings"]').click();
  await page.getByRole('button',{name:'Connections',exact:true}).click();
  const category=page.locator('[data-settings-category="connections"]');await category.waitFor({state:'visible'});
  assert(!/\b(proxy|scramjet|wisp|epoxy|libcurl|ultraviolet)\b/i.test(await category.innerText()),'Connection settings must use neutral wording');
  assert.equal(await category.locator('[data-workspace-mode-select]').count(),1);
  assert.match(await category.innerText(),/Compatibility mode/);
  assert.match(await category.innerText(),/Connection method/);
  await category.locator('[data-workspace-transport]').selectOption({label:'Atlas'});
  const transport=await category.locator('[data-workspace-transport]').inputValue();
  await category.locator('[data-workspace-settings-save]').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.transport')),transport);
  await page.locator('[data-nyx-dock-item="apps"]').click();
  await page.waitForTimeout(200);
  let tileCount=0;
  for(const frame of page.frames()){
   const tiles=frame.locator('.quick-tile > span:not(.quick-icon)');
   tileCount+=await tiles.count();
   for(const label of await tiles.allTextContents())assert.notEqual(label.normalize('NFKC'),label.toUpperCase(),'App tile must use the display formatter: '+label);
  }
  assert(tileCount>=16,'Full default app catalog must be audited');
  for(const name of apps){
   errors.length=0;
   await page.goto(base+'/apps/'+name+'/');
   await page.waitForFunction(()=>typeof nyxDisplayName==='function');
   await page.waitForTimeout(400);
   const state=await page.evaluate(()=>({text:document.body.innerText.slice(0,180),installed:document.__nyxDisplayLabelsInstalled,controls:document.querySelectorAll('button,input,a,select').length}));
   if(!state.installed||!state.controls||errors.length)failures.push({name,width,state,errors:[...errors]});
   console.log('AUDIT',width,name,JSON.stringify({installed:state.installed,controls:state.controls,errors}));
  }
  await context.close();
 }
 assert.deepEqual(failures,[]);
 console.log('PASS built desktop/mobile settings save and app startup/label audit. API replies are fixtures; no paid requests or real account changes.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
