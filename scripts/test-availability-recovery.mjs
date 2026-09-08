import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try{
 const page=await browser.newPage();
 await page.goto('about:blank');await page.clock.install();
 await page.evaluate(()=>{
  window.mode='slow';window.online=true;window.hidden=false;window.url='wss://relay.test/wisp/';window.custom=false;window.opened=0;window.socketClosed=0;
  Object.defineProperty(navigator,'onLine',{get:()=>window.online});
  Object.defineProperty(document,'hidden',{get:()=>window.hidden});
  window.WebSocket=class{constructor(){window.opened++;if(window.mode==='slow')setTimeout(()=>this.onopen?.(),7000);else if(window.mode==='ok')setTimeout(()=>this.onopen?.(),1);else if(window.mode==='fail')setTimeout(()=>this.onerror?.(),1)}close(){window.socketClosed++}};
 });
 await page.addScriptTag({path:'js/availability.js'});
 await page.evaluate(()=>NyxAvailability.start(()=>({url:window.url,custom:window.custom})));
 const warning=page.locator('#nyxAvailabilityWarning');
 const advance=ms=>page.clock.runFor(ms);
 const hidden=async()=>assert(await warning.count()===0 || await warning.isHidden());
 await advance(7001);await hidden(); // A handshake over the old 5s timeout succeeds.
 await page.evaluate(()=>window.mode='hang');
 await advance(30000+10000+5000+10000);await hidden(); // Two timeouts alone do not warn.
 await advance(5000+10000);assert.match(await warning.locator("span").innerText(),/Having trouble connecting to Wisp/);
 assert.doesNotMatch(await warning.locator("span").innerText(),/may be down|Report/);
 await page.evaluate(()=>window.mode='ok');await advance(5002);await hidden(); // No reload needed.
 await page.evaluate(()=>{window.mode='hang';window.hidden=true;document.dispatchEvent(new Event('visibilitychange'))});
 const count=await page.evaluate(()=>opened);await advance(120000);assert.equal(await page.evaluate(()=>opened),count);
 await page.evaluate(()=>{window.hidden=false;document.dispatchEvent(new Event('visibilitychange'))});await advance(1);
 await page.evaluate(()=>{window.hidden=true;document.dispatchEvent(new Event('visibilitychange'))});await advance(20000);await hidden();
 await page.evaluate(()=>{window.mode='ok';window.hidden=false;document.dispatchEvent(new Event('visibilitychange'))});await advance(2);await hidden();
 await page.evaluate(()=>{window.mode='fail';window.custom=true;window.url='wss://custom.test/wisp/'});await advance(40010);
 assert.match(await warning.locator("span").innerText(),/your custom Wisp relay/);
 await page.evaluate(()=>{window.online=false;dispatchEvent(new Event('offline'))});assert.match(await warning.locator("span").innerText(),/You are offline/);
 await page.evaluate(()=>{window.mode='ok';window.online=true;dispatchEvent(new Event('online'))});await advance(2);await hidden();
 await page.evaluate(()=>NyxAvailability.recordHealth(false));await advance(10001);await page.evaluate(()=>{NyxAvailability.recordHealth(false);NyxAvailability.recordHealth(false)});assert.match(await warning.locator("span").innerText(),/VPS/);
 await page.evaluate(()=>NyxAvailability.recordHealth(true));await advance(2);await hidden();
 for(const width of [1280,390]){await page.setViewportSize({width,height:844});await page.evaluate(()=>{window.online=false;dispatchEvent(new Event('offline'))});assert(await warning.evaluate(e=>e.getBoundingClientRect().right<=innerWidth));}
 assert.equal(await page.evaluate(()=>opened),await page.evaluate(()=>window.socketClosed));
 console.log('PASS: slow handshake, timeout threshold, automatic recovery, background cancellation/resume, custom relay, offline/online, host recovery, responsive banner and socket cleanup.');
}finally{await browser.close()}
