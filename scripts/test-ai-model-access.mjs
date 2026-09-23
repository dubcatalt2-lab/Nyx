import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import express from 'express';
import {aiModelAllowed} from '../lib/ai-allowance.mjs';
const app=express(),source=readFileSync('server.js','utf8');
const models=[{id:'google/gemini-2.5-flash-lite'},{id:'openai/gpt-5.6-luna'},{id:'deepseek/deepseek-v4.1-flash'},{id:'qwen/qwen3.7-flash'},{id:'inception/mercury-2.5'},{id:'openai/gpt-5.6-sol-pro'}];
models.push({id:'openai/gpt-6-luna-pro'},{id:'anthropic/claude-opus-5.5'},{id:'openai/gpt-6-luna'},{id:'openai/gpt-6-sol'});
const start=source.indexOf("app.get('/api/nyx-ai/models',");
const end=source.indexOf('\napp.post("/api/nyx-ai"',start);
vm.runInNewContext(source.slice(start,end),{app,aiModelAllowed,
 nyxAiPremiumEntitlement:async req=>({premium:req.get('authorization')==='Bearer premium',owner:req.get('authorization')==='Bearer owner'}),
 nyxAiRequestCredential:()=>({key:'fixture'}),nyxAiAvailableModels:async()=>models});
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
try {
 for(const role of ['guest','member','expired','premium','owner'])for(const query of ['','?custom=1']) {
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/nyx-ai/models${query}`,{headers:{authorization:'Bearer '+role}});
  assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
  const data=await response.json();
  assert(data.models.some(m=>m.id==='openai/gpt-6-luna'),role+query);
  assert(data.models.some(m=>m.id==='openai/gpt-6-luna-pro'),role+query);
  assert.equal(data.models.some(m=>m.id==='anthropic/claude-opus-5.5'),['premium','owner'].includes(role),role+query);
  if(role==='premium')assert.equal(data.models.find(m=>m.id==='anthropic/claude-opus-5.5').poolTokenLimit,5000);
  assert.equal(data.models.find(m=>m.id==='openai/gpt-6-luna').poolTokenLimit,['premium','owner'].includes(role)?null:5000);
  assert.equal(data.models.some(m=>m.id==='openai/gpt-6-sol'),role==='owner',role+query);
  assert.equal(data.models.some(m=>m.id==='openai/gpt-5.6-luna'),['premium','owner'].includes(role),role+query);
  assert(data.models.some(m=>m.id==='google/gemini-2.5-flash-lite'));
  assert(data.models.some(m=>m.id==='deepseek/deepseek-v4.1-flash'));
  assert(data.models.some(m=>m.id==='qwen/qwen3.7-flash'));
  assert(data.models.some(m=>m.id==='inception/mercury-2.5'));
  assert.equal(data.models.some(m=>m.id==='openai/gpt-5.6-sol-pro'),role==='owner',role+query);
 }
 console.log('PASS: model routes expose public Luna 6/Pro, restrict Opus 5.5 to Premium/owner and Sol 6 to owner, and preserve older model gates');
} finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
