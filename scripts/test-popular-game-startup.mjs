import assert from 'node:assert/strict';import {chromium} from 'playwright';import sharp from 'sharp';import {mkdir} from 'node:fs/promises';
const base=process.env.NYX_TEST_BASE_URL||'http://localhost:9192';
const browser=await chromium.launch({channel:'msedge',args:['--disable-features=LocalNetworkAccessChecks']});
await mkdir('.codex-artifacts',{recursive:true});
try{for(const [name,path] of [['Slope','198.html'],['Run3','177.html'],['CookieClicker','82-a.html'],['BasketRandom','66.html'],['RetroBowl','33-ff.html'],['Gladihoppers','4-pf.html']]){
 const context=await browser.newContext({viewport:{width:1280,height:720}});await context.route('**/api/**',r=>['GET','HEAD'].includes(r.request().method())?r.continue():r.fulfill({json:{}}));const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/assets/gn-math/play.html?game='+path);
 let ready=false;
 for(let attempt=0;attempt<60&&!ready;attempt++){
  for(const frame of page.frames().slice(1)){
   if(name==='CookieClicker'){ready=await frame.evaluate(()=>globalThis.Game?.ready===1).catch(()=>false);if(ready){await frame.locator('#bigCookie').click();assert(await frame.evaluate(()=>Game.cookies>0));break;}}
   else if(name==='BasketRandom'){ready=await frame.evaluate(()=>globalThis.c3_runtimeInterface?._localRuntime?.GetTickCount()>10).catch(()=>false);}
   else {const canvas=frame.locator('canvas').first();if(await canvas.isVisible().catch(()=>false)){const stats=await sharp(await canvas.screenshot()).resize(64,64).stats();ready=stats.channels.slice(0,3).some(c=>c.stdev>15);}}
   if(ready)break;
  }
  if(!ready)await page.waitForTimeout(1000);
 }
 assert(ready,name+' must render game content, not just create a canvas');await page.mouse.click(640,name==='Run3'?450:360);await page.keyboard.press('ArrowRight');await page.waitForTimeout(500);await page.screenshot({path:'.codex-artifacts/popular-'+name+'.png'});
 assert.deepEqual(errors,[],name+' startup errors');console.log(name+': rendered game content and input passed');await context.close();
}}finally{await browser.close();}
