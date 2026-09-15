import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import express from 'express';
import {aiModelAllowed} from '../lib/ai-allowance.mjs';
const app=express(),source=readFileSync('server.js','utf8');
const models=[{id:'google/gemini-2.5-flash-lite'},{id:'openai/gpt-5.6-luna'}];
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
  assert.equal(data.models.some(m=>m.id==='openai/gpt-5.6-luna'),['premium','owner'].includes(role),role+query);
  assert(data.models.some(m=>m.id==='google/gemini-2.5-flash-lite'));
 }
 console.log('PASS: actual model route hides Luna for guest/member/expired accounts in shared and custom-key pickers; Premium/owner retain it');
} finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
