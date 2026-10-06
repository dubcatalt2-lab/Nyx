import {sourceFile} from '../scripture/source-layout.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parse} from 'acorn';

const source=await readFile(sourceFile(new URL('../shepherd.js',import.meta.url)),'utf8');
const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
let upgrade;
function visit(node){
  if(!node||typeof node!=='object')return;
  if(node.type==='CallExpression'&&node.callee.object?.name==='server'&&node.callee.property?.name==='on'&&node.arguments[0]?.value==='upgrade')upgrade=node.arguments[1];
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
}
visit(ast);
assert.ok(upgrade);
let routed=0,rejected=0,banned=false;
const context=vm.createContext({URL,console,externalWispUrl:'',wisp:{route(){routed++;}},rejectWispUpgrade(){rejected++;},nyxRequestIpIsBanned:async()=>banned});
const handle=vm.runInContext('('+source.slice(upgrade.start,upgrade.end)+')',context);
for(const origin of ['https://cdn.jsdelivr.net','https://arbitrary.example','http://localhost:6767','null',undefined]){
  for(const path of ['/resources/live/','/resources/live','/wisp/','/wisp']){
    const before=routed;
    await handle({url:path,headers:{origin,host:'relay.example'}},{destroyed:false},Buffer.alloc(0));
    assert.equal(routed,before+1);
  }
}
assert.equal(rejected,0);
banned=true;
await handle({url:'/wisp/',headers:{origin:'https://arbitrary.example'}},{destroyed:false},Buffer.alloc(0));
assert.equal(rejected,1);
await handle({url:'/unrelated',headers:{}},{},Buffer.alloc(0));
assert.equal(rejected,2);
const chat=ast.body.find(node=>node.type==='FunctionDeclaration'&&node.id.name==='nyxChatOriginAllowed');
const allowed=vm.runInNewContext('('+source.slice(chat.start,chat.end)+')',{URL,embeddedWispAllowedOrigins:['https://nyxlearning.org']});
assert.equal(allowed('https://nyxlearning.org','nyxlearning.org'),true);
assert.equal(allowed('https://arbitrary.example','nyxlearning.org'),false);
assert.equal(allowed('null','nyxlearning.org'),false);
console.log('PASS all Wisp origins and route aliases; IP bans and chat origin restrictions retained');
