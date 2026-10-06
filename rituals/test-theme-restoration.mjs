import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const app=express();
app.get('/runtime-config.js',(_,res)=>res.type('js').send(''));
app.use('/api',(_,res)=>res.json({enabled:false,online:0,users:[],apps:[]}));
app.use(express.static(process.env.NYX_TEST_STATIC_ROOT||'.'));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');});
 async function ready(){
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body?.classList.contains('browser-shell')&&!document.body.classList.contains('nyx-loading-active'));
  await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:1800}).catch(()=>{});
  await page.locator('[data-nyx-dock-item="settings"]').click();
  await page.locator('[data-nyx-theme-card="default"]').waitFor();
 }
 await ready();
 for(const theme of ['halloween','midnight','custom','ruby','default']){
  await page.locator(`[data-nyx-theme-card="${theme}"]`).click();
  assert.equal(await page.locator('html').getAttribute('data-nyx-theme'),theme);
  await ready();
  assert.equal(await page.locator('.browser-shell-settings-overlay [data-theme-value]').inputValue(),theme,'restored select');
  assert.equal(await page.locator('[data-nyx-theme-card][aria-pressed="true"]').getAttribute('data-nyx-theme-card'),theme,'restored card');
  assert.equal(await page.locator('html').getAttribute('data-nyx-theme'),theme,'restored palette');
 }
 assert.deepEqual(errors,[]);
 console.log('Theme selection, reload, palette and selected-card restoration passed for Halloween, Midnight, Custom, Ruby and Default.');
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
