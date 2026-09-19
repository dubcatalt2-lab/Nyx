import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {identifyFilterAddress,filterSignatures} from '../apps/tutsi/filter-detection.mjs';
for(const signature of filterSignatures)assert.equal(identifyFilterAddress(`chrome-extension://${signature.id}/blocked.html`).vendor,signature.vendor);
assert.equal(identifyFilterAddress('chrome-extension://ckecmkbnoanpgplccmnoikfmpcdladkc/blocked.html').vendor,'securly');
assert.equal(identifyFilterAddress('https://block.opendns.com/?url=private').vendor,'cisco');
for(const url of ['https://securly.com.attacker.test/','https://attacker.test/?url=https://securly.com/','https://goguardian.com@attacker.test/','javascript:alert(1)','https://example.com/securly.com'])assert.equal(identifyFilterAddress(url),null);
const browser=await chromium.launch();try{
const page=await browser.newPage({viewport:{width:390,height:844}});let pastedRequests=0;
await page.addInitScript(()=>localStorage.setItem('tutsi.customize.seen','1'));
page.on('request',request=>{if(request.url().includes('private-fixture'))pastedRequests++});
await page.addInitScript(()=>{const original=window.fetch;window.fetch=(url,...args)=>String(url).startsWith('chrome-extension:')?Promise.reject(Error('hidden')):original(url,...args)});
await page.goto('http://localhost:9091/tutsi#connection');
await page.waitForFunction(()=>document.querySelector('#filter-address-help')?.open);
assert.equal(await page.inputValue('#blocker'),'auto');
await page.fill('#filter-address','https://block.opendns.com/?user=private-fixture');await page.locator('#identify-filter-address').click();
assert((await page.locator('#filter-address-result').textContent()).includes('Cisco Umbrella'));assert.equal(await page.inputValue('#blocker'),'auto');
await page.locator('#use-address-filter').click();assert.equal(await page.inputValue('#blocker'),'cisco');assert.equal(await page.inputValue('#filter-address'),'');
assert(!(await page.evaluate(()=>JSON.stringify(localStorage))).includes('private-fixture'));assert.equal(pastedRequests,0);
await page.locator('#close-prevention').uncheck();await page.reload();await page.waitForFunction(()=>document.querySelector('#blocker')?.value==='cisco');
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
console.log('Block-page recognition, spoof rejection, explicit selection, persistence, privacy and mobile layout passed.');
}finally{await browser.close()}
