import assert from 'node:assert/strict';
import vm from 'node:vm';
import {obscureGameStrings} from './build-game-strings.mjs';
import {transformWorkspaceStrings} from './build-workspace-scramble.mjs';

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
console.log('PASS deterministic game string pools, saved values, Unicode, directives, keys, classes, templates, module imports and static rebasing.');
