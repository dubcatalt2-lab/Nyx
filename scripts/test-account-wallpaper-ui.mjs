import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const app=express();app.use(express.static(process.env.NYX_TEST_STATIC_ROOT||'dist'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true});let preferences={},writes=0;const errors=[];
async function client(){
 const context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.browserShellMode','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');
 });
 await page.route('https://www.gstatic.com/firebasejs/**/firebase-app.js',r=>r.fulfill({contentType:'text/javascript',body:'export const getApps=()=>[];export const initializeApp=()=>({});'}));
 await page.route('https://www.gstatic.com/firebasejs/**/firebase-auth.js',r=>r.fulfill({contentType:'text/javascript',body:'const user={uid:"wallpaper-fixture",email:"fixture@example.com",getIdToken:async()=>"fixture",reload:async()=>{}};const auth={currentUser:user};export const getAuth=()=>auth;export const browserLocalPersistence={};export const setPersistence=async()=>{};export const onAuthStateChanged=(a,f)=>{queueMicrotask(()=>f(a.currentUser));return ()=>{}};'}));
 await page.route('**/api/**',async r=>{const path=new URL(r.request().url()).pathname;let body={};
  if(path.includes('auth-config'))body={enabled:true,projectId:'fixture',apiKey:'fixture'};
  else if(path==='/api/profiles/me')body={uid:'wallpaper-fixture',profile:{displayName:'Wallpaper test',handle:'@test'},createdAt:'2026-01-01T00:00:00Z'};
  else if(path==='/api/founder-profile/owner')body={founder:false,dashboard:false,role:'member',permissions:[]};
  else if(path==='/api/account/me')body={uid:'wallpaper-fixture',role:'member'};
  else if(path==='/api/account/cloud-preferences'){
   if(r.request().method()==='PUT'){const incoming=r.request().postDataJSON().preferences;preferences={...incoming,'nyx.customBgData':Object.hasOwn(incoming,'nyx.customBgData')?incoming['nyx.customBgData']:preferences['nyx.customBgData']||''};writes++;body={saved:true};}else{body={preferences};}
  }else body={online:0,users:[],videos:[],channels:[]};return r.fulfill({json:body});
 });
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>localStorage.getItem('nyx.cloud.preferences.user')==='wallpaper-fixture');
 await page.getByRole('button',{name:'Got it',exact:true}).click();
 await page.waitForFunction(()=>typeof document.querySelector('[data-nyx-dock-item="youtube"]')?.onclick==='function');

 return {page,context};
}
try{
 const {page}=await client();await page.locator('[data-nyx-dock-item="settings"]').click();await page.locator('[data-settings-category-button="appearance"]').click();await page.locator('[data-upload-wallpaper]').waitFor();
 const png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1280;c.height=720;const g=c.getContext('2d');g.fillStyle='#734ea0';g.fillRect(0,0,c.width,c.height);return c.toDataURL().split(',')[1];}),'base64');
 await page.locator('[data-custom-wallpaper-file]').setInputFiles({name:'test.png',mimeType:'image/png',buffer:png});
 await page.getByText('Wallpaper saved to your account',{exact:true}).waitFor();assert(writes>0);assert.equal(preferences['nyx.customBgData'],'data:image/png;base64,'+png.toString('base64'));
 const second=await client();assert.equal(await second.page.evaluate(()=>localStorage.getItem('nyx.customBgData')),preferences['nyx.customBgData']);
 await second.page.locator('[data-nyx-dock-item="youtube"]').click();
 await second.page.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(f=>f.src.includes('/apps/nyxtube/')));
 assert.equal(await second.page.locator('[data-nyx-dock-item="youtube"]').getAttribute('aria-label'),'YouTube');
 await page.locator('[data-reset-wallpaper]').click();await page.waitForTimeout(1100);assert.equal(preferences['nyx.customBgData'],'');
 await page.screenshot({path:'.codex-artifacts/wallpaper-account-built.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS built UI: upload saved to account, restored in a fresh browser, theme reset synced, sidebar opens NyxTube');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
