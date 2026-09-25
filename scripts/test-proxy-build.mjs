import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import vm from 'node:vm';
import {rewriteFrontendReferences} from './build-frontend-assets.mjs';
import {proxyAssetNames as names,legacyProxyAssetNames,rewriteProxyReferences,scrambleProxyCode} from './build-proxy-assets.mjs';

const gameAliases={'/assets/games/games.js':'/assets/games/@test!.js'};
for(const suffix of ['on','.map','/extra','-backup','_backup','%20copy']) {
  const url='/assets/games/games.js'+suffix;
  assert.equal(rewriteFrontendReferences(JSON.stringify(url),'/assets/games/games.js',gameAliases),JSON.stringify(url));
}
for(const suffix of ['', '?v=1', '#entry']) {
  assert.equal(rewriteFrontendReferences(JSON.stringify('/assets/games/games.js'+suffix),'/assets/games/index.html',gameAliases),JSON.stringify('/assets/games/@test!.js'+suffix));
}
assert.equal(rewriteFrontendReferences('fetch("games.json");import("./games.js?v=1")','/assets/games/index.html',gameAliases),'fetch("games.json");import("./@test!.js?v=1")');

assert.equal(rewriteProxyReferences('importScripts("/uv/uv.sw.js","/uv.sw.js")','/uv.sw.js'),`importScripts("${names['/uv/uv.sw.js']}","${names['/uv.sw.js']}")`);
assert.equal(rewriteProxyReferences('import x from "./header-utils.mjs"','/assets/transports/libcurl-baremux.mjs'),`import x from "./${names['/assets/transports/header-utils.mjs'].split('/').at(-1)}"`);
const original='globalThis.publicAPI=function namedAPI(value){let localValue=value+1;return {result:localValue,name:namedAPI.name}};';
const a=await scrambleProxyCode(original),b=await scrambleProxyCode(original);
assert.match(a.code,/\u03bb[0-9a-f]{12}/);assert.notEqual(a.code,b.code);assert(!a.code.includes('localValue'));
const context={};vm.runInNewContext(a.code,context);assert.equal(context.publicAPI(4).result,5);assert.equal(context.publicAPI(4).name,'namedAPI');
const privateResult=await scrambleProxyCode('globalThis.C=class { #value=4; #read(){return this.#value;} get(){return this.#read();} };');const privateContext={};vm.runInNewContext(privateResult.code,privateContext);assert.equal(new privateContext.C().get(),4);
for(const [original,alias] of Object.entries(names)){
  assert.match(alias,/\/@r[0-9a-f]{24}!\.(js|mjs|wasm)$/);
  await access('dist'+legacyProxyAssetNames[original]);await access('dist'+alias);await access('dist'+original);
  if(original.endsWith('.wasm'))assert.deepEqual(await readFile('dist'+original),await readFile('dist'+alias));
  else assert(!(await readFile('dist'+alias,'utf8')).includes('sourceMappingURL'));
}
console.log('PASS opaque aliases, overlapping worker paths, relative imports, randomized locals, public names, WASM identity and compatibility files.');
