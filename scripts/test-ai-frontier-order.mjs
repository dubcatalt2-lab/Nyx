import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../js/ai-workspace.js',import.meta.url),'utf8');
const start=source.indexOf('  function groupedModels(models)');
const end=source.indexOf('  function modelCapabilities',start);
const group=vm.runInNewContext('('+source.slice(start,end).trim()+')', {modelCompany: item => ({key:({'google':'gemini','meta-llama':'meta','x-ai':'xai'}[item.id.split('/')[0]] || item.id.split('/')[0]),label:item.id.split('/')[0]})});
const model=(id,catalogRank,extra={})=>({id,label:id,catalogRank,text:true,...extra});
const result=group([
  model('aion/model',3),model('meta-llama/model',7),model('x-ai/model',8),model('openai/small',90),model('anthropic/frontier',0),
  model('google/strong',2),model('openai/frontier',1),
  model('image/model',3,{text:false}),model('anthropic/frontier:batch',0),
]);
assert.deepEqual(Array.from(result, ([name])=>name), ['openai','anthropic','meta-llama','x-ai','google','aion','image']);
assert.deepEqual(Array.from(result.find(([name])=>name==='openai')[1],m=>m.id),['openai/frontier','openai/small']);
assert.equal(result.find(([name])=>name==='anthropic')[1][1].id,'anthropic/frontier:batch');
assert.equal(group([model('same/unknown',undefined),model('same/known',5)])[0][1][0].id,'same/known');
console.log('PASS Company grouping, rank within company, unknown ranks and specialist order.');
