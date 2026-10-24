import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile('server.js','utf8');
const start=source.indexOf('async function nyxAiRateLimit('),end=source.indexOf('\nsetInterval(',start);
assert(start>0&&end>start);
let signedIn=true;
const context=vm.createContext({nyxAiBudgetContext:{getStore:()=>null},nyxAiClientId:()=> 'fixture',nyxAiPremiumEntitlement:async()=>signedIn?{uid:'member'}:{},hasFullAiCatalog:()=>false,hasAppAiAllowance:()=>false,nyxAiUsage:new Map(),nyxAiLimits:{minute:4,daily:80,perIpConcurrent:1,globalConcurrent:4},nyxAiActiveRequests:0});
vm.runInContext(source.slice(start,end)+';globalThis.rateLimit=nyxAiRateLimit',context);
async function request(){const callbacks={},headers={};const result={headers,accepted:false,status:200};const res={setHeader:(k,v)=>headers[k]=v,status:n=>{result.status=n;return res},json:value=>result.body=value,once:(name,fn)=>callbacks[name]=fn};await context.rateLimit({},res,()=>result.accepted=true);return {...result,finish:()=>callbacks.finish?.()};}
for(let i=0;i<40;i++){const r=await request();assert(r.accepted);assert.equal(r.headers['x-ratelimit-limit-minute'],'unlimited');r.finish();}
const active=await request();assert(active.accepted);assert.equal((await request()).body.code,'capacity');active.finish();
signedIn=false;
for(let i=0;i<80;i++){const r=await request();assert(r.accepted);r.finish();}
assert.equal((await request()).body.code,'anonymous_request_limit');
console.log('PASS actual fallback AI middleware: rapid sequential sends, retained concurrent-request cap and anonymous daily allowance.');
