import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPairSync,createHash} from 'node:crypto';
import express from 'express';
import {chromium} from 'playwright';
import {inspectFilters} from '../apps/tutsi/filter-detection.mjs';

const id='ckecmkbnoanpgplccmnoikfmpcdladkc';
const doc={querySelectorAll:()=>[{tagName:'SCRIPT',getAttribute:()=>`chrome-extension://${id}/injected.js`}]};
const blocked=async()=>{throw Error('inaccessible')};
let report=await inspectFilters({doc,fetcher:blocked});
assert.deepEqual(report.vendors,[]);
assert.deepEqual(report.observed,['securly']);
assert(report.checks.every(check=>check.status==='unavailable'));
report=await inspectFilters({signatures:[{id,path:'signal.txt',vendor:'fixture'}],fetcher:()=>new Promise(()=>{}),timeoutMs:5,doc:null});
assert.equal(report.checks[0].status,'timeout');
assert.deepEqual(report.vendors,[]);
// Cancelling a response body must not hold a successful scan open indefinitely.
report=await Promise.race([inspectFilters({signatures:[{id,path:'signal.txt',vendor:'fixture'}],doc:null,fetcher:async()=>({ok:true,body:{cancel:()=>new Promise(()=>{})}})}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Scan hung')),1000))]);
assert.deepEqual(report.vendors,['fixture']);

const root=await mkdtemp(join(tmpdir(),'tutsi-passive-filter-'));
const ext=join(root,'extension');await mkdir(ext);
const key=generateKeyPairSync('rsa',{modulusLength:2048}).publicKey.export({type:'spki',format:'der'});
const fixtureId=[...createHash('sha256').update(key).digest().subarray(0,16)].map(b=>String.fromCharCode(97+(b>>4),97+(b&15))).join('');
await writeFile(join(ext,'manifest.json'),JSON.stringify({manifest_version:3,name:'Filter resource fixture',version:'1.0',key:key.toString('base64'),web_accessible_resources:[{resources:['visible.css'],matches:['<all_urls>']}]}));
await writeFile(join(ext,'visible.css'),'body { --filter-fixture: 1; }');
const moduleSource=await readFile(new URL('../apps/tutsi/filter-detection.mjs',import.meta.url),'utf8');
const app=express();app.get('/',(_,res)=>res.send('<!doctype html><title>Fixture</title><body>Filter test</body>'));
app.get('/detector.mjs',(_,res)=>res.type('application/javascript').send(moduleSource));
const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
let context;
try{
 context=await chromium.launchPersistentContext(join(root,'profile'),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]});
 const page=await context.newPage();await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.addStyleTag({url:`chrome-extension://${fixtureId}/visible.css`});
 const result=await page.evaluate(async id=>{
   const {inspectFilters}=await import('/detector.mjs');
   return inspectFilters({signatures:[{id,path:'obsolete.css',vendor:'fixture'}],fetcher:async()=>{throw Error('cannot re-fetch')}});
 },fixtureId);
 assert.deepEqual(result.vendors,['fixture']);assert.deepEqual(result.loaded,['fixture']);assert.deepEqual(result.observed,[]);
 await page.locator('link').evaluateAll(nodes=>nodes.forEach(node=>node.remove()));
 const absent=await page.evaluate(async id=>{
   const {inspectFilters}=await import('/detector.mjs');
   return inspectFilters({signatures:[{id,path:'obsolete.css',vendor:'fixture'}]});
 },fixtureId);
 assert.deepEqual(absent.vendors,[]);
 console.log('Real loaded-extension evidence, private resources, hints, timeout and cancellation passed.');
}finally{await context?.close();await new Promise(resolve=>server.close(resolve))}
