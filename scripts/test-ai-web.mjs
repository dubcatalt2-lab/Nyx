import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parse} from 'acorn';
import {aiConfigureChatWeb,aiWantsWeb,aiWebTools,aiResponseMetadata} from '../lib/ai-web.mjs';
import {createAiAllowance,aiAllowanceConfig} from '../lib/ai-allowance.mjs';
import {aiBudgetResponse} from '../lib/ai-budget-response.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';

const source=await readFile(new URL('../server.js',import.meta.url),'utf8');
const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
const route=ast.body.find(n=>n.expression?.callee?.property?.name==='post'&&n.expression.arguments?.[0]?.value==='/api/nyx-ai').expression.arguments.at(-1);
const modelInfo={id:'qwen/qwen3.7-flash',supportedParameters:['tools','reasoning','temperature']};
let payload,stream=true;
const event={choices:[{delta:{content:'Try these cupcake recipes.',annotations:[{type:'url_citation',url_citation:{url:'https://recipes.example/cupcakes?a=1&b=2',title:'Cupcake recipes'}}],reasoning_details:[{type:'reasoning.summary',summary:'Compared recipe instructions and ingredient lists.'},{type:'reasoning.text',text:'RAW SECRET'},{type:'reasoning.encrypted',data:'ENCRYPTED'}]}}]};
const context=vm.createContext({URL,AbortController,setTimeout,clearTimeout,TextDecoder,process:{env:{}},aiConfigureChatWeb,aiResponseMetadata,aiWantsWeb,
 nyxAiRequestCredential:()=>({key:'fixture',provider:{id:'shared'}}),nyxAiResolveModel:async()=>modelInfo,aiModelAllowed:()=>true,nyxAiPremiumEntitlement:async()=>({owner:true}),
 nyxAiLimits:{promptChars:10000,contextChars:24000,timeoutMs:45000},nyxAiTextAttachmentPrompt:v=>v,nyxAiEndpoint:()=> 'https://openrouter.ai/api/v1/chat/completions',
 nyxAiApplySupportedParameters:()=>{},nyxAiLooksCorrupted:()=>false,aiOutputImages:()=>[],
 nyxAiProviderFetch:async(_provider,_url,options)=>{payload=JSON.parse(options.body);return stream?new Response('data: '+JSON.stringify(event)+'\n\ndata: [DONE]\n\n'):Response.json({choices:[{message:event.choices[0].delta}]});}
});
for(const name of ['nyxAiStreamText','nyxAiWriteStreamChunk','nyxAiCompletionTokens','nyxAiCompletionText']){
 const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);vm.runInContext(source.slice(n.start,n.end),context);
}
const handler=vm.runInContext('('+source.slice(route.start,route.end)+')',context);
async function request(message,extra={}){
 let output='',json;
 const res={status(){return this;},setHeader(){},once(){},flushHeaders(){},write(v){output+=v;},end(){},json(v){json=v;}};
 await handler({body:{model:modelInfo.id,message,...extra}},res);
 return {output,json};
}
const result=await request('Find me websites with cupcake recipes');
assert.match(result.output,/nyx_metadata/);assert.match(result.output,/Cupcake recipes/);assert.doesNotMatch(result.output,/RAW SECRET|ENCRYPTED/);
assert.equal(payload.max_tool_calls,1);assert.equal(payload.tools.length,2);assert.equal(payload.max_tokens,700);
const webPayload=structuredClone(payload);
await request('hi');assert.equal(payload.tools,undefined);
stream=false;assert.equal((await request('Read https://recipes.example',{stream:false})).json.metadata.sources.length,1);
for(const option of [{codeEdit:true},{generateImage:true}]){const p={messages:[{role:'system',content:''}],max_tokens:1200};assert.equal(aiConfigureChatWeb(p,modelInfo,'search recipes',option),false);assert.equal(p.tools,undefined);}
assert.deepEqual(aiResponseMetadata({choices:[{message:{annotations:[{type:'url_citation',url_citation:{url:'javascript:alert(1)'}},{type:'url_citation',url_citation:{url:'https://user:password@example.com/'}}]}}]}).sources,[]);

const db=memoryFirestore(),allowance=createAiAllowance({db,config:aiAllowanceConfig({NYX_AI_DAILY_BUDGET_USD:'1'})});
const session=await allowance.begin({uid:'web-member',device:'web-member',network:'fixture',createdAt:Date.parse('2026-01-01')});
const reserved=await allowance.reserve(session,'shared',webPayload);
assert.ok(reserved.tokens<=10000,'A short web request must fit the regular token pool');
assert.ok(reserved.reserved>=1000,'Search cost reserved before provider call');
let usage;
await aiBudgetResponse(Response.json({usage:{prompt_tokens:2000,completion_tokens:300,cost:.0015,server_tool_use:{web_search_requests:1}}}),async u=>{usage=u;await allowance.settle(reserved,u);}).text();
assert.equal(usage.webSearches,1);assert.ok(db.records.get('nyxAiAllowance/global').newcomerMoney>=1500);
await allowance.finish(session,true);
const owner=await allowance.begin({uid:'owner',owner:true});
for(const mutation of [p=>p.max_tool_calls=30,p=>p.tools[0].parameters.max_uses=20,p=>p.stop_server_tools_when=[],p=>p.tools=[{type:'function',function:{name:'anything'}}]]){
 const p=structuredClone(webPayload);mutation(p);await assert.rejects(allowance.reserve(owner,'shared',p),e=>e.status===400);
}
await allowance.finish(owner);
assert.equal(aiWebTools()[0].parameters.engine,'parallel');
console.log('PASS AI web: actual streaming/nonstreaming route, automatic request detection, source/summary forwarding, unsafe URL/raw reasoning exclusion, regular pool fit, search billing and tool-budget tampering rejection');

assert.equal(aiWantsWeb('What is on nyxlearning.org'),true);
assert.equal(aiWantsWeb('Read example.com/recipes'),true);
assert.equal(aiWantsWeb('Calculate 3.14 times 2'),false);
await request('What is on nyxlearning.org');
assert.equal(payload.tools.length,2);

assert.equal(aiWantsWeb('Please read nyxlearning.org.'),true);
