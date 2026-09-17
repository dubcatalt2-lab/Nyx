import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:9091/tutsi');
 const wizard=page.locator('#customize-dialog');await wizard.waitFor();
 const original=await page.evaluate(()=>localStorage.getItem('tutsi.settings.v1'));
 await page.selectOption('#customize-theme','latte');await page.selectOption('#customize-accent','peach');
 assert.equal(await page.evaluate(()=>localStorage.getItem('tutsi.settings.v1')),original);
 await page.locator('#customize-next').click();await page.selectOption('#customize-tabPreset','classlink');assert.equal(await page.title(),'ClassLink');assert.match(await page.locator('link[rel=icon]').getAttribute('href'),/classlink-logo/);await page.selectOption('#customize-tabPreset','custom');await page.fill('#customize-tabTitle','My notebook');assert.equal(await page.title(),'My notebook');
 await page.locator('#customize-next').click();await page.locator('#customize-closePrevention').uncheck();await page.locator('#customize-motion').check();
 await page.locator('#customize-back').click();assert.equal(await page.locator('#customize-tabTitle').inputValue(),'My notebook');await page.locator('#customize-next').click();
 await page.locator('#customize-next').click();await wizard.waitFor({state:'hidden'});assert.equal(await page.title(),'My notebook');
 await page.reload();assert(!(await wizard.isVisible()));assert.equal(await page.title(),'My notebook');
 await page.locator('#home-customize').click();await page.locator('#customize-dismiss').click();
 await page.goto('http://localhost:9091/tutsi#settings');await page.selectOption('#tab-preset','custom');await page.fill('#tab-title','Typing preview');assert.equal(await page.title(),'Typing preview');await page.selectOption('#tab-preset','drive');await page.locator('#apply-tab-preset').click();assert.equal(await page.title(),'My Drive - Google Drive');await page.locator('#open-customize').click();
 await page.selectOption('#customize-theme','mocha');await page.keyboard.press('Escape');assert.equal(await page.locator('html').getAttribute('data-theme'),'latte');
 await page.setViewportSize({width:390,height:844});await page.locator('#open-customize').click();await page.evaluate(()=>document.fonts.ready);
 assert(!(await wizard.evaluate(el=>el.scrollWidth>el.clientWidth)));
 await page.screenshot({path:process.env.TEMP+'/tutsi-customize-mobile.png'});
 await page.locator('#customize-dismiss').click();
 assert.deepEqual(errors,[]);
 const old=await browser.newPage();await old.addInitScript(()=>localStorage.setItem('tutsi.settings.v1',JSON.stringify({theme:'frappe',closePrevention:false,transport:'libcurl'})));await old.goto('http://localhost:9091/tutsi');assert(!(await old.locator('#customize-dialog').isVisible()));assert.equal(await old.locator('html').getAttribute('data-theme'),'frappe');
 const fresh=await browser.newPage();await fresh.goto('http://localhost:9091/tutsi');await fresh.locator('#customize-dismiss').click();await fresh.goto('http://localhost:9091/tutsi#settings');await fresh.locator('#close-prevention').uncheck();await fresh.reload();assert(!(await fresh.locator('#customize-dialog').isVisible()));
 console.log('Customization: first visit, draft isolation, back/save, persisted preferences, cancel, skip, existing users and mobile passed.');
}finally{await browser.close()}
