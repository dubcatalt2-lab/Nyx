import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
process.env.NYX_STATIC_ROOT=fileURLToPath(new URL(process.env.NYX_TEST_SOURCE==='1'?'../':'../dist/',import.meta.url));
const {app}=await import('../server.js');const server=createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome'});
try{
 const page=await browser.newPage();await page.addInitScript(()=>{if(window!==top)return;for(const [k,v] of Object.entries({setupComplete:'true',tosAcceptedVersion:'2026-07-30','releaseNotes.2026-10-02-nyx-1.6.8.seen':'true'}))localStorage.setItem('nyx.'+k,v)});
 await page.goto('http://127.0.0.1:'+server.address().port+'/nyx');
 await page.locator('.n7x-minimal-brand h1').waitFor();await page.waitForFunction(()=>!document.body.matches('.n7x-startup-prep,.n7x-loading-active'));
 const letters=page.locator('.q2c91e70b48a6');assert.equal(await letters.count(),3);
 assert.deepEqual(await letters.evaluateAll(nodes=>nodes.map(n=>{const s=getComputedStyle(n);return [s.animationDuration,s.animationDelay,s.animationTimingFunction]})),[['0.5s','0s','cubic-bezier(0.34, 1.56, 0.64, 1)'],['0.5s','0.05s','cubic-bezier(0.34, 1.56, 0.64, 1)'],['0.5s','0.1s','cubic-bezier(0.34, 1.56, 0.64, 1)']]);
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await letters.first().evaluate(n=>getComputedStyle(n).animationName),'none');
 const button=page.locator('[data-n7x-dock-item="youtube"]');
 for(const [i,action] of ['pointer','Enter','Space'].entries()){
  if(action==='pointer')await button.locator('svg').click();else{await button.focus();await page.keyboard.press(action)}
  await page.waitForTimeout(600);
  assert.equal(await page.locator('iframe').evaluateAll(nodes=>nodes.filter(n=>n.getAttribute('src')?.includes('/apps/nyxtube/')).length),i+1,action+' must create exactly one NyxTube tab');
 }
 console.log('PASS single NyxTube launch for pointer/Enter/Space; Novene title timing and reduced motion');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
