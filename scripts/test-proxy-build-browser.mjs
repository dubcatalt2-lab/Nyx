import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const base=process.env.NYX_TEST_BASE_URL||'http://127.0.0.1:8198';
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];
try{for(const [mode,transport] of [['scramjet','libcurlRaw'],['scramjet','epoxy'],['scramjet-v1','epoxy'],['ultraviolet','epoxy'],['ultraviolet','libcurlRaw']]){
 const context=await browser.newContext();const page=await context.newPage();const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/\/@r[0-9a-f]{24}!\./.test(r.url()))requests.push(r.url())});
 await page.addInitScript(({mode,transport,base})=>{localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');localStorage.setItem('nyx.releaseNotes.2026-09-14-nyx-1.0.3.seen','2026-09-14-nyx-1.0.3');localStorage.setItem('nyx.browserShellMode','true');localStorage.setItem('nyx.browserMode',mode);localStorage.setItem('nyx.transport',transport);localStorage.setItem('nyx.wispUrl',base.replace(/^http/,'ws')+'/wisp/');},{mode,transport,base});
 try{await page.goto(base+'/nyx');await page.waitForFunction(()=>typeof nyxLaunchGameFrame==='function');const launch=await page.evaluate(async()=>{const f=document.createElement('iframe');f.id='trial';document.body.append(f);const result=await nyxLaunchGameFrame(f,'https://example.com/');if(!result.managed)f.src=result.url;return result});assert.equal(launch.engine,'scramjet','Saved legacy selections must migrate to Scramjet v2');await page.waitForFunction(()=>document.querySelector('#trial')?.contentDocument?.body?.innerText?.includes('Example Domain'),{},{timeout:30000});assert(requests.length>0,'Opaque runtime assets must actually load');assert.equal(errors.length,0,errors.join('\n'));results.push({mode,transport,launch,opaqueRequests:requests.length,errors,passed:true});}catch(e){results.push({mode,transport,passed:false,error:e.message,opaqueRequests:requests,errors});}console.log(JSON.stringify(results.at(-1)));await context.close();
}}finally{writeFileSync('.codex-artifacts/proxy-scramble-results.json',JSON.stringify(results,null,2));await browser.close();}
if(results.some(r=>!r.passed))process.exitCode=1;
