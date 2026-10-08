import {sourceFile} from '../scripture/source-layout.mjs';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {parse} from 'acorn';
import {runtimeNames,renameRuntimeText,rewriteRuntimeNames,renameRuntimeWasm} from './build-runtime-names.mjs';
import {proxyAssetNames,rewriteProxyReferences} from './build-intercession-assets.mjs';
for(const [before,after] of Object.entries(runtimeNames)) assert.equal(Buffer.byteLength(before),Buffer.byteLength(after));
assert.equal(renameRuntimeText('ScramjetController ScramjetClient libcurlClient LibcurlTransport EpoxyClient EpoxyTransport Epoxy_wbg_fetch'),'StudyJetController StudyJetClient textlibClient TextlibTransport AtlasClient AtlasTransport Atlas_wbg_fetch');
assert.equal(rewriteRuntimeNames('/scramjet/ /~sj/ /~/sj/'),'/studyjet/ /~study/ /~/study/');
for(const pattern of [String.raw`/^\/~\/sj\/[^/]+\/[^/]+\/([^?#]*)/`,String.raw`/^\/~\/(?:sj|tm)\/[^/]+\/[^/]+\/([^?#]*)/`]){
 const regex=Function('return '+rewriteRuntimeNames(pattern))();
 assert.equal(regex.exec('/~/study/session/frame/https%3A%2F%2Ffixture.test%2Fconsent')?.[1],'https%3A%2F%2Ffixture.test%2Fconsent');
}
assert.equal(rewriteRuntimeNames('/*! Scramjet license */ const ScramjetClient=1;'),'/*! Scramjet license */ const StudyJetClient=1;');
assert.equal(rewriteRuntimeNames('"bare-mux-worker" "wisp-v2" "WebSocket"'), '"ridgewood-stem-worker" "wisp-v2" "WebSocket"');
assert.equal(rewriteRuntimeNames('BareMuxConnection bare-mux-remote baremux'), 'BookmuxConnection book-mux-remote bookmux');
assert.throws(()=>renameRuntimeWasm(Buffer.from('bad wasm')));
const linked=rewriteProxyReferences('import "../epoxy/index.mjs";','/libcurl/index.mjs');
assert(linked.includes('../atlas/'));assert(!linked.includes('/epoxy/'));
const old=/baremux|bare-mux|scramjet|libcurl|epoxy|\/\~sj\/|\/\~\/sj\//i;
let binaries=0,modules=0;
const publicModules=JSON.parse(await readFile(sourceFile('dist/public-modules.json'),'utf8')).aliases;
for(const path of ['dist/scramjet-v1','dist/studyjet-v1','dist/scramjet-v1.sw.js','node_modules/@mercuryworkshop/scramjet-v1']) await assert.rejects(access(path));
assert(!Object.keys(proxyAssetNames).some(path=>/scramjet-v1/i.test(path)));
const publishedPath=value=>publicModules[value]||value;
for(const [original,path] of Object.entries(proxyAssetNames)){
 assert(!old.test(path),path);
 const bytes=await readFile(sourceFile('dist'+publishedPath(path)));
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
