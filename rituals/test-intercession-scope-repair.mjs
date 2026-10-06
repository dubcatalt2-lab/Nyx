import {sourceFile} from '../scripture/source-layout.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(sourceFile(new URL('../script.js',import.meta.url)),'utf8');
const start=source.indexOf('async function unregisterProxyScope('),end=source.indexOf('async function repairScramjetStorage(',start);
assert(start>=0&&end>start);
let scope='https://example.org/export/',removed=0;
const unregister=vm.runInNewContext('('+source.slice(start,end).trim()+')',{
  URL,location:{href:'https://example.org/export/index.html'},
  navigator:{serviceWorker:{getRegistration:async()=>({scope,unregister:async()=>{removed++;}})}}
});
await unregister('/export/~/sj/');assert.equal(removed,0,'Preserve parent static hosting worker');
scope='https://example.org/export/~/sj/';await unregister('/export/~/sj/');assert.equal(removed,1,'Remove only the requested proxy scope');
console.log('PASS proxy repair preserves an ancestor hosting worker and removes the exact proxy registration');
