import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPairSync,createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {chromium} from 'playwright';
import {detectFilters,filterSignatures} from '../apps/tutsi/filter-detection.mjs';
const artifacts=new URL('../.codex-artifacts/filter-comparison/',import.meta.url);
const source=stripTypeScriptTypes(await readFile(new URL('probe.ts',artifacts),'utf8'));
const upstream=source.replace(/export /g,'');
const detector=await readFile(new URL('detectordetector.js',artifacts),'utf8');
const root=await mkdtemp(join(tmpdir(),'tutsi-filter-test-'));
const ext=join(root,'extension');await mkdir(ext);
const publicKey=generateKeyPairSync('rsa',{modulusLength:2048}).publicKey.export({type:'spki',format:'der'});
const id=[...createHash('sha256').update(publicKey).digest().subarray(0,16)].map(b=>String.fromCharCode(97+(b>>4),97+(b&15))).join('');
await writeFile(join(ext,'manifest.json'),JSON.stringify({manifest_version:3,name:'Tutsi detection test fixture',version:'1.0',key:publicKey.toString('base64'),web_accessible_resources:[{resources:['signal.txt'],matches:['<all_urls>']}]}));
await writeFile(join(ext,'signal.txt'),'fixture');
const report={};
for(const installed of [false,true]){
 const context=await chromium.launchPersistentContext(join(root,installed?'present':'absent'),{channel:'chromium',headless:true,args:installed?[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]:[]});
 try{
 const page=await context.newPage();await page.goto('http://localhost:9091/tutsi#settings');
 const outcome=await page.evaluate(async({upstream,id})=>{const probe=new Function(upstream+';return probeFetch')();return probe(id,'signal.txt',{timeoutMs:700})},{upstream,id});
 assert.equal(outcome.fired,installed);
 const integrated=await page.evaluate(async({id})=>{const {detectFilters}=await import('/apps/tutsi/filter-detection.mjs');return detectFilters({signatures:[{id,path:'signal.txt',vendor:'fixture'}]})},{id});
 assert.deepEqual(integrated,installed?['fixture']:[]);
 report[installed?'extensionPresent':'extensionAbsent']={upstream:outcome,integrated};
 if(!installed){
   await page.setContent('<h1>rammerhead</h1><div class="chrome-tabs"></div><div class="browser-tab-content"></div>');
   const contentResult=await page.evaluate(code=>new Function(code+';return {securly:!!securlyFindProxy(document,securlyProxyData),goguardian:!!goGuardianFindProxy()}')(),detector);
   assert.deepEqual(contentResult,{securly:true,goguardian:true});report.contentScannerWithoutExtensions=contentResult;
 }
 }finally{await context.close()}
}
const signature={id,path:'signal.txt',vendor:'fixture'};
assert.deepEqual(await detectFilters({signatures:[signature],fetcher:async()=>{throw new Error('hidden')}}),[]);
assert.deepEqual(await detectFilters({signatures:[signature],fetcher:()=>new Promise(()=>{}),timeoutMs:15}),[]);
assert.deepEqual(await detectFilters({signatures:[signature,signature],fetcher:async()=>({ok:true})}),['fixture']);
await writeFile(new URL('results.json',artifacts),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

assert.equal(new Set(filterSignatures.map(s=>s.vendor)).size,17);
assert.equal(filterSignatures.length,20);
for(const signature of filterSignatures){
 const expected=`chrome-extension://${signature.id}/${signature.path}`;
 assert.deepEqual(await detectFilters({fetcher:async url=>({ok:url===expected})}),[signature.vendor]);
}
assert.deepEqual(await detectFilters({fetcher:async()=>{throw Error('no extensions')}}),[]);
console.log('All 20 signatures map to the correct one of 17 families; absent/hidden stays Unknown');
