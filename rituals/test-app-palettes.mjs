import {sourceFile} from '../scripture/source-layout.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(process.env.NYX_PALETTE_ROOT||'.'), base='http://nyx.test';
const workspace=await chromium.launch({channel:'msedge',headless:true});
const context=await workspace.newContext({viewport:{width:1280,height:900}});
await context.route(base+'/**',async route=>{
  let path=new URL(route.request().url()).pathname;
  if(path.startsWith('/api/'))return route.fulfill({json:path.includes('status')?{configured:true}:{videos:[],users:[],channels:[],online:0}});
  path=path==='/tutsi'?'/apps/tutsi/index.html':path.endsWith('/')?path+'index.html':path;
  const file=resolve(root,'.'+decodeURIComponent(path));
  try{if(!file.startsWith(root+sep))throw Error('path');await route.fulfill({body:await readFile(sourceFile(file)),contentType:({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.json':'application/json'})[extname(file)]||'application/octet-stream'});}catch{await route.fulfill({status:404,body:'Not found'});}
});
const page=await context.newPage();
await page.addInitScript(()=>{localStorage.setItem('tutsi.customize.seen','1');localStorage.setItem('nyx.theme','halloween');});
try{
  await page.goto(base+'/tutsi#settings');await page.selectOption('#accent','green');await page.locator('#close-prevention').uncheck();
  for(const app of ['chat','youtube','code','links']){
    await page.goto(base+'/tutsi#'+app);
    const f=page.frameLocator('#app-host iframe:not([hidden])');
    await f.locator(`html[data-tutsi-app="${app}"]`).waitFor();
    await f.locator('#tutsi-embedded-style').evaluate(link=>link.sheet||new Promise(r=>link.addEventListener('load',r,{once:true})));
    const palette=await f.locator('body').evaluate(e=>({bg:getComputedStyle(e).backgroundColor,appText:getComputedStyle(e).getPropertyValue('--app-text').trim()}));
    assert.equal(palette.bg,'rgb(30, 47, 29)',app+' base');assert.ok(palette.appText,app+' shared token resolves');
    assert.equal(await f.locator('link[href*="obsidian.css"]').count(),0);
    assert.ok(await f.locator('html').evaluate(e=>getComputedStyle(e).getPropertyValue('--app-text').trim()),app+' root aliases resolve');
    if(app==='chat'){
      for(const selector of ['.chat-app','.conversation','.signin-gate'])assert.equal(await f.locator(selector).evaluate(e=>getComputedStyle(e).backgroundColor),palette.bg,selector+' follows Tutsi');
      const sidebar=await f.locator('.channel-sidebar').evaluate(e=>getComputedStyle(e).backgroundColor);
      assert.notEqual(sidebar,'rgba(5, 6, 9, 0.96)');assert.notEqual(sidebar,'rgb(0, 0, 0)');
      assert.equal(await f.locator('.chat-app').evaluate(e=>getComputedStyle(e,'::before').display),'none');
    }
    await f.locator('body').evaluate(()=>{localStorage.setItem('nyx.theme','ruby');dispatchEvent(new StorageEvent('storage',{key:'nyx.theme',newValue:'ruby'}));});
    assert.equal(await f.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),palette.bg,app+' ignores Nyx palette');
  }
  await page.goto(base+'/apps/nyxtube/');
  for(const [theme,appearance] of [['default','dark'],['halloween','dark'],['halloween','light'],['emerald','light'],['custom','dark']]){
    await page.evaluate(({theme,appearance})=>{localStorage.setItem('nyx.theme',theme);localStorage.setItem('nyx.appearance',appearance);localStorage.setItem('nyx.customThemeColor','#4a89ff');dispatchEvent(new StorageEvent('storage',{key:'nyx.theme',newValue:theme}));},{theme,appearance});
    assert.equal(await page.locator('html').getAttribute('data-nyx-theme'),theme);
    assert.equal(await page.locator('html').getAttribute('data-nyx-appearance'),appearance);
    const colors=await page.evaluate(()=>{const style=e=>getComputedStyle(e),probe=document.createElement('div');probe.style.color='var(--app-text)';probe.style.background='var(--app-bg)';document.body.append(probe);const result={body:style(document.body).backgroundColor,bg:style(probe).backgroundColor,heading:style(document.querySelector('.catalog-head h1')).color,text:style(probe).color,star:style(document.querySelector('.starfield')).backgroundImage};probe.remove();return result;});
    assert.equal(colors.body,colors.bg);assert.equal(colors.heading,colors.text);
    if(theme==='halloween')assert.ok(!colors.star.includes('rgb(18, 18, 22)'), 'background uses palette');
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(e).position!=='fixed').slice(0,8).map(e=>({class:e.className,width:e.getBoundingClientRect().width})))));await page.setViewportSize({width:1280,height:900});
  }
  console.log('PASS Tutsi chat/YouTube/code/links ownership and inner surfaces; NyxTube dark/light/Halloween/custom live theme changes and mobile fit');
}finally{await workspace.close();}
