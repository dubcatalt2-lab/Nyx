import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {websiteAddress,sourceWebsiteUrl} from '../apps/tutsi/navigation.mjs';
const origin='https://tutsi.example';
const target='https://open.spotify.com/track/abc?next=%2Fplaylist%3Fx%3D1&flow_ctx=a%2Bb#part';
assert.equal(sourceWebsiteUrl(origin+'/~/tm/session/frame/'+encodeURIComponent(target),origin),target);
assert.equal(sourceWebsiteUrl(origin+'/~/tm/session/frame/'+encodeURIComponent('https://example.com/?q=a%26b')+'#next',origin),'https://example.com/?q=a%26b#next');
assert.equal(sourceWebsiteUrl('https://other.example/~/tm/session/frame/'+encodeURIComponent(target),origin),'https://other.example/~/tm/session/frame/'+encodeURIComponent(target));
assert.equal(sourceWebsiteUrl(origin+'/~/tm/session/frame/%broken',origin),'');
assert.equal(websiteAddress('example.com:8443/a?x=1#two','google',origin),'https://example.com:8443/a?x=1#two');
assert.equal(websiteAddress('localhost:8080/a','google',origin),'http://localhost:8080/a');
assert.equal(websiteAddress('cupcake recipes & icing','google',origin),'https://www.google.com/search?q=cupcake%20recipes%20%26%20icing');
assert.throws(()=>websiteAddress('javascript:alert(1)','google',origin));
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.TUTSI_TEST_URL||'http://127.0.0.1:8198/apps/tutsi/index.html';
 await page.goto(base);await page.waitForTimeout(700);
 if(await page.locator('#customize-dialog').isVisible())await page.locator('#customize-dismiss').click();
 const site=()=>page.frameLocator('#browser-stage iframe:not([hidden])');
 const search=async value=>{await page.fill('#query',value);await page.locator('#search button').click();};
 await search('https://example.com/?first=1');await site().getByRole('heading',{name:'Example Domain'}).waitFor({timeout:30000});
 await site().locator('body').evaluate(el=>el.dataset.preserved='yes');
 await page.locator('#browser-home').click();assert.equal(await page.locator('#query').inputValue(),'');
 await search('https://example.com/?second=2#part');await site().getByRole('heading',{name:'Example Domain'}).waitFor({timeout:30000});
 assert.equal(await page.locator('#browser-tabs [role=tab]').count(),2);assert.match(await page.locator('#address').inputValue(),/second=2#part/);
 // Address-bar navigation reuses the current tab; home searches preserve it.
 await page.fill('#address','https://example.com/?third=3');await page.locator('#address').press('Enter');
 await page.waitForFunction(()=>document.querySelector('#browser-stage iframe:not([hidden])')?.contentWindow.location.href.includes('third%3D3'));
 assert.equal(await page.locator('#browser-tabs [role=tab]').count(),2);
 await page.locator('#browser-home').click();await page.locator('#browser-bar-toggle').hover();
 assert.equal(await page.locator('#browser-bar-toggle').getAttribute('aria-expanded'),'true');
 await page.locator('#browser-tabs [role=tab]').first().click();assert.equal(await site().locator('body').getAttribute('data-preserved'),'yes');
 // While a navigation is starting, switching tabs must not navigate the other one.
 await page.fill('#address','https://example.com/?pending=1');await page.locator('#address').press('Enter');
 await page.locator('#browser-tabs [role=tab]').nth(1).click();assert.match(await page.locator('#address').inputValue(),/third=3/);
 await page.locator('#browser-home').click();await search('javascript:alert(1)');assert.equal(await page.locator('#query').inputValue(),'javascript:alert(1)');
 assert.equal(await page.locator('#browser-tabs [role=tab]').count(),2);
 // Settings and apps expose the same bar by keyboard/touch without duplicate controls.
 await page.evaluate(()=>location.hash='settings');await page.waitForURL('**#settings');
 await page.locator('#browser-bar-toggle').focus();await page.keyboard.press('Enter');
 await page.locator('#browser-bar-panel #address').waitFor({state:'visible'});
 await page.keyboard.press('Escape');assert.equal(await page.locator('#browser-bar-toggle').getAttribute('aria-expanded'),'false');
 await page.setViewportSize({width:390,height:844});await page.locator('#browser-bar-toggle').click();
 const box=await page.locator('#browser-bar-panel').boundingBox();assert(box.x>=0&&box.x+box.width<=391);
 assert.equal(await page.locator('#address').count(),1);assert.deepEqual(errors,[]);
 console.log('PASS Tutsi navigation: URL fidelity, ports, input clearing, actual loads, tab isolation, hover/keyboard/touch bar and mobile layout.');
}finally{await browser.close();}
