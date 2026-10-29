import assert from 'node:assert/strict';
import express from 'express';import {chromium} from 'playwright';import {readFile} from 'node:fs/promises';import {resolve,join} from 'node:path';
const staticRoot=resolve(process.env.NYX_TEST_STATIC_ROOT||'.');
const source=await readFile('server.js','utf8');const declaration=source.match(/function serveBlooketWorkspace\(_req,\s*res\)\s*\{[\s\S]*?\n\}/)?.[0];
assert(declaration,'Direct route handler must exist');
const handler=Function('staticRoot','join',declaration+'; return serveBlooketWorkspace;')(staticRoot,join);
const app=express();app.get(['/blooket','/blooket/','/blooket/index.html'],handler);app.use(express.static(staticRoot));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();try{
 const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const path of ['/blooket','/blooket/','/blooket/index.html','/apps/blooket/']){
 await page.goto(base+path);await page.getByRole('status',{name:'27 tools',exact:true}).waitFor();
 await page.getByRole('button',{name:'Copy page link',exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),base+'/blooket');
 await page.getByRole('button',{name:'Copy connector code',exact:true}).click();const code=await page.evaluate(()=>navigator.clipboard.readText());assert(code.startsWith('javascript:'));assert(code.includes('blooket'));
 }
 assert.deepEqual(errors,[]);console.log('PASS direct Blooket route aliases, legacy page, separate page-link and connector clipboard values.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
