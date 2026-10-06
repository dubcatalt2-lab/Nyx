import {sourceFile} from '../scripture/source-layout.mjs';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import {resolve, posix} from 'node:path';
import express from 'express';
import {parse} from 'acorn';
import {publicFiles, moduleNames, rewritePublicModules} from './build-public-modules.mjs';
import {publicAssetBoundary, privateSourcePath} from '../scripture/public-assets.mjs';

const collision=moduleNames(['a/index.js','a/index.mjs','b/index.mjs']);
assert.match(collision['/a/index.mjs'],/index\.module-[a-f0-9]+\.js$/);
assert.equal(collision['/b/index.mjs'],'/b/index.js');
assert.throws(()=>moduleNames(['a/index.js','a/index.mjs',collision['/a/index.mjs'].slice(1)]),/collision/);
const references='import x from "./index.mjs"; import("./index.mjs?v=1"); new Worker(new URL("/b/index.mjs",import.meta.url),{type:"module"});';
const rewritten=rewritePublicModules(references,'/a/entry.js',collision);
assert(!rewritten.includes('.mjs'));
assert(rewritten.includes('?v=1'));
assert.equal(rewritePublicModules('"/b/index.mjs.map"','/entry.js',collision),'"/b/index.mjs.map"');
const root=resolve(process.env.NYX_BUILD_OUTPUT || 'dist'),files=await publicFiles(root);
assert(!files.some(file=>file.endsWith('.mjs')),'Build must not publish .mjs');
assert(!files.some(file=>privateSourcePath('/'+file)),'Build must exclude private paths');
const aliases=JSON.parse(await readFile(sourceFile(root+'/public-modules.json'),'utf8')).aliases;
assert(Object.keys(aliases).length>20);
for(const target of Object.values(aliases))await access(sourceFile(root+target));
let imports=0;
for(const file of files.filter(file=>file.endsWith('.js')&&!/^(?:assets\/(?:ugs|vendor)\/|apps\/jsdelivr-publisher\/static-package\/)/.test(file))){
 const source=await readFile(sourceFile(root+'/'+file),'utf8');
 const tree=parse(source,{ecmaVersion:'latest',sourceType:'module',allowReturnOutsideFunction:true});
 async function visit(node){
  if(!node||typeof node!=='object')return;
  if(['ImportDeclaration','ExportAllDeclaration','ExportNamedDeclaration','ImportExpression'].includes(node.type)&&typeof node.source?.value==='string'){
   const value=node.source.value;
   if(!/^(?:[a-z]+:|\/\/)/i.test(value)&&/^[./]/.test(value)){
    const pathname=value.split(/[?#]/)[0];
    assert(!pathname.endsWith('.mjs'),file+': unresolved module URL '+value);
    await access(sourceFile(root+posix.resolve('/',posix.dirname(file),pathname)));imports++;
   }
  }
  for(const value of Object.values(node)){if(Array.isArray(value)){for(const child of value)await visit(child);}else if(value&&typeof value==='object')await visit(value);}
 }
 await visit(tree);
}
const app=express();app.use(publicAssetBoundary(root));app.use(express.static(root,{dotfiles:'allow'}));app.use((_req,res)=>res.status(404).end());
const server=app.listen(0,'127.0.0.1');await new Promise(done=>server.once('listening',done));
const base='http://127.0.0.1:'+server.address().port;
try{
 for(const [legacy,target] of Object.entries(aliases)){
  const redirect=await fetch(base+legacy+'?v=1',{redirect:'manual'});
  assert.equal(redirect.status,307);assert.equal(redirect.headers.get('location'),target+'?v=1');
  assert.equal(redirect.headers.get('cache-control'),'no-store');
  const response=await fetch(base+target);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);await response.body.cancel();
 }
 for(const path of ['/shepherd.js','/fellowship-server.js','/rituals/build-vps.mjs','/mission/setup-ovh.sh','/ministry/audit-apps-cdp.mjs','/server.js','/lib/ai-media.mjs','/scripts/build-vps.mjs','/package.json','/.env','/%6cib/ai-media.mjs','/deploy/setup-ovh.sh','/ministries/domain-pages/pages.mjs','/unknown.mjs'])assert.equal((await fetch(base+path)).status,404,path);
 console.log(`PASS ${Object.keys(aliases).length} new/legacy module URLs and MIME, ${imports} resolved imports, collision handling, private-path rejection, no public .mjs files.`);
}finally{server.closeAllConnections();await new Promise(done=>server.close(done));}
