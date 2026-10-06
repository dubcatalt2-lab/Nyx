import {sourceFile} from '../scripture/source-layout.mjs';
﻿import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
const source=readFileSync(sourceFile('script.js'),'utf8');
const names=new Set(['normalizeBrowserModeName','installScramjetV1','fallbackProxyEngine']);
const functions=[];
function visit(node){
 if(!node||typeof node!=='object')return;
 if(node.type==='FunctionDeclaration'&&names.has(node.id?.name))functions.push(source.slice(node.start,node.end));
 for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
}
visit(parse(source,{ecmaVersion:'latest'}));
let configured='auto';const calls=[];
const api=vm.runInNewContext(functions.join('\n')+';({normalizeBrowserModeName,installScramjetV1,fallbackProxyEngine})',{
 atob,
 store:{text:()=>configured},DEFAULT_BROWSER_MODE:'scramjet',
 loadScramjetTab:()=>calls.push('scramjet'),loadTab:()=>calls.push('iframe'),
 loadSelectedSearchFallback:()=>{calls.push('failure');return true;}
});
for(const mode of ['scramjet-v1','sjv1','scram-v1'])assert.equal(api.normalizeBrowserModeName(mode),'scramjet');
for(const mode of ['ultraviolet','uv','ultra','"ultraviolet"','stemconnect','stem-connect'])assert.equal(api.normalizeBrowserModeName(mode),'scramjet');
for(const mode of ['auto','iframe','scramjet'])assert.equal(api.normalizeBrowserModeName(mode),mode);
assert.equal(await api.installScramjetV1(),false);
for(configured of ['auto','scramjet','ultraviolet','scramjet-v1']){
 calls.length=0;api.fallbackProxyEngine({},'https://example.com/','scramjet');assert.deepEqual(calls,['failure']);
 calls.length=0;api.fallbackProxyEngine({},'https://example.com/','ultraviolet');assert.deepEqual(calls,['scramjet']);
}
for(const text of [source,readFileSync(sourceFile('index.html'),'utf8')]){
 assert.doesNotMatch(text,/<option value="ultraviolet"[^>]*>U1TR4V10L\$T<\/option>/);
 assert.doesNotMatch(text,/<option value="scramjet-v1"/);
 assert.doesNotMatch(text,/<option value="iframe"/);
}
assert.doesNotMatch(source,/option\.value='scramjet-v1'/);
console.log('Engine policy: Retired engine selections migrate to StudyJet, StudyJet remains default, retired v1 stays disabled, bounded fallback and selectors passed.');
