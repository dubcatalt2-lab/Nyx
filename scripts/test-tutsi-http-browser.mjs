import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try {
 for(const transport of ['epoxy','libcurl','wisp']){
  const context=await browser.newContext();const page=await context.newPage();
  await page.addInitScript(()=>{
    const Native=window.WebSocket;
    window.WebSocket=class extends Native { constructor(){throw new Error('WebSockets disabled by test');} };
  });
  const requests=[];page.on('request',r=>{if(r.url().includes('/api/tutsi-relay/'))requests.push(r.method()+' '+new URL(r.url()).pathname)});
  page.on('response',r=>{if(r.status()>=400)console.log('HTTP',r.status(),r.url())});page.on('pageerror',e=>console.log('ERROR',e.message));
  await page.goto('http://localhost:9091/tutsi#settings');
  await page.selectOption('#transport',transport);
  await page.locator('#close-prevention').uncheck();await page.selectOption('#blocker','');
  await page.goto('http://localhost:9091/tutsi#home');
  await page.fill('#query','https://example.com');await page.locator('#search button').click();
  await page.frameLocator('#browser-stage iframe').getByRole('heading',{name:'Example Domain'}).waitFor({timeout:60000});
  assert(requests.some(r=>r==='POST /api/tutsi-relay/send'));
  console.log(transport+': real HTTPS page loaded using HTTP fallback with all browser WebSockets disabled');
  await context.close();
 }
}finally{await browser.close()}
