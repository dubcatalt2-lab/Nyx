import assert from 'node:assert/strict';
import {readFile, access, readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {parse} from 'acorn';
import vm from 'node:vm';

const removed='@mercuryworkshop/bare-mux';
const manifest=JSON.parse(await readFile('package.json','utf8'));
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
assert.equal(manifest.dependencies[removed],undefined);
assert.ok(!Object.keys(lock.packages).some(path=>path.endsWith('/'+removed)));
await assert.rejects(access('node_modules/'+removed));
for(const path of ['barebooks/index.mjs','barebooks/worker.js','relics/transports/libcurl-communion.mjs'])await assert.rejects(access(path));
const fingerprints=['All clients returned an invalid MessagePort','bare-mux-worker','bare-mux-remote','BareMuxConnection','bare-mux: running'];
let files=0;
async function scan(root){
 for(const entry of await readdir(root,{withFileTypes:true})){
  const path=join(root,entry.name);
  if(entry.isDirectory())await scan(path);
  else if(/\.(?:js|mjs|cjs|html)$/.test(path)){
   const text=await readFile(path,'utf8');files++;
   for(const value of fingerprints)assert(!text.includes(value),path+' retains '+value);
  }
 }
}
await scan('dist');
const source=await readFile('gospel.js','utf8');
const tree=parse(source,{ecmaVersion:'latest',sourceType:'script'});
let functionSource;
function visit(node){
 if(!node||typeof node!=='object')return;
 if(node.type==='FunctionDeclaration'&&node.id?.name==='installRetiredRuntimeRecovery')functionSource=source.slice(node.start,node.end);
 for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
}
visit(tree);assert(functionSource);
let listener,offered=0,reloads=0,options;
const elements=new Map();
const element=selector=>{if(!elements.has(selector))elements.set(selector,{remove(){},focus(){}});return elements.get(selector);};
vm.runInNewContext(functionSource+';installRetiredRuntimeRecovery();',{
 window:{addEventListener:(_name,callback)=>listener=callback},
 location:{origin:'https://fixture.test',reload:()=>reloads++},
 shownyxPrompt:(_message,value)=>{offered++;options=value;return{querySelector:element};}
});
listener({origin:'https://elsewhere.test',data:{type:'getPort',port:{}}});assert.equal(offered,0);
listener({origin:'https://fixture.test',data:{type:'getPort',port:{}}});assert.equal(offered,1);assert.equal(reloads,0);
assert.equal(element('.nyx-prompt-ok').textContent,'Reload');assert.equal(element('.nyx-prompt-cancel').textContent,'Later');
listener({origin:'https://fixture.test',data:{type:'getPort',port:{}}});assert.equal(offered,1);
options.onOk();assert.equal(reloads,1);
console.log('PASS removed dependency absent from manifest, lockfile and installed tree; '+files+' release text files contain no removed runtime fingerprints; recovery waits for explicit Reload');
