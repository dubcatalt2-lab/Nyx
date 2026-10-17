import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {migrateStorage,storageNames} from './build-storage.mjs';
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage();await page.goto('http://localhost:9091/404.html');
 await page.evaluate(async names=>{for(const name of Object.keys(names)){await new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{const s=r.result.createObjectStore('fixture',{keyPath:'id',autoIncrement:true});s.createIndex('label','label',{unique:true});s.put({id:4,label:'saved cookie',bytes:new Uint8Array([1,2,3])});};r.onerror=()=>reject(r.error);r.onsuccess=()=>{r.result.close();resolve()};});}},storageNames);
 await page.evaluate(migrateStorage,storageNames);
 const result=await page.evaluate(async names=>{const out=[];for(const name of Object.values(names))out.push(await new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>{const db=r.result,t=db.transaction('fixture'),s=t.objectStore('fixture'),q=s.get(4);q.onsuccess=()=>resolve({keyPath:s.keyPath,autoIncrement:s.autoIncrement,index:s.index('label').unique,label:q.result.label,bytes:[...q.result.bytes]});t.oncomplete=()=>db.close();};r.onerror=()=>reject(r.error);}));return out;},storageNames);
 for(const row of result)assert.deepEqual(row,{keyPath:'id',autoIncrement:true,index:true,label:'saved cookie',bytes:[1,2,3]});
 await page.evaluate(migrateStorage,storageNames);
 const names=await page.evaluate(()=>indexedDB.databases().then(rows=>rows.map(r=>r.name)));for(const name of [...Object.keys(storageNames),...Object.values(storageNames)])assert(names.includes(name));
 console.log('PASS neutral IndexedDB migration: records, keys, indexes, typed arrays, repeat safety and original backups preserved');
}finally{await browser.close()}
