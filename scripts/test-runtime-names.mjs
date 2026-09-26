import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parse} from 'acorn';
import {runtimeNames,renameRuntimeText,rewriteRuntimeNames,renameRuntimeWasm} from './build-runtime-names.mjs';
import {proxyAssetNames,rewriteProxyReferences} from './build-proxy-assets.mjs';
for(const [before,after] of Object.entries(runtimeNames)) assert.equal(Buffer.byteLength(before),Buffer.byteLength(after));
assert.equal(renameRuntimeText('ScramjetController ScramjetClient libcurlClient LibcurlTransport EpoxyClient EpoxyTransport Epoxy_wbg_fetch'),'StudyJetController StudyJetClient textlibClient TextlibTransport AtlasClient AtlasTransport Atlas_wbg_fetch');
assert.equal(rewriteRuntimeNames('/scramjet/ /~sj/ /~/sj/ /~/sj-v1/'),'/studyjet/ /~study/ /~/study/ /~/study-v1/');
assert.equal(rewriteRuntimeNames('/*! Scramjet license */ const ScramjetClient=1;'),'/*! Scramjet license */ const StudyJetClient=1;');
assert.throws(()=>renameRuntimeWasm(Buffer.from('bad wasm')));
const linked=rewriteProxyReferences('import "../epoxy/index.mjs";','/libcurl/index.mjs');
assert(linked.includes('../atlas/'));assert(!linked.includes('/epoxy/'));
const old=/scramjet|libcurl|epoxy|\/\~sj\/|\/\~\/sj\//i;
let binaries=0,modules=0;
for(const [original,path] of Object.entries(proxyAssetNames)){
 assert(!old.test(path),path);
 const bytes=await readFile('dist'+path);
 if(path.endsWith('.wasm')){assert(WebAssembly.validate(bytes),path);assert(!old.test(bytes.toString('latin1')),path);binaries++;continue;}
 const code=bytes.toString();try{parse(code,{ecmaVersion:'latest',sourceType:'script'});}catch{parse(code,{ecmaVersion:'latest',sourceType:'module'});}
 const withoutNotices=code.replace(/\/\*[\s\S]*?\*\//g,'');
 assert(!old.test(withoutNotices),original+' retained an old runtime name');
 for(const match of code.matchAll(/AGFzbQE[A-Za-z0-9+/]*={0,2}/g)){
  const wasm=Buffer.from(match[0],'base64');if(!WebAssembly.validate(wasm))continue;
  assert(!old.test(wasm.toString('latin1')),original+' embedded WASM retained an old name');binaries++;
 }
 modules++;
}
console.log('PASS educational runtime names: '+modules+' active scripts parse, '+binaries+' WASM binaries validate; paths, hooks, embedded imports and license notices checked');
