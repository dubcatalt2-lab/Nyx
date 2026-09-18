import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import {installGameAdProtection} from '../apps/tutsi/game-ad-runtime.mjs';
import {isAdUrl} from '../apps/tutsi/protections.mjs';
const original=(await readFile(new URL('../assets/games/game-ad-protection.js',import.meta.url),'utf8')).trim();
assert.equal(installGameAdProtection.toString().slice(installGameAdProtection.toString().indexOf('{')+1,-1).replace(/\r/g,'').trim(),original.slice('(() => {'.length,-'})();'.length).replace(/\r/g,'').trim());
assert(isAdUrl('https://cdn.playwire.com/sdk.js'));
assert(isAdUrl('https://example.com/poki-sdk.js'));
assert(!isAdUrl('https://playwire.com.example.org/game.js'));
assert(!isAdUrl('https://example.org/game.js?next=doubleclick.net'));
const browser=await chromium.launch();
try {
 const page=await browser.newPage();
 await page.route('**/fixture-ad/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body><canvas id="game"></canvas></body>'}));
 await page.goto('http://localhost:9091/fixture-ad/host');
 const result=await page.evaluate(async()=>{
   const {installGameProtectionHost}=await import('/apps/tutsi/protections.mjs');
   const policy={adBlock:true,popupBlock:true,downloadBlock:true};
   const app=document.createElement('iframe');document.body.append(app);
   installGameProtectionHost(()=>policy,()=>app);
   const game=app.contentDocument.createElement('iframe');app.contentDocument.body.append(game);
   window.nyxInstallGameAdProtection(game);
   const win=game.contentWindow,doc=game.contentDocument;
   const script=doc.createElement('script');script.src='https://cdn.playwire.com/sdk.js';doc.body.appendChild(script);
   const status=(await win.fetch('https://cdn.r9x.in/ad.js')).status;
   const nested=doc.createElement('iframe');doc.body.append(nested);
   await new Promise(r=>setTimeout(r,150));
   const guarded=!!nested.contentWindow.__nyxGameAdProtection;
   const popup=win.open('about:blank');
   policy.adBlock=false;policy.popupBlock=false;policy.downloadBlock=false;
   const off=app.contentDocument.createElement('iframe');app.contentDocument.body.append(off);
   window.nyxInstallGameAdProtection(off);
   return {status,scriptConnected:script.isConnected,guarded,popup:popup===null,sdk:!!win.PokiSDK,off:!!off.contentWindow.__nyxGameAdProtection};
 });
 assert.deepEqual(result,{status:204,scriptConnected:false,guarded:true,popup:true,sdk:true,off:false});
 console.log('PASS: shared Nyx rules, domain boundaries, game hook, nested frames, SDKs, popup protection and disabled policy');
} finally {await browser.close()}

