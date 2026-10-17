import {chromium} from 'playwright';import assert from 'node:assert/strict';
const b=await chromium.launch();try{const p=await b.newPage();await p.goto('http://localhost:9091/tutsi#settings');await p.locator('#close-prevention').uncheck();
for(const id of ['appearance','protections','shortcuts','connection','tab-appearance','privacy']){await p.locator('#'+id).evaluate(el=>el.scrollIntoView());await p.waitForTimeout(180);assert.equal(await p.locator('.settings-nav a[aria-current=location]').getAttribute('href'),'#'+id);}
await p.locator('#appearance').evaluate(el=>el.scrollIntoView());await p.waitForTimeout(150);assert.equal(await p.locator('.settings-nav a[aria-current=location]').getAttribute('href'),'#appearance');assert.equal(new URL(p.url()).hash,'#settings');console.log('Settings scroll highlight follows both directions without changing history.');
}finally{await b.close()}
