import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {connectionCheckPage} from './s3-connection-check.mjs';
const origin='https://test-fixture.s3.amazonaws.com',backend='https://backend.test';
const browser=await chromium.launch({headless:true});
try{
const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
await page.route('**/*',async route=>{
 if(route.request().resourceType()==='document')return route.fulfill({contentType:'text/html',body:await connectionCheckPage(origin,backend)});
 if(route.request().url().startsWith(backend))return route.fulfill({status:200,headers:{'access-control-allow-origin':origin,'access-control-allow-credentials':'true'},contentType:'application/json',body:'{"supported":true,"cookies":false}'});
 return route.fulfill({contentType:'application/json',body:'{}'});
});
await page.goto(origin+'/connection-check.html');
assert(await page.locator('button').isDisabled());
await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.startsWith('Checks finished'),{timeout:35000});
const result=JSON.parse(await page.locator('pre').innerText());
assert.equal(result.complete,true);assert.equal(result.diagnosticVersion,4);assert(result.checks.length>=7);assert(result.checks.some(c=>c.label==='Site worker'&&c.error));assert.equal(await page.locator('button').isDisabled(),false);
console.log('PASS complete diagnostic, copy gating and bounded blocked-worker setup; no account data read');
await context.close();
const updating=await browser.newContext({serviceWorkers:'block'}),updatePage=await updating.newPage();
await updatePage.addInitScript(()=>{
 const old={},next={},pending=new EventTarget();pending.state='installing';const registration={active:old,installing:pending,waiting:null};
 const workers=new EventTarget();workers.controller=old;workers.ready=Promise.resolve(registration);workers.register=async()=>{setTimeout(()=>{pending.state='activated';registration.active=next;workers.controller=next;pending.dispatchEvent(new Event('statechange'));workers.dispatchEvent(new Event('controllerchange'));window.workerUpdated=true;},300);return registration;};
 Object.defineProperty(navigator,'serviceWorker',{value:workers});
});
await updatePage.route('**/*',async route=>{
 const url=route.request().url();if(route.request().resourceType()==='document')return route.fulfill({contentType:'text/html',body:await connectionCheckPage(origin,backend)});
 if(url.includes('/math-fetch?'))return route.fulfill({status:await updatePage.evaluate(()=>window.workerUpdated)?400:403,contentType:'text/plain',body:'Invalid GMS path'});
 if(url.startsWith(backend))return route.fulfill({headers:{'access-control-allow-origin':origin,'access-control-allow-credentials':'true'},contentType:'application/json',body:'{"supported":true,"cookies":true}'});
 return route.fulfill({contentType:'application/json',body:'{}'});
});
await updatePage.goto(origin+'/connection-check.html');await updatePage.waitForFunction(()=>document.querySelector('[role=status]').textContent.startsWith('Checks finished'));
const updated=JSON.parse(await updatePage.locator('pre').innerText()),game=updated.checks.find(c=>c.label==='Game route through site worker');assert.equal(game.status,400);assert.equal(game.routeReached,true);assert.equal(game.responseKind,'backend-validation');await updating.close();
console.log('PASS diagnostic waits for new worker activation/control and distinguishes expected backend validation from storage403');

}finally{await browser.close();}
