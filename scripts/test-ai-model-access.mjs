import {hasAppAiAllowance,dropModelIsExpensive,nookModelIsExpensive,expensiveClaudeModel} from '../lib/ai-allowance.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import express from 'express';
import {aiModelAllowed} from '../lib/ai-allowance.mjs';
import {hasFullAiCatalog,fullCatalogUid} from '../lib/ai-owner-catalog.mjs';
const app=express(),source=readFileSync('server.js','utf8');
const models=[{id:'google/gemini-2.5-flash-lite'},{id:'openai/gpt-5.6-luna'},{id:'deepseek/deepseek-v4.1-flash'},{id:'qwen/qwen3.7-flash'},{id:'inception/mercury-2.5'},{id:'openai/gpt-5.6-sol-pro'}];
models.push({id:'openai/gpt-6-luna-pro'},{id:'anthropic/claude-opus-5.5'},{id:'openai/gpt-6-luna'},{id:'openai/gpt-6-sol'},{id:'openai/gpt-6-astra'},{id:'anthropic/claude-fable-5.1'});
const start=source.indexOf("app.get('/api/nyx-ai/models',");
const end=source.indexOf('\ninstallAiMedia(',start);
vm.runInNewContext(source.slice(start,end),{app,hasAppAiAllowance,dropModelIsExpensive,nookModelIsExpensive,expensiveClaudeModel,aiModelAllowed,hasFullAiCatalog,nyxAiKey:()=> 'fixture',
 aiCatalogPrice:model=>({inputPerMillion:model.id.includes('claude')?6:1,outputPerMillion:model.id.includes('sol')?10:1}),
 nyxAiPremiumEntitlement:async req=>({app:req.get('authorization')==='Bearer nook'?'nook':null,uid:req.get('authorization')==='Bearer specific'?fullCatalogUid:'other',premium:req.get('authorization')==='Bearer premium',owner:['Bearer owner','Bearer specific'].includes(req.get('authorization'))}),
 nyxAiRequestCredential:()=>({key:'fixture'}),nyxAiAvailableModels:async()=>models});
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
try {
 for(const role of ['guest','member','expired','premium','owner'])for(const query of ['','?custom=1']) {
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/nyx-ai/models${query}`,{headers:{authorization:'Bearer '+role}});
  assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
  const data=await response.json();
  assert.equal(data.models.some(m=>['openai/gpt-6-astra','anthropic/claude-fable-5.1'].includes(m.id)),['premium','owner'].includes(role));
  assert(data.models.some(m=>m.id==='openai/gpt-6-luna'),role+query);
  assert.equal(data.models.some(m=>m.id==='openai/gpt-6-luna-pro'),['premium','owner'].includes(role),role+query);
  assert.equal(data.models.some(m=>m.id==='anthropic/claude-opus-5.5'),['premium','owner'].includes(role),role+query);
  assert(data.models.every(m=>m.poolTokenLimit===undefined),'No quota labels in model catalog');

  assert.equal(data.models.some(m=>m.id==='openai/gpt-6-sol'),['premium','owner'].includes(role),role+query);
  assert.equal(data.models.some(m=>m.id==='openai/gpt-5.6-luna'),['premium','owner'].includes(role),role+query);
  assert(data.models.some(m=>m.id==='google/gemini-2.5-flash-lite'));
  assert(data.models.some(m=>m.id==='deepseek/deepseek-v4.1-flash'));
  assert.equal(data.models.some(m=>m.id==='qwen/qwen3.7-flash'),['premium','owner'].includes(role));
  assert.equal(data.models.some(m=>m.id==='inception/mercury-2.5'),['premium','owner'].includes(role));
  assert.equal(data.models.some(m=>m.id==='openai/gpt-5.6-sol-pro'),['premium','owner'].includes(role),role+query);
 }
 for(const query of ['','?custom=1']){
  const data=await (await fetch(`http://127.0.0.1:${server.address().port}/api/nyx-ai/models${query}`,{headers:{authorization:'Bearer specific'}})).json();
  assert(data.models.some(m=>m.id==='openai/gpt-6-astra'));
  assert(data.models.some(m=>m.id==='anthropic/claude-fable-5.1'));
 }
 const nook=await (await fetch(`http://127.0.0.1:${server.address().port}/api/nyx-ai/models`,{headers:{authorization:'Bearer nook'}})).json();
 assert(nook.models.some(m=>m.id==='openai/gpt-6-luna'));assert(!nook.models.some(m=>m.id.includes('claude')||m.id.includes('astra')||m.id.includes('sol')));
 console.log('PASS: model routes expose public Luna 6/Gemini/DeepSeek, Premium other models, Premium expensive models and no quota labels');
} finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
