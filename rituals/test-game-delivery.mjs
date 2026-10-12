import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {build} from 'esbuild';
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
  if(url.pathname==='/packed-fixture.js')return route.fulfill({contentType:'text/javascript',body:`
   import {prepareGameDocument} from '/assets/games/game-document.js';
   const contents='<script src="https://cdn.jsdelivr.net/gh/owner/repo@abc/engine.js"><'+ '/script><button id="packed">Ready</button>';
   const packed='<script>document.write(atob("'+btoa(contents)+'"))<'+ '/script>';
   document.querySelector('iframe').srcdoc=prepareGameDocument(packed,'packed.html');
  `});
 if(url.pathname.startsWith('/gn-math-resource/')){
   assert(!url.pathname.includes('jsdelivr'));
   if(url.pathname.endsWith('.json'))return route.fulfill({json:{ok:'loaded'}});
   return route.fulfill({contentType:'text/javascript',body:'window.loadedScripts=(window.loadedScripts||0)+1;'});
  }
  try{return route.fulfill({contentType:'text/javascript',body:await readFile(process.env.NYX_TEST_STATIC_ROOT?join(process.env.NYX_TEST_STATIC_ROOT,url.pathname.slice(1)):sourceFile(url.pathname.slice(1)))});}
  catch{return route.fulfill({contentType:'text/javascript',body:''});}
 });
 await page.goto('https://fixture.test/');
 const frame=page.frameLocator('#game');await frame.locator('#play').click();
 await frame.locator('body[data-result="loaded"]').waitFor();
 await frame.locator('body').evaluate(()=>new Promise(resolve=>{const poll=()=>window.loadedScripts===2?resolve():setTimeout(poll,10);poll();}));
 assert(requests.some(x=>x.includes('/raw.githack.com/owner/repo/abc/engine.js')));
 assert(requests.some(x=>x.includes('/unpkg.com/library@1/plugin.js')));
 await page.route('**/fixture.js',r=>r.fulfill({contentType:'text/javascript',body: 'import "/packed-fixture.js";'}));
 await page.reload();await page.frameLocator('#game').locator('#packed').waitFor();
 assert.equal(await page.frameLocator('#game').locator('body').evaluate(()=>window.loadedScripts),1);
 const compact=await build({entryPoints:['relics/games/game-document.js'],bundle:true,minify:true,format:'esm',write:false});
 await page.route('**/assets/games/game-document.js',r=>r.fulfill({contentType:'text/javascript',body:compact.outputFiles[0].text}));
 await page.reload();await page.frameLocator('#game').locator('#packed').waitFor();
 assert.equal(await page.frameLocator('#game').locator('body').evaluate(()=>window.loadedScripts),1);
 console.log('PASS minified game preparation: generated markup retains serialized helper bindings');
 console.log('PASS generated game document: bootstrap precedes packed scripts; document.write resources use the replacement source');
 console.log('PASS game delivery: pinned repository paths, scoped npm packages, static scripts, dynamic scripts and fetch; zero browser requests to jsDelivr');
}finally{await browser.close();}
