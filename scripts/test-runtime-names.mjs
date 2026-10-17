import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parse} from 'acorn';
import {runtimeHookNames,runtimeNames,renameRuntimeText,rewriteRuntimeNames,renameRuntimeWasm} from './build-runtime-names.mjs';
import {proxyAssetNames,rewriteProxyReferences} from './build-proxy-assets.mjs';
assert.equal(new Set(Object.values(runtimeHookNames)).size,Object.keys(runtimeHookNames).length);
for(const [before,after] of Object.entries(runtimeHookNames)){
 assert.equal(Buffer.byteLength(before),Buffer.byteLength(after));
 assert.equal(renameRuntimeText(before),after);
}
for(const [before,after] of Object.entries(runtimeNames)) assert.equal(Buffer.byteLength(before),Buffer.byteLength(after));
assert.equal(renameRuntimeText('ScramjetController ScramjetClient libcurlClient LibcurlTransport EpoxyClient EpoxyTransport Epoxy_wbg_fetch'),'StudyJetController StudyJetClient textlibClient TextlibTransport AtlasClient AtlasTransport Atlas_wbg_fetch');
assert.equal(rewriteRuntimeNames('/scramjet/ /~sj/ /~/sj/ /~/sj-v1/'),'/studyjet/ /~study/ /4otig/ /~/study-v1/');
for(const pattern of [String.raw`/^\/~\/sj\/[^/]+\/[^/]+\/([^?#]*)/`,String.raw`/^\/~\/(?:sj|tm)\/[^/]+\/[^/]+\/([^?#]*)/`]){
 const regex=Function('return '+rewriteRuntimeNames(pattern))();
 assert.equal(regex.exec('/4otig/session/frame/https%3A%2F%2Ffixture.test%2Fconsent')?.[1],'https%3A%2F%2Ffixture.test%2Fconsent');
}
assert.equal(rewriteRuntimeNames('https://example.test/content/article'), 'https://example.test/content/article', 'Upstream content paths are not local navigation prefixes');
assert.equal(rewriteRuntimeNames('/*! Scramjet license */ const ScramjetClient=1;'),'/*! Scramjet license */ const StudyJetClient=1;');
assert.equal(rewriteRuntimeNames('"bare-mux-worker" "wisp-v2" "WebSocket"'), '"ridgewood-stem-worker" "wisp-v2" "WebSocket"');
assert.throws(()=>renameRuntimeWasm(Buffer.from('bad wasm')));
const linked=rewriteProxyReferences('import "../epoxy/index.mjs";','/libcurl/index.mjs');
assert(linked.includes('../atlas/'));assert(!linked.includes('/epoxy/'));
const old=/__wbindgen_|__wbg_|setrealmfn|scramjet|libcurl|epoxy|\/\~sj\/|\/\~\/sj\//i;
let binaries=0,modules=0;
const testDist=process.env.NYX_TEST_DIST||'dist';
const publicModules=JSON.parse(await readFile(testDist+'/public-modules.json','utf8')).aliases;
const publishedPath=value=>publicModules[value]||value;
for(const [original,path] of Object.entries(proxyAssetNames)){
 assert(!old.test(path),path);
 const bytes=await readFile(testDist+publishedPath(path));
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
