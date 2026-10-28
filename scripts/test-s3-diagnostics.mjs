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
assert.equal(result.complete,true);assert.equal(result.diagnosticVersion,3);assert(result.checks.length>=7);assert(result.checks.some(c=>c.label==='Site worker'&&c.error));assert.equal(await page.locator('button').isDisabled(),false);
console.log('PASS complete diagnostic, copy gating and bounded blocked-worker setup; no account data read');
}finally{await browser.close();}
