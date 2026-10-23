import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../js/ai-workspace.js',import.meta.url),'utf8');
const start=source.indexOf('  function groupedModels(models)');
const end=source.indexOf('  function modelCapabilities',start);
const group=vm.runInNewContext('('+source.slice(start,end).trim()+')');
const model=(id,catalogRank,extra={})=>({id,label:id,catalogRank,text:true,...extra});
const result=group([
  model('openai/small',90),model('anthropic/frontier',0),
  model('google/strong',2),model('openai/frontier',1),
  model('image/model',3,{text:false}),model('anthropic/frontier:batch',0),
]);
assert.deepEqual(Array.from(result[0][1],m=>m.id),['anthropic/frontier','openai/frontier','google/strong','openai/small']);
assert.equal(result[1][1].length,2,'Specialized tools and batch models stay separate from chat ranking');
assert.equal(group([model('unknown',undefined),model('known',5)])[0][1][0].id,'known');
console.log('PASS Catalog intelligence order across providers, unknown ranks and specialist separation.');
