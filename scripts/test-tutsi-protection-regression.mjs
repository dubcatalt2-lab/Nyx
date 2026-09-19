import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from 'acorn';
import vm from 'node:vm';
import {browserAdSource} from '../apps/tutsi/browser-ad-runtime.mjs';
import {chromium} from 'playwright';
import {protectionSource,installGameProtectionHost,installPageProtection,protectionSandbox} from '../apps/tutsi/protections.mjs';
const source=readFileSync('script.js','utf8'),wanted=new Set(['browserAdResourceSignature','browserAdElementSelector','browserAdBlockRuntimeSource']),declarations=[];
function visit(n){if(!n||typeof n!=='object')return;if(n.type==='VariableDeclarator'&&wanted.has(n.id?.name))declarations.push('const '+source.slice(n.start,n.end)+';');for(const v of Object.values(n))if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v)}
visit(parse(source,{ecmaVersion:'latest'}));
assert.equal(browserAdSource,vm.runInNewContext(declarations.join('\n')+'browserAdBlockRuntimeSource;').replace('const value=localStorage.getItem("nyx.popupProtection");','const value=JSON.stringify(window.__tutsiProtection?.adBlock ?? true);'));
const browser=await chromium.launch();
try{
 const page=await browser.newPage();
 await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body></body></html>'}));
 await page.goto('https://fixture.test/');
 await page.evaluate(()=>{window.openCalls=0;window.open=()=>{window.openCalls++};});
 await page.addScriptTag({content:protectionSource({})});
 await page.evaluate(()=>window.open('https://popup.test'));assert.equal(await page.evaluate(()=>window.openCalls),0);
 // Engine scripts may replace early hooks; the post-load guard must restore them.
 await page.evaluate(()=>window.open=()=>{window.openCalls++});
 await page.addScriptTag({content:protectionSource({})});
 await page.evaluate(()=>window.open('https://popup.test'));assert.equal(await page.evaluate(()=>window.openCalls),0);
 await page.addScriptTag({content:protectionSource({popupBlock:false})});
 await page.evaluate(()=>window.open('https://popup.test'));assert.equal(await page.evaluate(()=>window.openCalls),1);
 await page.evaluate(()=>{window.checks=[];window.__tutsiCheckDownload=async(url,filename)=>{checks.push({url,filename});return {verdict:'blocked'}};document.body.innerHTML='<a id="file" download="report.zip" href="https://fixture.test/report.zip">Download</a>';});
 let downloads=0;page.on('download',()=>downloads++);await page.locator('#file').click();
 await page.waitForTimeout(100);assert.equal(downloads,0);assert.equal(await page.evaluate(()=>checks.length),1);
 // Nyx cosmetic rules apply to late-inserted advertisements too.
 await page.evaluate(()=>{const div=document.createElement('div');div.className='advertisement';div.textContent='Ad';document.body.append(div)});
 await page.waitForTimeout(100);assert.equal(await page.locator('.advertisement').count(),0);
 console.log('PASS restored popup hooks, live toggle, blocked archive reputation check, and shared Nyx dynamic ad rules.');
}finally{await browser.close()}
