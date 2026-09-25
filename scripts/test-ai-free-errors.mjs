import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
import express from 'express';
import {createFreeModelHealth} from '../lib/ai-free-health.mjs';
import {freeAiModels,isFreeAiModel,configureFreeAiReasoning} from '../lib/ai-free-models.mjs';
import {createAiDeadline} from '../lib/ai-deadline.mjs';
const source=readFileSync('server.js','utf8'),ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
const declaration=name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(n.start,n.end);};
const app=express();app.use(express.json());
let clock=0,response,calls=0,personal=false,cancelled=0;
const model=freeAiModels[0],health=createFreeModelHealth({now:()=>clock});
const context=vm.createContext({app,process:{env:{}},URL,AbortController,setTimeout,clearTimeout,TextDecoder,
 freeModelHealth:health,isFreeAiModel,configureFreeAiReasoning,createAiDeadline,
 nyxAiRateLimit:(_req,_res,next)=>next(),nyxAiRequestCredential:()=>({key:'secret-fixture',personal,provider:{id:'shared'}}),
 nyxAiResolveModel:async()=>({id:model,supportedParameters:[]}),aiModelAllowed:()=>true,nyxAiPremiumEntitlement:async()=>({}),
 nyxAiLimits:{promptChars:4000,contextChars:24000,timeoutMs:45000},nyxAiTextAttachment:()=>null,nyxAiTextAttachmentPrompt:value=>value,
 nyxAiEndpoint:()=> 'https://openrouter.ai/api/v1/chat/completions',aiWantsWeb:()=>false,
 aiResponseMetadata:()=>({sources:[]}),nyxAiCompletionTokens:()=>0,
 nyxAiProviderFetch:async()=>{calls++;return response;}
});
vm.runInContext(['nyxAiApplySupportedParameters','nyxAiCompletionText','nyxAiLooksCorrupted','nyxAiErrorMessage','nyxAiProviderError','nyxAiStreamText','nyxAiWriteStreamChunk'].map(declaration).join('\n'),context);
const start=source.indexOf('app.post("/api/nyx-ai",'),end=source.indexOf('\n// Nyx-issued API keys',start);
vm.runInContext(source.slice(start,end),context);
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const send=stream=>fetch(`http://127.0.0.1:${server.address().port}/api/nyx-ai`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model,message:'Hello',stream})});
const error=code=>({error:{code,message:'Provider returned error',metadata:{raw:'secret-fixture private provider details'}}});
try {
 for(const [http,embedded,stream] of [[500,500,false],[200,503,false],[200,502,true],[429,429,false],[400,400,false]]){
  clock+=300001;response=Response.json(error(embedded),{status:http});const before=calls;
  const r=await send(stream),data=await r.json();assert.equal(r.status,embedded);assert.equal(calls,before+1,'Never replay or switch models');
  assert.match(data.error,/free model/);assert.doesNotMatch(data.error,/secret-fixture|private provider/);
  assert.equal(health.available(model),embedded===400||embedded===429);
 }
 for(const trailing of [false,true]){
  clock+=300001;
  const body='data: '+JSON.stringify({choices:[{delta:{content:'Partial answer'}}]})+'\n\n'+'data: '+JSON.stringify(error(500))+(trailing?'':'\n\n');
  response=new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(body));if(trailing)c.close();},cancel(){cancelled++;}}),{headers:{'content-type':'text/event-stream'}});
  const r=await send(true),text=await r.text();assert.equal(r.status,200);assert.match(text,/Partial answer/);assert.match(text,/temporarily unavailable/);assert.doesNotMatch(text,/private provider/);assert.equal(health.available(model),false);
 }
 assert.equal(cancelled,1,'An open failed provider stream is cancelled');
 clock+=300001;personal=true;response=Response.json(error(503),{status:503});await (await send(false)).text();assert.equal(health.available(model),true,'Personal failure cannot hide shared models');
 personal=false;response=Response.json({choices:[{message:{content:'Hello there'}}]});const r=await send(false);assert.equal(r.status,200);assert.equal((await r.json()).text,'Hello there');
 console.log('PASS actual AI route: HTTP 500, HTTP-200 JSON errors, SSE and trailing errors, partial output, cancellation, cooldown, rate-limit/request isolation, no replay, personal-key isolation and successful replies.');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
