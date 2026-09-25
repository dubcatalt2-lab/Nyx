import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try{
 for(const vendors of [[],['goguardian'],['goguardian','lightspeed']]){
 const page=await browser.newPage();
 await page.addInitScript(()=>localStorage.setItem('tutsi.customize.seen','1'));
 await page.addInitScript(vendors=>{const original=window.fetch;window.fetch=(url,...args)=>String(url).startsWith('chrome-extension://')?(vendors.some(v=>String(url).includes(v==='goguardian'?'haldlgldplgnggkjaafhelgiaglafanh':'adkcpkpghahmbopkjchobieckeoaoeem'))?Promise.resolve(new Response('fixture')):Promise.reject(Error('unavailable'))):original(url,...args)},vendors);
 await page.goto('http://localhost:9091/tutsi#settings');
 await page.waitForFunction(()=>document.querySelector('#filter-detection-result')?.textContent.length>0);
 assert.equal(await page.inputValue('#blocker'),'auto');
 const text=await page.locator('#filter-detection-result').textContent();
 if(vendors.length)for(const v of vendors)assert(text.toLowerCase().includes(v));else assert(text.includes('Unknown'));
 assert.equal(await page.locator('#filter-check-details li').count(),17);
 if(!vendors.length){
   await page.evaluate(()=>dispatchEvent(new CustomEvent('tutsi:filter-detected',{detail:{vendors:[],observed:['securly'],checks:[],loaded:[]}})));
   assert((await page.locator('#filter-detection-result').textContent()).includes('Possible filter: Securly'));
   assert.equal(await page.inputValue('#blocker'),'auto');
 }
 assert.equal(await page.evaluate(async()=>{const {effectiveFilter}=await import('/apps/tutsi/filter-detection.mjs');return effectiveFilter('auto')}),vendors.length===1?vendors[0]:'');
 await page.selectOption('#blocker','securly');await page.locator('#detect-filter').click();assert.equal(await page.inputValue('#blocker'),'securly');
 await page.locator('#close-prevention').uncheck();await page.reload();await page.waitForFunction(()=>document.querySelector('#blocker')?.value==='securly');
 await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto('http://localhost:9091/tutsi#youtube');
 const f=page.frameLocator('#app-host iframe:not([hidden])');await f.locator('#tutsi-embedded-style').waitFor({state:'attached'});
 await f.locator('body').evaluate(()=>{const watch=document.querySelector('[data-watch-stage]');document.body.replaceChildren(watch);watch.style.width='100%';watch.style.display='block';document.querySelector('[data-watch-time]').textContent='1:37:41 / 2:36:12';});
 const time=f.locator('[data-watch-time]');
 const info=await time.evaluate(el=>{const style=getComputedStyle(el),r=el.getBoundingClientRect();return {font:style.fontFamily,size:style.fontSize,overflow:el.scrollWidth>el.clientWidth,width:r.width,height:r.height}});
 assert(info.font.includes('Arial'));assert.equal(info.size,'12px');assert(!info.overflow,JSON.stringify(info));assert.equal(info.height,38);
 const rect=await time.boundingBox();const toggle=await f.locator('[data-watch-toggle]').boundingBox();assert(Math.abs(rect.y+rect.height/2-toggle.y-toggle.height/2)<2);
 await page.screenshot({path:process.env.TEMP+'/tutsi-timestamp-mobile.png'});
 console.log('Filter Settings: unknown, single/multiple signals, manual override and persistence passed; mobile timestamps readable and aligned');
}finally{await browser.close()}
