import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,writeFile,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {resolve,join,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {obscureGameStrings} from './build-game-strings.mjs';
import {transformWorkspaceStrings,scrambleWorkspaceOutput} from './build-workspace-scramble.mjs';

const fixture=String.raw`"use strict";
const localStorage=new Map();
function save(value){localStorage.set("saved-progress",value)}
function load(){return localStorage.get("saved-progress")}
save("Round 7 — 🐱");
const keyed={"saved-progress":"lesson",get "title"(){return "Ready"}};
class Lesson { "title"="Lesson"; "read"(){return this.title} }
globalThis.result={value:load(),keyed:keyed["saved-progress"],title:keyed.title,lesson:new Lesson().read(),strict:(function(){return this===undefined})(),path:"/__NYX_STATIC_BASE__/assets/engine.js",url:"https://example.com/",empty:"",zero:"\u0000",escaped:"</script>",text:TAGprefix EXPR{"content"}TAG};`.replaceAll('TAG','`').replaceAll('EXPR','$');
const run=source=>{const context={};vm.runInNewContext(source,context);return JSON.stringify(context.result)};
const output=obscureGameStrings(fixture,'fixture');
const compact='function read(){return"Ready"}globalThis.result=read();';
assert.equal(run(obscureGameStrings(compact,'compact')),run(compact));
assert.notEqual(output,fixture);
assert.equal(run(output),run(fixture));
assert.equal(obscureGameStrings(output,'fixture'),output);
assert.equal(obscureGameStrings(fixture,'fixture'),output);
assert(!output.includes('Round 7'));
assert(!output.includes('"Ready"'));
assert(output.includes('/__NYX_STATIC_BASE__/assets/engine.js'));
assert(output.includes('https://example.com/'));
assert.equal(run(obscureGameStrings(transformWorkspaceStrings(fixture),'fixture')),run(fixture));
assert.equal(run(transformWorkspaceStrings(output,{decode:true})),run(fixture));
assert.equal(run(obscureGameStrings(output,'second-pass')),run(fixture));
const module=obscureGameStrings('import {readFile} from "node:fs";export {readFile};export const title="Ready";','module');
assert(module.includes('from "node:fs"'));
const repeated=obscureGameStrings('(()=>{if(globalThis.ready)return;globalThis.ready="Ready";globalThis.calls=(globalThis.calls||0)+1})()','reload-safe-helper');
const repeatedContext=vm.createContext({});
vm.runInContext(repeated,repeatedContext);vm.runInContext(repeated,repeatedContext);
assert.equal(repeatedContext.ready,'Ready');assert.equal(repeatedContext.calls,1);
console.log('PASS deterministic game string pools, saved values, Unicode, directives, keys, classes, templates, module imports and static rebasing.');

const helperSource=obscureGameStrings(transformWorkspaceStrings(await readFile('relics/games/game-cdn.js','utf8')),'assets/games/game-cdn.js',{standalone:['gameDeliveryUrl','repairGameResourcePath','gameSourceText','gameRoutedSource']});
const helpers=await import('data:text/javascript,'+encodeURIComponent(helperSource));
const isolated=vm.createContext({URL});
vm.runInContext('const gameSourceText='+helpers.gameSourceText.toString()+';const convert='+helpers.gameRoutedSource.toString()+';globalThis.result=convert("https://cdn.jsdelivr.net/gh/a/b@latest/file.js","https://app.test/gn-math-resource",gameSourceText)',isolated);
assert.equal(isolated.result,'https://app.test/gn-math-resource/https/raw.githack.com/a/b/HEAD/file.js');
console.log('PASS production string transform: serialized game helpers execute in an isolated realm without module decoder bindings');

const fixtureRoot=await mkdtemp(join(tmpdir(),'nyx-helper-build-'));
try{
 for(const path of ['assets/games/game-cdn.js','assets/games/opaque/hash/entry.js']){
  await mkdir(dirname(join(fixtureRoot,path)),{recursive:true});
  await writeFile(join(fixtureRoot,path),await readFile('relics/games/game-cdn.js','utf8'));
 }
 await scrambleWorkspaceOutput(fixtureRoot);
 for(const path of ['assets/games/game-cdn.js','assets/games/opaque/hash/entry.js']){
  const module=await import('data:text/javascript,'+encodeURIComponent(await readFile(join(fixtureRoot,path),'utf8')));
  const frame=vm.createContext({URL});
  vm.runInContext('const gameSourceText='+module.gameSourceText.toString()+';const convert='+module.gameRoutedSource.toString()+';globalThis.result=convert("https://cdn.jsdelivr.net/gh/a/b@latest/file.js","https://app.test/gn-math-resource",gameSourceText)',frame);
  assert.equal(frame.result,'https://app.test/gn-math-resource/https/raw.githack.com/a/b/HEAD/file.js');
 }
 console.log('PASS actual workspace build: canonical and scattered module copies retain standalone helper semantics');
}finally{
 assert.equal(dirname(resolve(fixtureRoot)),resolve(tmpdir()));assert(basename(fixtureRoot).startsWith('nyx-helper-build-'));
 await rm(fixtureRoot,{recursive:true,force:true});
}
