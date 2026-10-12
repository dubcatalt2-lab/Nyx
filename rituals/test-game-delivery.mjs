import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {sourceFile} from '../scripture/source-layout.mjs';
import {gameDeliveryUrl} from '../relics/games/game-cdn.js';

assert.equal(gameDeliveryUrl('https://cdn.jsdelivr.net/npm/@scope/pkg@1.2/a.js?x=1').href,'https://unpkg.com/@scope/pkg@1.2/a.js?x=1');
assert.equal(gameDeliveryUrl('https://fastly.jsdelivr.net/gh/owner/repo@abc/assets/a.wasm').href,'https://raw.githack.com/owner/repo/abc/assets/a.wasm');
assert.equal(gameDeliveryUrl('https://cdn.jsdelivr.net/gh/owner/repo/a.js').pathname,'/owner/repo/HEAD/a.js');
assert.throws(()=>gameDeliveryUrl('https://cdn.jsdelivr.net/combine/a,b'));

const browser=await chromium.launch({...(process.platform==='win32'?{channel:'chrome'}:{})});
const requests=[];
try {
 const page=await browser.newPage();
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url()); requests.push(url.href);
  assert(!/(^|\.)jsdelivr\.net$/.test(url.hostname),'Browser must never contact the retired game CDN');
  if(url.hostname!=='fixture.test')return route.fulfill({status:404,body:'Unexpected origin'});
  if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<iframe id="game"></iframe><script type="module" src="/fixture.js"></script>'});
  if(url.pathname==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:`
   import {prepareGameDocument} from '/assets/games/game-document.js';
   document.querySelector('iframe').srcdoc=prepareGameDocument(${JSON.stringify('<html><head><base href="https://cdn.jsdelivr.net/gh/owner/repo@abc/"><script src="engine.js"></script></head><body><button id="play">Play</button><script>document.querySelector("button").onclick=async()=>{const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/library@1/plugin.js";document.head.append(script);const result=await fetch("https://cdn.jsdelivr.net/gh/owner/repo@abc/config.json");document.body.dataset.result=(await result.json()).ok;};</script></body></html>')},'fixture.html');
  `});
  if(url.pathname.startsWith('/gn-math-resource/')){
   assert(!url.pathname.includes('jsdelivr'));
   if(url.pathname.endsWith('.json'))return route.fulfill({json:{ok:'loaded'}});
   return route.fulfill({contentType:'text/javascript',body:'window.loadedScripts=(window.loadedScripts||0)+1;'});
  }
  try{return route.fulfill({contentType:'text/javascript',body:await readFile(sourceFile(url.pathname.slice(1)))});}
  catch{return route.fulfill({contentType:'text/javascript',body:''});}
 });
 await page.goto('https://fixture.test/');
 const frame=page.frameLocator('#game');await frame.locator('#play').click();
 await frame.locator('body[data-result="loaded"]').waitFor();
 await frame.locator('body').evaluate(()=>new Promise(resolve=>{const poll=()=>window.loadedScripts===2?resolve():setTimeout(poll,10);poll();}));
 assert(requests.some(x=>x.includes('/raw.githack.com/owner/repo/abc/engine.js')));
 assert(requests.some(x=>x.includes('/unpkg.com/library@1/plugin.js')));
 console.log('PASS game delivery: pinned repository paths, scoped npm packages, static scripts, dynamic scripts and fetch; zero browser requests to jsDelivr');
}finally{await browser.close();}
