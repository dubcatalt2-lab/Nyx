import assert from "node:assert/strict";
import vm from "node:vm";
import { encodeLiterals } from "./build-string-literals.mjs";

const source = `"use strict";
class Base { method(){ return this.value; } }
class Child extends Base { #secret=3; method(){ return super.method()+this.#secret; } }
const item=new Child();item.value=4;
const receiver={value:8,read(){return this.value;}};
const {value:copied}=receiver;
const model={library:"games",play:true};
const proto={inherited:5};const inherited={__proto__:proto};
const nested={child:{value:2}};
globalThis.result={read:receiver.read(),copied,model,inherited:inherited.inherited,
  child:item.method(),optional:null?.missing,chain:nested?.child?.value,
  grouped:(true?receiver:nested).read(),
  commented:(receiver) /* keep . punctuation */ . /* another . */ value,
  groupedOptional:(null)?.missing,
  nestedGroup:((receiver)).value,
  template:\`hello \${copied} 世界\`,raw:String.raw\`a\\nb\`};`;
const expected = {},
  actual = {};
vm.runInNewContext(source, expected);
const transformed = encodeLiterals(source);
vm.runInNewContext(transformed, actual);
assert.equal(JSON.stringify(actual.result), JSON.stringify(expected.result));
assert(transformed.startsWith('"use strict"'));
assert(!transformed.includes(".read") && !transformed.includes("library:"));
assert(
  transformed.includes("a\\nb"),
  "Tagged-template raw contents must remain unchanged",
);
assert.match(transformed, /\\u0068\\u0065\\u006c\\u006c\\u006f/);
console.log(
  "PASS stronger string/property/template scrambling preserves receivers, optional chains, private fields, prototypes, destructuring and tagged raw strings",
);
