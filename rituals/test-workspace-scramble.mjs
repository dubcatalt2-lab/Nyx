import assert from 'node:assert/strict';
import vm from 'node:vm';
import {minify} from 'terser';
import {transformWorkspaceStrings,scrambleInlineScripts,opaqueIdentifiers} from './build-workspace-scramble.mjs';

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
const compiled=transformWorkspaceStrings(fixture);
assert.match(compiled,/"use strict"/);
assert(!compiled.includes('Résumé'));
assert(compiled.includes('/__NYX_STATIC_BASE__/'));
const evaluate=source=>{const context={};vm.runInNewContext(source,context);return context.result;};
const before=evaluate(fixture),after=evaluate(compiled);
const normalize=result=>JSON.stringify({...result,negative:String(result.negative),source:undefined});
assert.equal(normalize(after),normalize(before));
assert.equal(vm.runInNewContext('('+after.source+')')('worker'),vm.runInNewContext('('+before.source+')')('worker'));
assert.equal(normalize(evaluate(transformWorkspaceStrings(compiled,{decode:true}))),normalize(before));
assert.equal(transformWorkspaceStrings(compiled),compiled);
const rebased=compiled.replaceAll('/__NYX_STATIC_BASE__/','/gh/user/repo@main/nyx-static/');
assert.equal(evaluate(rebased).placeholder,'/gh/user/repo@main/nyx-static/assets/example.js');
const module='import {value as input} from "./module.js"; export {input as value}; export const name="Study";';
assert.match(transformWorkspaceStrings(module),/\\x2e\\x2f/);
assert(transformWorkspaceStrings(transformWorkspaceStrings(module),{decode:true}).includes('./module.js'));
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
const context={};vm.runInNewContext(transformWorkspaceStrings(mangled.code),context);assert.equal(context.read('a'),'avalue');
const identifiers=String.raw`
/*! BareMux attribution stays unchanged. */
const browser=3,proxy=4,relay=5;
class BareTransport { #injected=2; read(){return this.#injected} }
const BareMux={browser,proxy,relay,inject(value){return value+this.browser}};
const self={settings:{enabled:true}};
function ScramjetControlller(){return new BareTransport().read()}
globalThis.result={browser,proxy,relay,value:BareMux.inject(7),private:ScramjetControlller(),self:self.settings,
  captured:(()=>({browser,proxy})).toString()};
`;
const protectedCode=transformWorkspaceStrings(identifiers);
assert(protectedCode.includes('/*! BareMux attribution stays unchanged. */'));
assert(!/\b(?:browser|proxy|inject|BareTransport|ScramjetControlller)\b/.test(protectedCode.replace(/\/\*[\s\S]*?\*\//g,'')));
const originalResult=evaluate(identifiers),protectedResult=evaluate(protectedCode);
assert.equal(JSON.stringify({...protectedResult,captured:undefined}),JSON.stringify({...originalResult,captured:undefined}));
assert.equal(transformWorkspaceStrings(protectedCode),protectedCode);
assert.equal(JSON.stringify(evaluate(transformWorkspaceStrings(protectedCode,{decode:true}))),JSON.stringify(originalResult));
const imported='import {BareMux as browser} from "./peer.js"; export {browser as BareMux}; export const proxy=browser;';
assert(!/BareMux|\bbrowser\b|\bproxy\b/.test(transformWorkspaceStrings(imported)));
assert.equal(transformWorkspaceStrings(transformWorkspaceStrings(imported),{decode:true}),imported);
console.log('PASS string values, strict mode, templates/raw tags, Unicode, module imports, HTML data, serialized workers, publisher rebasing and opaque locals.');
