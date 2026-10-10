import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const app=express();
app.get('/runtime-config.js',(_,res)=>res.type('js').send('window.__NYX_RUNTIME_CONFIG__={publisherAdsEnabled:false};'));
app.use(express.static('dist'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base=process.env.NYX_TEST_ORIGIN||'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true});
const apps=['ai.html','link-checker','jsdelivr-publisher','api-keys','code-studio','code-tutorials','connect-domain','nyxtube','chat','nyxify','agents','movies','nyxcloud','cloud-gaming','tutsi','drop'];
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
  assert(!/\b(proxy|scramjet|wisp|epoxy|libcurl)\b/i.test(await category.innerText()),'Connection settings must use neutral wording');
  assert.equal(await category.locator('[data-workspace-mode-select]').count(),1);
  assert.match(await category.innerText(),/Compatibility mode/);
  assert.equal(await category.getByRole('heading',{name:'Connection method',exact:true}).count(),1);
  await page.getByRole('button',{name:'Workspace',exact:true}).click();
  const workspaceSettings=page.locator('[data-settings-category="workspace"]');
  await workspaceSettings.waitFor({state:'visible'});
  assert.equal(await workspaceSettings.locator('[data-cloak-type]').count(),1);
  assert.equal(await workspaceSettings.getByRole('button',{name:'Save study window settings',exact:true}).count(),1);
  for(const label of await page.locator('.nyx-settings-nav button').allTextContents())assert.notEqual(label.normalize('NFKC'),label,'Settings categories need Unicode styling');
  await page.locator('.nyx-settings-filter input').fill('return destination');
  assert(await workspaceSettings.isVisible(),'Plain text filtering must survive styled labels');
  await page.getByRole('button',{name:'Connections',exact:true}).click();
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
   await page.goto(base+(name==='ai.html'?'/ai.html':'/apps/'+name+(name.endsWith('.html')?'':'/')));
   if(name==='ai.html'){
    await page.waitForFunction(()=>document.querySelector('.ai-sidebar-brand strong')?.textContent.normalize('NFKC')==='NYX A1');
    assert.equal((await page.title()).normalize('NFKC'),'NYX A1');
    assert.equal(await page.locator('#input').getAttribute('placeholder'),'Message your model...');
    await page.locator('#input').fill('Nyx AI Games');
    assert.equal(await page.locator('#input').inputValue(),'Nyx AI Games');
    await page.locator('#conversation').evaluate(el=>el.innerHTML='<article class="ai-message"><div class="ai-message-content"><h2>Nyx AI</h2></div></article>');
    await page.waitForTimeout(50);
    assert.equal(await page.locator('.ai-message-content h2').textContent(),'Nyx AI');
   }
   await page.waitForFunction(()=>typeof nyxDisplayName==='function');
   if(name==='code-studio')await page.waitForFunction(()=>document.querySelector('.eyebrow[data-nyx-display-label]')?.textContent.normalize('NFKC')==='NYX A1');
   await page.waitForTimeout(400);
   const state=await page.evaluate(()=>({text:document.body.innerText.slice(0,180),installed:document.__nyxDisplayLabelsInstalled,controls:document.querySelectorAll('button,input,a,select').length}));
   if(!['agents','tutsi','drop'].includes(name)){
    const leftovers=await page.evaluate(()=>{
     const words=/\b(?:games?|gaming|browsers?|brows(?:e[sd]?|ing)|search(?:es|ing|ed)?|proxy|proxies|scramjet)\b/i;
     return [...document.body.querySelectorAll('*')].filter(el=>!el.closest('script,style,textarea,pre,code,[contenteditable],.ai-message,.ai-message-content,.message,.chat-message,.monaco-editor,.cm-editor,[data-nyx-keep-text]')&&el.checkVisibility()).flatMap(el=>{
      const values=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent);
      for(const attr of ['placeholder','title','alt'])if(el.hasAttribute(attr))values.push(el.getAttribute(attr));
      return values.filter(value=>words.test(value)).map(value=>({tag:el.tagName,text:value.slice(0,150)}));
     });
    });
    assert.deepEqual(leftovers,[],name+' visible keyword leftovers');
   }
   if(!state.installed||!state.controls||errors.length)failures.push({name,width,state,errors:[...errors]});
   console.log('AUDIT',width,name,JSON.stringify({installed:state.installed,controls:state.controls,errors}));
  }
  await context.close();
 }
 assert.deepEqual(failures,[]);
 console.log('PASS built desktop/mobile settings save and app startup/label audit. API replies are fixtures; no paid requests or real account changes.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
