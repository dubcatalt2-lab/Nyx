import {sourceFile} from '../scripture/source-layout.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import {prepareGameDocument} from "../relics/games/game-document.js";
const workspace=await chromium.launch();
try {
 const page=await workspace.newPage({viewport:{width:1100,height:700}}),requests=[];
 await page.route('https://fixture.test/**',async route=>{
   const url=new URL(route.request().url());requests.push(url.pathname);
   if(url.pathname.startsWith('/assets/games/'))return route.fulfill({contentType:'text/javascript',body:await readFile(sourceFile('.'+url.pathname))});
   if(url.pathname.startsWith('/gn-math-resource/'))return route.fulfill({contentType:'text/javascript',body:''});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'});
 });
 await page.goto('https://fixture.test/');
 globalThis.location={origin:'https://fixture.test'};
 const html=prepareGameDocument('<html><head><script src="https://cdn.jsdelivr.net/gh/bubbls/youtube-playables@main/ytgame.js">// Load YT Game API code</script></head><body><div id="wrapper"><canvas width="1100" height="619"></canvas></div><script>function size(){const c=document.querySelector("canvas");c.style.width=c.parentElement.clientWidth+"px";c.style.height="619px";}addEventListener("resize",size);size();</script></body></html>','test.html');
 delete globalThis.location;
 await page.evaluate(html=>{const f=document.createElement('iframe');f.sandbox='allow-scripts';f.style='width:1100px;height:700px';f.srcdoc=html;document.body.append(f);},html);
 const frame=page.frames().find(f=>f.parentFrame());await frame.waitForSelector('canvas');await page.waitForTimeout(200);
 const rect=await frame.locator('canvas').boundingBox();assert(rect.width>=1000&&rect.height>=600,'Engine-sized canvas must remain visible');
 assert.equal(await frame.locator('canvas').evaluate(c=>getComputedStyle(c).position),'static','Canvas must stay in normal flow');
 // A collapsed ancestor is repaired without changing the intrinsic pixel size.
 await frame.evaluate(()=>{const d=document.createElement('div');d.style.height='0px';d.innerHTML='<canvas width="800" height="500"></canvas>';document.body.append(d);});
 await page.waitForTimeout(100);assert(await frame.locator('canvas').last().evaluate(c=>c.parentElement.getBoundingClientRect().height>0));
 const result=await frame.evaluate(async()=>{
   const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/gh/genizy/google-class@main/game.js';document.body.append(script);
   const sdk=document.createElement('script');sdk.src='https://sdk.poki.com/poki-sdk.js';const loaded=new Promise(r=>sdk.onload=()=>r(true));document.body.appendChild(sdk);
   const result=await Promise.race([loaded,new Promise(r=>setTimeout(()=>r(false),1000))]);
   return {src:script.src,sdkLoaded:result,sdkConnected:sdk.isConnected,sdkPresent:!!PokiSDK,origin:globalThis.origin};
 });
 assert(result.src.includes('/gn-math-resource/https/cdn.jsdelivr.net/gh/taskmaster773/google-class@main/game.js'));
 assert.equal(result.sdkLoaded,true,'Stubbed SDK must release the engine loader callback');
 assert.equal(result.sdkConnected,false);assert.equal(result.sdkPresent,true);assert.equal(result.origin,'null');
 assert(!requests.some(url=>url.includes('/sdk.poki.com/')),'Blocked SDK must not reach the network');
 assert(!requests.some(url=>url.endsWith('/ytgame.js')),'YouTube RPC script with inline comments must not overwrite the standalone adapter');
 assert.equal(await frame.evaluate(()=>ytgame.game.loadData()),'','Standalone playable save loading must resolve without a YouTube parent');
 assert.equal(await frame.evaluate(()=>typeof ytgame.SDK_VERSION),'string','Unity must receive a string when reading the standalone SDK version');
 console.log('PASS canvas layout, collapsed-wrapper recovery, dynamic CDN repair, SDK completion and opaque sandbox');
}finally{await workspace.close();}
