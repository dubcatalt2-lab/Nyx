import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
// Local source/build overrides at live origins: real game assets, isolated storage,
// no production account mutations and no publishing of files.
const root=resolve(process.env.NYX_TEST_STATIC_ROOT||'.');
const browser=await chromium.launch({channel:'msedge',headless:true});
await mkdir('.codex-artifacts',{recursive:true});
try {
 for(const brand of ['nyx','tutsi']){
  const origin=brand==='nyx'?'https://nyxlearning.org':'https://tutsi.nyxlearning.org';
  const context=await browser.newContext({viewport:{width:1280,height:720}});
  try {
   await context.route('**/api/**',r=>['GET','HEAD'].includes(r.request().method())?r.continue():r.fulfill({json:{}}));
   for(const file of ['assets/ugs/C/clcookieclicker.html','assets/gn-math/play.html','assets/games/gladihoppers.html'])await context.route('**/'+file+'*',async r=>r.fulfill({contentType:'text/html',body:await readFile(resolve(root,file),'utf8')}));
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/assets/ugs/play.html?game=C/clcookieclicker.html');
   let frame=await page.locator('#game').contentFrame();
   await frame.locator('#bigCookie').waitFor();
   const game=page.frames().find(f=>f.url().includes('/C/clcookieclicker.html'));
   await game.waitForFunction(()=>Game.ready===1&&Number.isFinite(Game.cookies),{},{timeout:30000});
   for(let i=0;i<5;i++)await frame.locator('#bigCookie').click();
   const cookies=await game.evaluate(()=>{Game.WriteSave();return Game.cookies;});assert(cookies>=5);
   await page.reload();await page.frameLocator('#game').locator('#bigCookie').waitFor();
   const restored=page.frames().find(f=>f.url().includes('/C/clcookieclicker.html'));
   await restored.waitForFunction(n=>Game.ready===1&&Game.cookies>=n,cookies,{timeout:30000});
   assert.deepEqual(errors,[]);console.log(brand+': Cookie Clicker initializes, clicks earn cookies, saved progress survives reload.');
   await page.goto(origin+'/assets/gn-math/play.html?game=4-pf.html');
   await page.frameLocator('#gameFrame').locator('canvas').waitFor({timeout:60000});
   const unity=page.frames().find(f=>f.parentFrame());
   await unity.waitForFunction(()=>window.gameInstance?.Module?.calledRun&&document.querySelector('#progress')?.hidden,{},{timeout:90000});
   await page.waitForTimeout(4000);
   assert.equal(await unity.evaluate(()=>typeof initPokiBridge),'function');
   assert.equal(await unity.evaluate(()=>typeof PokiSDK.commercialBreak),'function');
   const canvas=page.frameLocator('#gameFrame').locator('canvas');const box=await canvas.boundingBox();assert(box.width>600);
   await canvas.click({position:{x:box.width*.68,y:box.height*.68}});await page.waitForTimeout(500);
   await canvas.click({position:{x:box.width*.5,y:box.height*.9}});await page.keyboard.press('ArrowRight');
   await page.waitForTimeout(1000);assert.deepEqual(errors,[]);
   await page.screenshot({path:'.codex-artifacts/'+brand+'-gladihoppers-play.png'});
   console.log(brand+': Gladihoppers Unity runtime, canvas, tutorial input and ad compatibility passed.');
  }finally{await context.close();}
 }
}finally{await browser.close();}
