import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
import express from 'express';
const source=readFileSync('server.js','utf8'),ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
const declaration=name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(n.start,n.end);};
const app=express();app.use(express.json({limit:'1mb'}));
let payload,calls=0,queue=[],supported=['temperature','response_format','reasoning'],answer={choices:[{message:{content:'{"summary":"Changed heading","files":[{"language":"html","edits":[{"search":"Old","replace":"New"}]}]}'},finish_reason:'stop'}]};
const context=vm.createContext({app,process:{env:{}},URL,AbortController,setTimeout,clearTimeout,
 nyxAiErrorMessage:(data)=>data.error||'Provider unavailable',
 nyxAiRateLimit:(_req,_res,next)=>next(),nyxAiRequestCredential:()=>({key:'fixture',provider:{id:'shared'}}),
 nyxAiResolveModel:async()=>({id:'fixture-model',supportedParameters:supported}),aiModelAllowed:()=>true,nyxAiPremiumEntitlement:async()=>({owner:true}),
 nyxAiLimits:{promptChars:4000,contextChars:24000,timeoutMs:45000},nyxAiTextAttachment:()=>null,nyxAiTextAttachmentPrompt:value=>value,
 nyxAiEndpoint:()=> 'https://openrouter.ai/api/v1/chat/completions',
 nyxAiProviderFetch:async(_provider,_url,options)=>{calls++;payload=JSON.parse(options.body);const next=queue.length?queue.shift():answer;return next instanceof Response?next:Response.json(next);}
});
vm.runInContext(['nyxAiApplySupportedParameters','nyxAiCompletionText','nyxAiLooksCorrupted'].map(declaration).join('\n'),context);
const start=source.indexOf('app.post("/api/nyx-ai",'),end=source.indexOf('\n// Nyx-issued API keys',start);
vm.runInContext(source.slice(start,end),context);
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const send=body=>fetch(`http://127.0.0.1:${server.address().port}/api/nyx-ai`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:'fixture-model',message:'Edit heading',messages:[{role:'user',content:'Return JSON edits for Old'}],stream:false,...body})});
try{
 let r=await send({task:'code-edit'});assert.equal(r.status,200);assert.equal((await r.json()).finishReason,'stop');assert.equal(payload.max_tokens,2200);assert.deepEqual(payload.reasoning,{enabled:false});assert.deepEqual(payload.response_format,{type:'json_object'});assert.match(payload.messages[0].content,/JSON/);
 supported=[];await send({task:'code-edit'});assert.equal(payload.temperature,undefined);assert.equal(payload.reasoning,undefined);assert.equal(payload.response_format,undefined);
 supported=['temperature','reasoning','response_format'];await send({});assert.equal(payload.max_tokens,1200);assert.equal(payload.reasoning,undefined);assert.equal(payload.response_format,undefined);assert.match(payload.messages[0].content,/Markdown/);
 const before=calls;r=await send({task:'code-edit',messages:[{role:'user',content:'x'.repeat(24001)}]});assert.equal(r.status,413);assert.equal(calls,before);
 const good=answer;
 for(const bad of [{choices:[{message:{content:''},finish_reason:'length'}]},{choices:[{message:{content:'not JSON'},finish_reason:'stop'}]}]){
   const count=calls;queue=[bad,good];r=await send({task:'code-edit'});assert.equal(r.status,200);assert.equal((await r.json()).finishReason,'stop');assert.equal(calls,count+2);assert.match(payload.messages.at(-1).content,/ONE tiny complete edit/);
 }
 answer={choices:[{message:{content:''},finish_reason:'length'}]};const failed=calls;r=await send({task:'code-edit'});assert.equal(r.status,502);assert.match((await r.json()).error,/after one repair/);assert.equal(calls,failed+2);
 queue=[answer,Response.json({error:'Budget exhausted'},{status:429})];r=await send({task:'code-edit'});assert.equal(r.status,429);assert.equal((await r.json()).error,'Budget exhausted');
 answer={choices:[{message:{content:'Here is the edit: '+good.choices[0].message.content+' Done.'},finish_reason:'stop'}]};const wrapped=calls;r=await send({task:'code-edit'});assert.equal(r.status,200);assert.equal(calls,wrapped+1);
 console.log('PASS actual code-edit route: JSON mode, reasoning control, bounded output, unsupported-parameter omission, chat preservation, truncation metadata and oversized-context rejection');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
