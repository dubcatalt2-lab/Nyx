import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.route('**/firebase-app.js',r=>r.fulfill({contentType:'text/javascript',body:'export const getApps=()=>[];export const initializeApp=()=>({});'}));
 await page.route('**/firebase-auth.js',r=>r.fulfill({contentType:'text/javascript',body:"export const getAuth=()=>({currentUser:{getIdToken:async()=>'fixture'},authStateReady:async()=>{}});export const setPersistence=async()=>{};export const browserLocalPersistence={};export const onAuthStateChanged=()=>()=>{};"}));
 let releaseLaunch;
 await page.route('**/fixture-player',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0;background:black;color:white">Fixture stream</body>'}));
 await page.route('**/api/**' ,r=>{
 const path=new URL(r.request().url()).pathname;
 if(path==='/api/cloud-gaming/sessions' && r.request().method()==='POST')return new Promise(resolve=>{releaseLaunch=()=>resolve(r.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({id:'fixture',status:'finished_queue'})+'\n'}));});
 if(path.endsWith('/start'))return r.fulfill({json:{session:{id:'fixture',state:'active',gameName:'Fixture',embedUrl:'/fixture-player'}}});

 return r.fulfill({json:path.endsWith('/catalog')?{games:Array.from({length:18},(_,i)=>({key:`fixture${i}`,name:`Test Game ${i}`,tags:['Adventure']}))}:path.endsWith('/status')?{configured:true}:path.endsWith('/auth-config')?{enabled:true,projectId:'fixture',apiKey:'fixture'}:{session:null}});
 });
 await page.goto('http://localhost:9091/tutsi#games');
 const games=page.frameLocator('#app-host iframe:not([hidden])');
 await games.getByRole('button',{name:'Cloud Gaming',exact:true}).click();
 const cloud=games.frameLocator('#cloudGamingFrame');
 await cloud.locator('html[data-tutsi-app="cloud"]').waitFor();
 await cloud.locator('.game-card').first().waitFor();
 await page.waitForTimeout(600);
 assert.match(await cloud.locator('body').evaluate(e=>getComputedStyle(e).fontFamily),/Indie Flower/);
 assert.equal(await cloud.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),await games.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor));
 assert(!(await cloud.locator('#catalog-title').isVisible()));
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(500);
  const size=await cloud.locator('html').evaluate(e=>({scroll:e.scrollHeight,client:e.clientHeight,width:e.scrollWidth,viewport:e.clientWidth}));
  assert(size.scroll<=size.client+2,JSON.stringify(size));assert(size.width<=size.viewport+1,JSON.stringify(size));
 }

 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});
  await cloud.getByRole('button',{name:'Play',exact:true}).first().click();
  await games.locator('body.cloud-session-active').waitFor();
  assert(!(await cloud.locator('main').isVisible()),'Catalog hidden during preparation');
  const outer=await page.locator('#app-host iframe:not([hidden])').boundingBox();
  const child=await games.locator('#cloudGamingFrame').boundingBox();
  assert(Math.abs(outer.height-child.height)<2,JSON.stringify({outer,child}));
  assert(Math.abs(outer.y-child.y)<2,'Player starts at app viewport top');
  assert.equal(await games.locator('html').evaluate(e=>getComputedStyle(e).overflow),'hidden');
  while(!releaseLaunch)await page.waitForTimeout(20);releaseLaunch();releaseLaunch=null;
  await cloud.locator('[data-player-layer]:not([hidden])').waitFor();
  const layer=await cloud.locator('[data-player-layer]').boundingBox();assert(Math.abs(layer.height-outer.height)<2);
  await cloud.getByRole('button',{name:'End session',exact:true}).click();
  await games.locator('body:not(.cloud-session-active)').waitFor();
  assert(await cloud.locator('main').isVisible(),'Catalog restored on exit');
 }
 await page.screenshot({path:'.codex-artifacts/cloud-tutsi-mobile.png'});
 console.log('Nested Cloud Gaming theme, typography, desktop/mobile sizing and single scrolling passed.');
}finally{await browser.close()}
