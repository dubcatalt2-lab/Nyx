import {unpackPublishedDocument} from './build-frontend-assets.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {parse} from 'acorn';
const {pages}=JSON.parse(await readFile('dist/published-pages.json','utf8'));
assert(pages['ai.html'] && pages['assets/games/index.html'] && pages['apps/nyxify/index.html']);
for(const [path,entry] of Object.entries(pages)) {
 const shell=await readFile('dist/'+path,'utf8');
 assert(shell.includes(entry.loader),path+' loader linked');
 const code=await readFile('dist'+entry.loader,'utf8');
 let payload;
 function visit(node){
  if(!node || typeof node!=='object')return;
  if(node.type==='ArrayExpression' && node.elements.length && node.elements.every(n=>n?.type==='Literal'&&typeof n.value==='string')) {
   const candidate=Buffer.from(node.elements.map(n=>n.value).join(''),'base64');
   if(createHash('sha256').update(candidate).digest('hex')===entry.sha256)payload=candidate;
  }
  for(const value of Object.values(node)) if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
 }
 visit(parse(code,{ecmaVersion:'latest'}));
 assert(payload,path+' original UTF-8 document preserved');
 assert.equal(payload.length,entry.bytes);
 assert.equal(await unpackPublishedDocument('dist',entry),payload.toString('utf8'));
 let written='',opened=0,closed=0;
 const result=vm.runInNewContext(code,{TextDecoder,Uint8Array,atob,setTimeout,document:{readyState:'complete',open(){opened++;},write(value){written+=value;},close(){closed++;}}});
 await result;
 assert.equal(written,payload.toString('utf8').replace(/^\uFEFF/,''),path+' loader writes complete document');
 assert.equal(opened,1);assert.equal(closed,1);
 let ready,earlyWrites=0;
 const pending=vm.runInNewContext(code,{TextDecoder,Uint8Array,atob,setTimeout,window:{addEventListener(event,fn){assert.equal(event,'load');ready=fn;}},document:{readyState:'loading',open(){earlyWrites++;},write(){},close(){}}});
 await Promise.resolve();assert.equal(earlyWrites,0,path+' waits for shell parser');assert.equal(typeof ready,'function');ready();await pending;assert.equal(earlyWrites,1);
}
console.log(`PASS ${Object.keys(pages).length} encoded documents: linked loaders, exact payload hashes, UTF-8 round trip, and document reconstruction.`);
