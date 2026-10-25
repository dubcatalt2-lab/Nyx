import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const runtime=await readFile('apps/blooket/connector-runtime.js','utf8'),catalog=JSON.parse(await readFile('apps/blooket/catalog.json','utf8'));
const entries=catalog.entries.filter(e=>e.category!=='interfaces');assert.equal(entries.length,109);
function context(model){class Node{}const el=new Node();el.__reactFiber$contract={stateNode:el,return:{stateNode:model}};const ctx=vm.createContext({Node,document:{querySelectorAll:()=>[el]},window:{},Symbol});vm.runInContext(runtime,ctx);return ctx;}
function modelFor(paths){const model={setState(){}};for(const path of paths){const parts=path.split('.');let target=model;for(const key of parts.slice(0,-1)){if(!Object.hasOwn(target,key))target[key]=Object.create(null);target=target[key];}target[parts.at(-1)]=parts.at(-1)==='setState'?()=>{}:1;}return model;}
let components=0,native=0,withoutCheck=0;
for(const entry of entries){
 assert(Array.isArray(entry.requirements),entry.path);new vm.Script('(async function(setInterval,setTimeout,resolveBlooketState,resolveBlooketEffect,resolveBlooketGame,resolveBlooketScene,resolveBlooketFiber,onBlooketCleanup,runBlooketQuestionTool,fetch,prompt,alert,confirm,clearInterval,clearTimeout){return await '+entry.code+'})');
 assert(!/window\.(?:alert|prompt|confirm)\s*=/.test(entry.code),entry.path+' overrides dialogs');
 assert(!/window\.set(?:Interval|Timeout)\(/.test(entry.code),entry.path+' bypasses task timers');
 if(entry.implementation==='native-question'){native++;assert.deepEqual(entry.requirements,[{kind:'question'}]);}
 if(!entry.requirements.length)withoutCheck++;
 for(const requirement of entry.requirements){
  assert(['component','game','scene','effect','fiber','question','props','selector'].includes(requirement.kind),entry.path);
  if(requirement.kind!=='component')continue;components++;
  const contract=requirement.value,alternatives=Array.isArray(contract[0])?contract:[contract];
  for(const paths of alternatives){
   assert(paths.length,entry.path+' has empty component contract');const model=modelFor(paths);assert.equal(context(model).findBlooketComponent(contract),model,entry.path);
  }
 }
}
assert.equal(native,7);assert.equal(components,78);
const partial={setState(){},state:{tokens:0}};assert.throws(()=>context(partial).findBlooketComponent(['setState','state.tokens','state.round']),/does not expose/);
console.log(`PASS 109 action syntax/contracts; ${components} component contracts checked, ${native} rebuilt question actions, ${withoutCheck} actions without local capability checks. This does not verify live effects.`);
