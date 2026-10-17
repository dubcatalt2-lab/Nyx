import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const app=express();app.use(express.static(process.env.NYX_TEST_DIST||'.'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'chrome'});
try{
 const page=await browser.newPage();
 await page.route('**/api/**',r=>r.fulfill({json:{}}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/apps/code-studio/');
 for(const width of [1440,940,390]){
  await page.setViewportSize({width,height:900});
  const language=page.locator('[data-language]');await language.selectOption('javascript');
  const box=await language.boundingBox();assert(box.width>=180&&box.height>=40,JSON.stringify({width,box}));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const editor=await page.locator('[data-code-input]').boundingBox();assert(editor.width>100&&editor.height>100,JSON.stringify({width,editor}));
 }
 await page.goto('about:blank');
 await page.setContent('<button id="full" onclick="document.documentElement.requestFullscreen()">Fullscreen</button><div style="width:960px;height:540px"><canvas width="960" height="540"></canvas></div>');
 await page.addScriptTag({path:'assets/games/game-viewport.js'});
 for(const width of [1280,1920,390]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(80);
  const size=await page.locator('canvas').boundingBox();assert.equal(Math.round(size.width),width);assert.equal(Math.round(size.height),900);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true);
 }
 console.log('PASS code language controls at 1440/940/390; game surface follows viewport without overflow at 1280/1920/390');
}finally{await browser.close();await new Promise(r=>server.close(r));}
