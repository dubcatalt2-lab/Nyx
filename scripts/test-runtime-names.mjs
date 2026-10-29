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
assert.equal(renameRuntimeText('ScramjetController ScramjetClient libcurlClient LibcurlTransport'),'R94c6a12Controller R94c6a12Client r7d902aClient R7d902aTransport');
assert.equal(rewriteRuntimeNames('/scramjet/ /~sj/ /~/sj/ /~/sj-v1/'),'/r94c6a12/ /~study/ /p8d31e6/ /~/study-v1/');
for(const pattern of [String.raw`/^\/~\/sj\/[^/]+\/[^/]+\/([^?#]*)/`,String.raw`/^\/~\/(?:sj|tm)\/[^/]+\/[^/]+\/([^?#]*)/`]){
 const regex=Function('return '+rewriteRuntimeNames(pattern))();
 assert.equal(regex.exec('/p8d31e6/session/frame/https%3A%2F%2Ffixture.test%2Fconsent')?.[1],'https%3A%2F%2Ffixture.test%2Fconsent');
}
assert.equal(rewriteRuntimeNames('https://example.test/content/article'), 'https://example.test/content/article', 'Upstream content paths are not local navigation prefixes');
assert.equal(rewriteRuntimeNames('/*! Scramjet license */ const ScramjetClient=1;'),'/*! Scramjet license */ const R94c6a12Client=1;');
assert.equal(rewriteRuntimeNames('"bare-mux-worker" "wisp-v2" "WebSocket"'), '"ridgewood-stem-worker" "wisp-v2" "WebSocket"');
assert.equal(rewriteRuntimeNames('"nyx.scramjetStateVersion" "nyx-scramjet-state-20260814-private-tabs-v2"'), '"nyx.st7dyj3tStateVersion" "nyx-st7dyj3t-state-20260814-private-tabs-v2"', 'Runtime renaming does not reset persisted state');
assert.throws(()=>renameRuntimeWasm(Buffer.from('bad wasm')));
const linked=rewriteProxyReferences('import "../libcurl/index.mjs";','/controller/controller-external.mjs');
assert(linked.includes('../r7d902a/'));assert(!linked.includes('/libcurl/'));
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
