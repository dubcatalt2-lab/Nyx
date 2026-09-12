import {installDeveloperApi,createKeyStore,GEMINI} from '../lib/developer-api.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {AsyncLocalStorage} from 'node:async_hooks';
import express from 'express';
import {parse} from 'acorn';
import {memoryFirestore} from './test-ai-allowance.mjs';
import {aiAllowanceConfig,createAiAllowance} from '../lib/ai-allowance.mjs';
import {aiBudgetResponse} from '../lib/ai-budget-response.mjs';
import {createOpenRouterBalanceGuard,AI_UNAVAILABLE} from '../lib/openrouter-balance.mjs';

// Run the actual server middleware and paid fetch functions against isolated auth,
// transactional storage, and provider fixtures. Never contact Firebase or a paid API.
const source=await readFile(new URL('../server.js',import.meta.url),'utf8');
const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
const declaration=name=>{const node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert.ok(node,name);return source.slice(node.start,node.end);};
const db=memoryFirestore(),app=express();app.use(express.json());
const firebase={firestore:db,auth:{async getUser(uid){return {uid,email:'optional@example.com',emailVerified:uid==='late-api',disabled:uid==='disabled',metadata:{creationTime:uid.startsWith('late-')?'2026-08-25T07:00:00Z':'2026-01-01T00:00:00Z'}};}}};
let calls=0,lastPayload,hold,balance=1;
const environment={NYX_OPENROUTER_API_KEY:'fixture-inference',NYX_OPENROUTER_MANAGEMENT_KEY:'fixture-management',NYX_AI_DAILY_BUDGET_USD:'1',NYX_AI_MODEL_PRICES_JSON:JSON.stringify({'shared:test':{inputPerMillion:1,outputPerMillion:2},['shared:'+GEMINI]:{inputPerMillion:.1,outputPerMillion:.4},'groq:test':{inputPerMillion:1,outputPerMillion:2}})};
const context=vm.createContext({app,AsyncLocalStorage,aiAllowanceConfig,createAiAllowance,aiBudgetResponse,
  process:{env:environment},AbortController,AbortSignal,URL,Headers,setTimeout,clearTimeout,
  createOpenRouterBalanceGuard:options=>createOpenRouterBalanceGuard({...options,fetchImpl:async url=>new Response(JSON.stringify({data:url.endsWith('/credits')?{total_credits:balance,total_usage:0}:{limit_remaining:null}}))}),
  authenticatedNyxUser:async req=>{const uid=req.get('authorization')?.replace('Bearer ','');if(!uid)throw Object.assign(new Error('Auth required'),{status:401});return {firebase,token:{uid,email_verified:false}};},

  founderProfileConfig:()=>({administratorUid:'owner'}),nyxClientIp:()=> 'school-network',
  sameOriginRequest:req=>req.get('sec-fetch-site')!=='cross-site',
  nyxRoleForUser:uid=>uid==='owner'?'owner':'member',hasPremiumSubscription:value=>value==='premium',normalizeSubscriptionStatus:value=>value,
  fetch:async(_url,options)=>{calls++;lastPayload=JSON.parse(options.body);
    if(hold)await Promise.race([hold,new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}))]);
    return new Response(JSON.stringify({choices:[{message:{content:'hello'}}],usage:{prompt_tokens:10,completion_tokens:2,cost:0.000014}}),{headers:{'content-type':'application/json'}});
  }
});
vm.runInContext(source.slice(source.indexOf('const nyxAiBudgetContext ='),source.indexOf('async function nyxAiRateLimit')),context);
vm.runInContext(['nyxAiKey','nyxAiEndpoint','nyxAiCatalogEndpoint','nyxAiSharedProvider','nyxAiGlobalProvider','nyxAiRequestCredential'].map(declaration).join('\n'),context);
vm.runInContext(declaration('nyxAiProviderFetch')+'\n'+declaration('authenticatedNyxCloudUser'),context);
installDeveloperApi(app,{firebase:async()=>firebase,authenticate:context.authenticatedNyxUser,ownerUid:()=> 'owner',passwordHash:()=>'',sameOrigin:()=>true,device:async()=> 'browser',configured:()=>true,page:(_req,res)=>res.send('API'),send:async(req,payload)=>context.nyxBudgetedAiFetch('shared','https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{authorization:'Bearer fixture-inference'},body:JSON.stringify(payload)})});
for(const path of ['/api/nyx-ai'])app.post(path,async(req,res)=>{
  try {
    if(path==='/api/v1/ai')return res.status(410).json({error:'Retired'});
    const credential=context.nyxAiRequestCredential(req);
    if(credential.invalid||credential.invalidProvider)return res.status(410).json({error:'Removed'});
    const options={method:'POST',headers:{authorization:'Bearer fixture-inference'},body:JSON.stringify({model:req.body.model||'test',max_tokens:1000,messages:[{role:'user',content:'Hi'}]})};
    const response=await context.nyxAiProviderFetch({id:'shared'},'https://openrouter.ai/api/v1/chat/completions',options);
    res.type('json').send(await response.text());
  }catch(error){res.status(error.status||503).json({error:error.message});}
});
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const send=(uid,body={},headers={},path='/api/nyx-ai')=>fetch(origin+path,{method:'POST',headers:{'content-type':'application/json',...(uid?{authorization:`Bearer ${uid}`} : {}),...headers},body:JSON.stringify(body)});
try {
  assert.equal((await send(null)).status,401);assert.equal(calls,0);
  assert.equal((await send('member',{}, {'sec-fetch-site':'cross-site'})).status,403);assert.equal(calls,0);
  assert.equal((await send('disabled')).status,403);assert.equal(calls,0);
  assert.equal((await send('unpriced',{model:'other'})).status,503);assert.equal(calls,0);
  await new Promise(resolve=>setTimeout(resolve,30));
  const ok=await send('member');assert.equal(ok.status,200);assert.match(ok.headers.get('set-cookie'),/HttpOnly/);await ok.text();
  assert.equal(calls,1);assert.equal(lastPayload.max_tokens,700);
  assert.equal(lastPayload.provider.max_price.prompt,1);assert.equal(lastPayload.provider.max_price.completion,2);
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal((await send(null,{}, {'x-nyx-ai-api-key':'retired-personal'})).status,410);assert.equal(calls,1);
  assert.equal((await send('member',{}, {'x-nyx-ai-provider':'groq'})).status,410);assert.equal(calls,1);
  assert.equal((await send(null,{}, {},'/api/v1/ai')).status,401);assert.equal(calls,1);
  let release;hold=new Promise(resolve=>{release=resolve;});
  const pending=send('held');
  while(calls<2)await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal((await send('held')).status,429);
  assert.equal((await send('new-attacker')).status,429);
  db.records.set('nyxUserAdministration/approved',{aiAccess:'trusted'});
  const trusted=send('approved');while(calls<3)await new Promise(resolve=>setTimeout(resolve,5));
  const owner=send('owner');while(calls<4)await new Promise(resolve=>setTimeout(resolve,5));
  release();hold=null;assert.deepEqual((await Promise.all([pending,trusted,owner])).map(r=>r.status),[200,200,200]);
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(db.records.get('nyxAiAllowance/global').slots.length,0,'HTTP completion must release slots');
  balance=.10;
  const before=calls,spent=db.records.get('nyxAiAllowance/global').newcomerMoney;
  const paused=await send('low-balance');assert.equal(paused.status,503);assert.equal((await paused.json()).error,AI_UNAVAILABLE);
  assert.equal(calls,before,'Low credits must not reach any paid model');
  assert.equal(db.records.get('nyxAiAllowance/global').newcomerMoney,spent,'Unsent request must refund its dollar reservation');
  const ownerPaused=await send('owner');assert.equal(ownerPaused.status,503);assert.equal(calls,before);
  balance=1;await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal((await send('topped-up')).status,200,'Top-up should resume requests without a restart');
  await new Promise(resolve=>setTimeout(resolve,30));
  const beforeEligibility=calls;
  db.records.set('nyxUserAdministration/late-approved',{aiAccess:'trusted',createdAt:'2020-01-01T00:00:00Z'});
  assert.equal((await send('late-approved')).status,403,'Owner trust or a profile date cannot bypass actual Firebase creation time');
  assert.equal((await send('late-member',{}, {'x-nyx-premium':'true'})).status,403,'Browser headers cannot grant Premium');
  assert.equal(calls,beforeEligibility,'Ineligible requests must not contact inference');
  db.records.set('nyxUserAdministration/late-premium',{subscriptionStatus:'premium'});
  assert.equal((await send('late-premium')).status,200,'Server-authorized Premium qualifies after cutoff');
  const cloud=await context.authenticatedNyxCloudUser({get:()=> 'Bearer member'});assert.equal(cloud.token.uid,'member');assert.equal(cloud.account.emailVerified,false);
  await assert.rejects(context.authenticatedNyxCloudUser({get:()=> ''}),e=>e.status===401);
  Object.assign(context,{nyxRolePolicy:role=>({rank:{owner:100,admin:80,member:0}[role]}),nyxActorHasPermission:()=>true,nyxAssignableRolesForActor:()=>[]});
  vm.runInContext(declaration('nyxOwnerUserCapabilities'),context);
  assert.equal(context.nyxOwnerUserCapabilities({uid:'founder',role:'owner'},'member','member','founder').canManageAiAccess,true);
  assert.equal(context.nyxOwnerUserCapabilities({uid:'admin',role:'admin'},'member','member','founder').canManageAiAccess,false);
  assert.equal(context.nyxOwnerUserCapabilities({uid:'founder',role:'owner'},'owner','founder','founder').canManageAiAccess,false);
  assert.doesNotMatch(declaration('nyxAiAnalyzeImage'),/nyxBudgetedAiFetch|Groq/);
  await new Promise(resolve=>setTimeout(resolve,30));
  const keyStore=createKeyStore(db),issued=await keyStore.issue('late-api','fixture-school','API fixture');
  const apiResponse=await send(issued.key,{messages:[{role:'user',content:'Hi'}]}, {},'/api/v1/ai');
  assert.equal(apiResponse.status,200,await apiResponse.text());
  assert.equal((await keyStore.details('late-api')).balance,988,'Actual usage is charged to API balance');
  await new Promise(resolve=>setTimeout(resolve,30));
  const beforeApiPause=calls;balance=.10;
  assert.equal((await send(issued.key,{messages:[{role:'user',content:'Hi'}]}, {},'/api/v1/ai')).status,503);
  assert.equal(calls,beforeApiPause,'API must share the OpenRouter cutoff');
  assert.equal((await keyStore.details('late-api')).balance,988,'Balance cutoff before inference refunds API tokens');
  console.log('PASS: real AI middleware auth/origin, retired option rejection, OpenRouter routing, parallel capacity, slot release and unverified cloud authentication');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
