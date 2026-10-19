import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
process.env.NYX_STATIC_ROOT=fileURLToPath(new URL(process.env.NYX_TEST_SOURCE==='1'?'../':'../dist/',import.meta.url));
const {app}=await import('../server.js');const server=createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{if(window!==top)return;for(const [k,v] of Object.entries({setupComplete:'true',tosAcceptedVersion:'2026-07-30','releaseNotes.2026-10-02-nyx-1.6.8.seen':'true'}))localStorage.setItem('nyx.'+k,v)});
await page.goto('http://127.0.0.1:'+server.address().port+'/nyx');await page.locator('.n7x-minimal-brand h1').waitFor();await page.waitForFunction(()=>!document.body.matches('.n7x-startup-prep,.n7x-loading-active'));await page.waitForTimeout(1800);const dismiss=page.locator('[data-n7x-release-notes-close]').first();if(await dismiss.isVisible())await dismiss.click();
const button=page.locator('[data-n7x-dock-item="chat"]');await button.click();
const frame=page.frameLocator('iframe.view[src*="/apps/chat/"]').locator('body');await frame.waitFor();
await frame.evaluate(()=>parent.postMessage({type:'nyx:chat-notification',notificationId:'message:general:100:mention',kind:'mention',sender:'Fixture'},location.origin));
await page.waitForFunction(()=>document.querySelector('[data-n7x-dock-item="chat"]').getAttribute('aria-label')==='Chat, unread mentions');
await frame.evaluate(()=>parent.postMessage({type:'q71f4-read',scope:'channel:other',through:150},location.origin));
assert.equal(await button.getAttribute('aria-label'),'Chat, unread mentions');
await frame.evaluate(()=>parent.postMessage({type:'q71f4-read',scope:'channel:general',through:150},location.origin));
await page.waitForFunction(()=>document.querySelector('[data-n7x-dock-item="chat"]').getAttribute('aria-label')==='Chat');
assert.deepEqual(errors,[]);console.log('PASS actual shell accepts chat mention and scoped read messages without runtime errors');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
