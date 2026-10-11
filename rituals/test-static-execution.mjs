import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {replaceStaticCalls} from './build-native-values.mjs';

for(const code of [
  'const value=7;globalThis.result=eval("value + 4");',
  'var Module;Module=eval("(function(){try{return Module||{value:3}}catch(e){return {}}})()");globalThis.result=Module.value;',
  'const $=17;globalThis.result=eval("$");',
  'const require=name=>({name});globalThis.result=eval("require")("crypto").name;',
  'const object={method(){return this===object}};globalThis.result=eval("object.method")();',
  'let supported=false;try{eval("let foo = 123;");supported=true;}catch{}globalThis.result=[supported,typeof foo];',
  'globalThis.marker=19;globalThis.result=Function("return this")().marker;',
  'globalThis.marker=21;globalThis.result=new Function("return this")().marker;'
]){
  const before={},after={};
  runInNewContext(code,before);
  const transformed=replaceStaticCalls(code,'script');
  assert.equal(transformed.count,1);
  runInNewContext(transformed.text,after);
  assert.equal(JSON.stringify(after.result),JSON.stringify(before.result));
}
for(const code of [
  'function f(eval){return eval("1+2")}',
  'function f(Function){return Function("return this")()}',
  'function f(globalThis){return Function("return this")()}',
  'function f(){eval("1+2");var eval=custom;}',
  'other.eval("1+2")',
  'eval(source)',
  'eval("var created=3;")',
  'eval("with(x){value}")',
  'eval("if(true){3}")',
  String.raw`eval('"use strict";value')`,
  'eval?.("value")',
  'with(object){eval("value")}',
  'Function("return this")(argument)'
])assert.equal(replaceStaticCalls(code,'script').text,code);
console.log('PASS static execution: lexical values, Module initialization, global discovery, feature probe and shadowed bindings; genuinely dynamic code left unchanged');
