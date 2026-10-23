import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:900,height:650}});
 await page.setContent('<body style="margin:0;background:#222"></body>');
 await page.evaluate(()=>{window.GameScene=class {update(){window.collisionFlag=window.noClip}};window.scene=new GameScene()});
 await page.addScriptTag({path:'assets/studies/study-practice.js'});
 const menu=page.locator('aside'),summary=page.locator('summary');
 const before=await menu.boundingBox();const box=await summary.boundingBox();
 await page.mouse.move(box.x+60,box.y+10);await page.mouse.down();await page.mouse.move(box.x-180,box.y+180,{steps:12});await page.mouse.up();
 const after=await menu.boundingBox();assert(after.x<before.x-100);assert(after.y>before.y+100);assert.equal(await page.locator('details').getAttribute('open'),null);
 await summary.click();assert.notEqual(await page.locator('details').getAttribute('open'),null);
 await page.getByLabel('Autoplay (assisted)').check();await page.evaluate(()=>scene.update());assert.equal(await page.evaluate(()=>collisionFlag),false);
 await page.getByLabel('Noclip',{exact:true}).check();await page.evaluate(()=>scene.update());assert.equal(await page.evaluate(()=>collisionFlag),true);
 await page.getByLabel('Noclip',{exact:true}).uncheck();await page.evaluate(()=>scene.update());assert.equal(await page.evaluate(()=>collisionFlag),false);
 await page.setViewportSize({width:320,height:450});await page.waitForTimeout(150);const resized=await menu.boundingBox();assert(resized.x>=0&&resized.x+resized.width<=320);assert(resized.y>=0&&resized.y+resized.height<=450);
 console.log('PASS: drag, click toggle, viewport containment, autoplay preserves collisions, explicit noclip toggles independently');
} finally {await browser.close()}
