import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const bundle=await readFile('dist/assets/vendor/game-storage.js','utf8');
const browser=await chromium.launch();
try{
 const page=await browser.newPage();
 await page.route('http://fixture.test/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));
 await page.goto('http://fixture.test/');
 const native=await page.evaluate(async bundle=>{
  const original=indexedDB; (0,eval)(bundle); return original===indexedDB;
 },bundle);
 assert(native,'Same-origin games must retain persistent native IndexedDB');
 const result=await page.evaluate(bundle=>new Promise(resolve=>{
  const frame=document.createElement('iframe'); frame.sandbox='allow-scripts';
  const listener=e=>{if(e.source===frame.contentWindow){removeEventListener('message',listener);resolve(e.data);}};
  addEventListener('message',listener);
  frame.srcdoc='<script>'+bundle+'<\/script><script>'+String.raw`
  const request=indexedDB.open('game',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('save');
  request.onerror=()=>parent.postMessage({error:String(request.error)},'*');
  request.onsuccess=()=>{
    const db=request.result,tx=db.transaction('save','readwrite');
    tx.objectStore('save').put({level:7},'progress');
    tx.oncomplete=()=>{
      const get=db.transaction('save').objectStore('save').get('progress');
      get.onsuccess=()=>{
        let isolated=false;try{void parent.document.body}catch{isolated=true;}
        parent.postMessage({origin:globalThis.origin,level:get.result.level,isolated},'*');
      };
    };
  };`+'<\/script>';
  document.body.append(frame);
 }),bundle);
 assert.deepEqual(result,{origin:'null',level:7,isolated:true});
 console.log('PASS opaque game storage transactions and parent isolation; native persistent storage unchanged');
}finally{await browser.close();}
