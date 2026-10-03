import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import express from 'express';
import {chromium} from 'playwright';
const app=express();app.use(express.static('dist'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];let releaseList;const listGate=new Promise(r=>releaseList=r);
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.browserShellMode','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');});
 await page.route('https://www.gstatic.com/firebasejs/**/firebase-app.js',r=>r.fulfill({contentType:'text/javascript',body:'export const getApps=()=>[];export const initializeApp=()=>({});'}));
 await page.route('https://www.gstatic.com/firebasejs/**/firebase-auth.js',r=>r.fulfill({contentType:'text/javascript',body:'const user={uid:"3158eOj4ATMzkoC1PAm8H7TXc2R2",email:"fixture@example.com",getIdToken:async()=>"fixture",reload:async()=>{}};export const getAuth=()=>({currentUser:user});export const browserLocalPersistence={};export const setPersistence=async()=>{};export const onAuthStateChanged=(a,f)=>{queueMicrotask(()=>f(a.currentUser));return ()=>{}};'}));
 await page.route('https://loremgroup.org/**',r=>r.fulfill({contentType:'text/html',body:'<html style="background:#171621;color:#eee"><h1>Desktop fixture</h1></html>'}));
 await page.route('**/api/**',async r=>{
  const path=new URL(r.request().url()).pathname;let body={};
  if(path.includes('auth-config'))body={enabled:true,apiKey:'fixture',projectId:'fixture'};
  else if(path==='/api/founder-profile/owner')body={founder:true,dashboard:true,role:'owner',permissions:[]};
  else if(path==='/api/account/me')body={uid:'3158eOj4ATMzkoC1PAm8H7TXc2R2',role:'owner'};
  else if(path==='/api/profiles/me')body={uid:'3158eOj4ATMzkoC1PAm8H7TXc2R2',profile:{displayName:'Owner fixture',handle:'@owner'}};
  else if(path==='/api/account/cloud-preferences')body={preferences:{}};
  else if(path==='/api/nyxcloud/lorem/vms'){await listGate;body={vms:[{id:'one',state:'running',url:'https://loremgroup.org/vm/fixture/'}]};}
  else if(path.startsWith('/api/nyxcloud/'))body={allowed:true};
  else body={online:0,users:[],videos:[],channels:[],apps:[]};
  await r.fulfill({json:body});
 });
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Got it',exact:true}).click();
 await page.locator('[data-nyx-dock-item="apps"]').click();
 let tile;
 for(let i=0;i<60&&!tile;i++){for(const frame of page.frames()){const candidate=frame.locator('[data-global-app-id="nyx-vms"]');if(await candidate.count()&&await candidate.first().isVisible()){tile=candidate.first();break;}}if(!tile)await page.waitForTimeout(100);}
 assert(tile,'VMs app tile must appear');
 const shortcut=page.locator('[data-nyx-dock-item="vms"]');
 await shortcut.waitFor({state:'visible'});
 assert.equal(await shortcut.evaluate(el=>el.previousElementSibling.dataset.nyxDockItem),'chat');
 assert.equal(await shortcut.evaluate(el=>el.nextElementSibling.dataset.nyxDockItem),'apps');
 await shortcut.click();
 let desktop;
 for(let i=0;i<80&&!desktop;i++){desktop=page.frames().find(f=>f.url().includes('/apps/nyxcloud/?embedded=1'));if(!desktop)await page.waitForTimeout(100);}
 assert(desktop,'VMs must open in an internal frame');assert.equal(new URL(page.url()).pathname,'/');
 await desktop.getByRole('heading',{name:'Booting your desktop'}).waitFor();
 assert.match(await desktop.locator('.boot-message').textContent(),/Preparing your workspace/);
 await mkdir('.codex-artifacts',{recursive:true});
 await page.screenshot({path:'.codex-artifacts/nyxcloud-boot.png'});
 releaseList();await desktop.locator('.vm-loading').waitFor({state:'detached'});await desktop.getByRole('button',{name:'Expand'}).waitFor();
 assert.equal(await desktop.locator('#fullscreen').isDisabled(),false);
 await desktop.locator('summary').click();await desktop.getByRole('button',{name:'Disconnect',exact:true}).click();
 await desktop.getByRole('heading',{name:'Desktop disconnected'}).waitFor();
 await desktop.getByRole('button',{name:'Open desktop',exact:true}).click();await desktop.locator('.vm-loading').waitFor({state:'detached'});
 await page.setViewportSize({width:390,height:844});
 assert(await desktop.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow on mobile');
 assert.deepEqual(errors,[]);console.log('PASS full Nyx shell: owner VMs tile, internal tab without top-level navigation, boot overlay, desktop load, disconnect/reconnect and mobile bounds');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
