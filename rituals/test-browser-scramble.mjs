import assert from 'node:assert/strict';
import vm from 'node:vm';
import {minify} from 'terser';
import {transformBrowserStrings,scrambleInlineScripts,opaqueIdentifiers} from './build-browser-scramble.mjs';

const fixture=String.raw`
"use strict";
function isolated(value){const label="Résumé 🐱\n";return label+value;}
const tag=(parts,...values)=>({raw:parts.raw[0],cooked:parts[0],values});
globalThis.result={
  message:isolated("study"),
  strict:(function(){return this===undefined})(),
  tagged:tag\`raw\\n\${"expression"}\`,
  template:\`line\\n\${"value"} and \u0065nd\`,
  "named-key":"quoted \"value\"",
  pattern:/study\/(?:a|b)/.test("study/a"),
  negative:1n,
  placeholder:"/__NYX_STATIC_BASE__/assets/example.js",
  source:isolated.toString()
};`.replaceAll('\\`','`').replaceAll('\\${','${');
const compiled=transformBrowserStrings(fixture);
assert.match(compiled,/"use strict"/);
assert(!compiled.includes('Résumé'));
assert(compiled.includes('/__NYX_STATIC_BASE__/'));
const evaluate=source=>{const context={};vm.runInNewContext(source,context);return context.result;};
const before=evaluate(fixture),after=evaluate(compiled);
const normalize=result=>JSON.stringify({...result,negative:String(result.negative),source:undefined});
assert.equal(normalize(after),normalize(before));
assert.equal(vm.runInNewContext('('+after.source+')')('worker'),vm.runInNewContext('('+before.source+')')('worker'));
assert.equal(normalize(evaluate(transformBrowserStrings(compiled,{decode:true}))),normalize(before));
assert.equal(transformBrowserStrings(compiled),compiled);
const rebased=compiled.replaceAll('/__NYX_STATIC_BASE__/','/gh/user/repo@main/nyx-static/');
assert.equal(evaluate(rebased).placeholder,'/gh/user/repo@main/nyx-static/assets/example.js');
const module='import {value as input} from "./module.js"; export {input as value}; export const name="Study";';
assert.match(transformBrowserStrings(module),/\\x2e\\x2f/);
assert(transformBrowserStrings(transformBrowserStrings(module),{decode:true}).includes('./module.js'));
const html='<script type="application/ld+json">{"name":"Study"}</script><script>globalThis.label="lesson";</script><template><script>const nested="class";</script></template>';
const encoded=scrambleInlineScripts(html);
assert(encoded.includes('{"name":"Study"}'));
assert(!encoded.includes('"lesson"'));
assert(!encoded.includes('"class"'));
assert(scrambleInlineScripts(encoded,{decode:true}).includes('"lesson"'));
const markupString='<script>globalThis.fragment="<\\/script><p>hello</p>";</script>';
const roundtrip=scrambleInlineScripts(scrambleInlineScripts(markupString),{decode:true});
assert.equal((roundtrip.match(/<\/script>/g)||[]).length,1);
assert.doesNotThrow(()=>scrambleInlineScripts(roundtrip));
const mangled=await minify('globalThis.read=function(inputValue){let secretName="value";return inputValue+secretName}',{compress:false,mangle:{nth_identifier:opaqueIdentifiers('test')}});
assert.match(mangled.code,/_0x[0-9a-f]{6}_[0-9a-f]+/);
assert(!mangled.code.includes('secretName'));
const context={};vm.runInNewContext(transformBrowserStrings(mangled.code),context);assert.equal(context.read('a'),'avalue');
console.log('PASS string values, strict mode, templates/raw tags, Unicode, module imports, HTML data, serialized workers, publisher rebasing and opaque locals.');
