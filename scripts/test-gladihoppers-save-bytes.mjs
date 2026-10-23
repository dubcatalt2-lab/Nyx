import vm from 'node:vm';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const source=await readFile('assets/studies/gladihoppers-save.js','utf8');
const control={addEventListener(){},disabled:false,textContent:''};const root={contents:{}};
const context={Uint8Array,atob,btoa,Map,Proxy,Date,Error,Number,String,Object,Array,Promise,setInterval:()=>0,clearInterval(){},setTimeout:()=>0,clearTimeout(){},addEventListener(){},parent:{postMessage(){}},document:{createElement:()=>({addEventListener(){},style:{},attachShadow:()=>({querySelector:()=>control})}),body:{append(){}},addEventListener(){}}};context.window=context;
vm.runInNewContext(source.replace('const timer=setInterval','window.snapshotForTest=snapshot;const timer=setInterval'),context);
context.NyxGladiSave.mount({FS_createPath(){},FS_createDataFile(){return {parent:root}}});
for(const contents of [new Int8Array([0,127,-128,-1]),new Uint8Array([0,127,128,255]),[0,127,-128,-1]]){
 root.contents['0123456789abcdef0123456789abcdef']={contents:{PlayerPrefs:{contents,usedBytes:4}}};
 assert.equal(context.snapshotForTest(),Buffer.from([0,127,128,255]).toString('base64'));
}
const all=Uint8Array.from({length:256},(_,i)=>i);
root.contents['0123456789abcdef0123456789abcdef']={contents:{PlayerPrefs:{contents:new Int8Array(all.buffer),usedBytes:256}}};
assert.equal(context.snapshotForTest(),Buffer.from(all).toString('base64'));
console.log('Signed and unsigned Unity save bytes preserve their exact binary values.');
