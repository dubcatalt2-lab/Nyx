import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {proxyAssetNames} from './build-proxy-assets.mjs';
const browser=await chromium.launch();
try {
 const page=await browser.newPage();
 await page.addInitScript(()=>localStorage.setItem('tutsi.customize.seen','1'));
 const path='/assets/transports/epoxy-scramjet.mjs';
 await page.route(url=>[path,proxyAssetNames[path]].includes(url.pathname),route=>route.fulfill({contentType:'text/javascript',body:`export default class {ready=false;calls=0;async init(){this.ready=true}async request(){if(++this.calls===1)throw Error('request timed out');return {status:200,statusText:'OK',headers:[['content-type','text/html']],body:new Response('<!doctype html><h1>Recovered first search</h1>').body}}connect(){return [()=>{},()=>{}]}}`}));
 await page.goto(process.env.TUTSI_TEST_URL||'http://localhost:9091/tutsi');
 await page.locator('#studyready-startup').waitFor({state:'detached',timeout:10000});
 await page.fill('#query','https://fixture.test/');await page.locator('#search button').click();
 await page.frameLocator('#browser-stage iframe:not([hidden])').getByRole('heading',{name:'Recovered first search'}).waitFor({timeout:45000});
 assert.equal(await page.locator('#browser-tabs [role=tab]').count(),1);
 console.log('PASS: actual first navigation recovers from transport timeout without refresh');
}finally{await browser.close()}
