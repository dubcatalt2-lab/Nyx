import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
const source=fs.readFileSync('script.js','utf8'), ast=parse(source,{ecmaVersion:'latest'}), wanted=new Set(['canonicalAddressInput','browserShellDisplayValue']);let code='';
function walk(node){if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration'&&wanted.has(node.id?.name))code+=source.slice(node.start,node.end)+'\n';for(const [key,value]of Object.entries(node))if(key!=='start'&&key!=='end'){if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}}walk(ast);
const c=vm.createContext({URL,location:{href:'https://nyx.test/',origin:'https://nyx.test'},unwrapAccidentalUrlSearch:v=>v,browserShellSourceUrl:v=>v});vm.runInContext(code,c);
for(const path of ['/assets/studies/?id=42#play','/apps/code-studio/','/apps/nyxify/']){const display=c.browserShellDisplayValue(path);assert.notEqual(display,path.slice(1));assert.equal(display.normalize('NFKC'),path.slice(1));assert.equal(c.canonicalAddressInput(display),path);}
assert.equal(c.browserShellDisplayValue('https://example.com/a?q=x'),'https://example.com/a?q=x');
console.log('PASS displayed Unicode local paths round-trip, preserve query/hash, and retain external URLs');
