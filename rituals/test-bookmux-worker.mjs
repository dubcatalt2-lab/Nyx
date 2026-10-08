import assert from 'node:assert/strict';import express from 'express';import {readFile} from 'node:fs/promises';import {chromium} from 'playwright';import {proxyAssetNames} from './build-intercession-assets.mjs';
const modules=JSON.parse(await readFile('dist/public-modules.json','utf8')).aliases;
const app=express();app.get('/',(_,res)=>res.send('<!doctype html><title>Transport test</title>'));app.use(express.static('dist'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const b=await chromium.launch({channel:'msedge',headless:true});try{const p=await b.newPage();await p.goto('http://127.0.0.1:'+server.address().port);
for(const legacy of [false,true]){
 const canonical=proxyAssetNames['/baremux/index.mjs'];const modulePath=legacy?canonical.replace('/bookmux/','/baremux/'):canonical;const workerPath=proxyAssetNames['/baremux/worker.js'].replace('/bookmux/',legacy?'/baremux/':'/bookmux/');
 const result=await p.evaluate(async({modulePath,workerPath,legacy})=>{const mod=await import(modulePath);const name=legacy?'BareMuxConnection':'BookmuxConnection';if(typeof mod[name]!=='function')throw Error('Missing '+name);const c=new mod[name](workerPath);return await Promise.race([c.getTransport(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Worker handshake timed out')),8000))]);},{modulePath:modules[modulePath]||modulePath,workerPath,legacy});assert.equal(typeof result,'string');console.log('Worker module and initialization passed, legacy='+legacy);
}
}finally{await b.close();server.close();}
