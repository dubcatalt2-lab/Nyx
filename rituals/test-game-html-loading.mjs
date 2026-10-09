import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {sourceFile} from '../scripture/source-layout.mjs';

const root=resolve(process.env.NYX_TEST_STATIC_ROOT||'.');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();
 const documents=[],errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://fixture.test/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/assets/ugs/T/test.html'){
   documents.push(route.request().resourceType());
   return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><script src="engine.js"></script></head><body><button id="score">Play game</button><output></output><script>const button=document.querySelector("button"),output=document.querySelector("output");output.textContent=localStorage.getItem("test-score")||"0";button.onclick=()=>{output.textContent=Number(output.textContent)+1;localStorage.setItem("test-score",output.textContent)}</script></body></html>'});
  }
  if(url.pathname==='/assets/ugs/T/engine.js')return route.fulfill({contentType:'text/javascript',body:'window.relativeAssetLoaded=true;'});
  if(url.pathname==='/assets/ugs/T/missing.html')return route.fulfill({status:404,body:'Not found'});
  if(url.pathname.startsWith('/api/'))return route.fulfill({json:{}});
  try{return route.fulfill({contentType:url.pathname.endsWith('.html')?'text/html':'text/javascript',body:await readFile(sourceFile(resolve(root,'.'+url.pathname)),'utf8')})}
  catch{return route.fulfill({status:404,body:'Not found'})}
 });
 await page.goto('https://fixture.test/assets/ugs/play.html?game=T/test.html');
 const frame=page.frameLocator('#game');
 await frame.locator('#score').click();
 assert.equal(await frame.locator('output').textContent(),'1');
 assert.equal(await frame.locator('body').evaluate(()=>window.relativeAssetLoaded),true);
 assert.equal(await frame.locator('body').evaluate(()=>location.href),'about:srcdoc');
 assert.equal(await frame.locator('#score').textContent(),'Play game');
 assert.deepEqual(documents,['fetch']);
 await page.reload();
 await frame.locator('output').waitFor();
 assert.equal(await frame.locator('output').textContent(),'1');
 assert.deepEqual(documents,['fetch','fetch']);
 await page.goto('https://fixture.test/assets/ugs/play.html?game=T/missing.html');
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('HTTP 404'));
 assert.equal(await page.locator('#game').getAttribute('srcdoc'),null);
 assert.deepEqual(errors,[]);
 console.log('PASS selected HTML fetched once and inserted, relative JS, game content unchanged, saved progress/reload, and HTTP error handling.');
}finally{await browser.close()}
