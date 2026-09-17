import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:9091/tutsi#settings');await page.locator('#close-prevention').uncheck();await page.selectOption('#blocker','');
 assert.equal(await page.locator('.header-actions a').getAttribute('href'),'#chat');
 assert.deepEqual(await page.locator('#dock-apps button').evaluateAll(nodes=>nodes.map(n=>n.dataset.route)),['ai','music','settings','youtube']);
 const key=combo=>page.keyboard.press(combo);
 await key('Alt+h');await page.waitForURL('**#home');
 await key('Alt+l');assert(await page.locator('#query').evaluate(el=>el===document.activeElement));
 await page.fill('#query','https://example.com');await page.locator('#search button').click();
 const site=()=>page.frameLocator('#browser-stage iframe:not([hidden])');await site().getByRole('heading',{name:'Example Domain'}).waitFor({timeout:30000});
 // Focus inside the website: the iframe bridge must still receive shortcuts.
 await site().getByRole('heading',{name:'Example Domain'}).click();await key('Alt+t');await page.waitForURL('**#home');
 assert.equal(await page.locator('#browser-tabs [role=tab]').count(),2);
 await page.fill('#query','https://example.com/?second=1');await page.locator('#search button').click();await site().getByRole('heading',{name:'Example Domain'}).waitFor({timeout:30000});
 await site().getByRole('heading',{name:'Example Domain'}).click();await key('Alt+w');assert.equal(await page.locator('#browser-tabs [role=tab]').count(),1);
 await key('Alt+Shift+t');await site().getByRole('heading',{name:'Example Domain'}).waitFor({timeout:30000});
 assert.equal(await page.locator('#browser-tabs [role=tab]').count(),2);assert.match(await page.locator('#address').inputValue(),/second=1/);
 await key('Alt+1');assert.equal(await page.locator('#browser-tabs [role=tab][aria-selected=true]').count(),1);assert(!/second=1/.test(await page.locator('#address').inputValue()));
 await key('Alt+l');await key('Alt+a');assert.equal(await page.locator('#address').evaluate(e=>e.selectionEnd-e.selectionStart),(await page.locator('#address').inputValue()).length);
 for(const app of ['movies','games','music','youtube','ai','chat']){
  await page.goto('http://localhost:9091/tutsi#'+app);const frame=page.locator('#app-host iframe:not([hidden])');await frame.waitFor();await frame.contentFrame().locator('html[data-tutsi-app]').waitFor();
  const box=await frame.boundingBox();assert(box.y>0&&box.y<90,app);assert.equal(box.height+box.y,900,app);assert.equal(await page.locator("#address").inputValue(),"tutsi://"+app);
  assert(!(await page.locator('.topbar').isVisible()));assert(!(await page.locator('#app-dock').isVisible()));
  await frame.contentFrame().locator('body').click({position:{x:5,y:5}});await key('Alt+w');await page.waitForURL('**#home');
  assert.equal(await page.locator('#browser-tabs [role=tab]').count(),2,'Closing an app preserves website tabs');
 }
 for(const route of ['settings','appearance','connection','tab-appearance','privacy','apps','terms']){
  await page.goto('http://localhost:9091/tutsi#'+route);await page.keyboard.press('Alt+w');await page.waitForURL('**#home');assert.equal(await page.locator('#browser-tabs [role=tab]').count(),2);
 }
 await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:9091/tutsi#games');
 const box=await page.locator('#app-host iframe:not([hidden])').boundingBox();assert.equal(box.height+box.y,844);assert(box.y>0&&box.y<90);
 assert.deepEqual(errors,[]);console.log('Alt shortcuts, focused iframe bridge, real tabs, close/restore, icon positions and full-window apps passed.');
}finally{await browser.close()}
