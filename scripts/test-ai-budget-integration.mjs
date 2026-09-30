import {createNookDeveloper} from '../lib/nook-developer.mjs';
import {isNookRequest} from '../lib/nook-policy.mjs';
import {hasAppAiAllowance,dropModelIsExpensive} from '../lib/ai-allowance.mjs';
import {recordAiExchange,readAiActivity} from '../lib/ai-history.mjs';
import {isFreeAiModel} from '../lib/ai-free-models.mjs';
import {hasFullAiCatalog,aiCatalogPrice,fullCatalogUid} from '../lib/ai-owner-catalog.mjs';
import {installDeveloperApi,createKeyStore,GEMINI} from '../lib/developer-api.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {AsyncLocalStorage} from 'node:async_hooks';
import express from 'express';
import {parse} from 'acorn';
import {memoryFirestore} from './test-ai-allowance.mjs';
import {aiAllowanceConfig,createAiAllowance,premiumModelLimits} from '../lib/ai-allowance.mjs';
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
const environment={NYX_AI_CONCURRENT_GLOBAL:3,NYX_OPENROUTER_API_KEY:'fixture-inference',NYX_OPENROUTER_MANAGEMENT_KEY:'fixture-management',NYX_AI_DAILY_BUDGET_USD:'1',NYX_AI_MODEL_PRICES_JSON:JSON.stringify({'shared:google/gemini-fixture':{inputPerMillion:1,outputPerMillion:2},['shared:'+GEMINI]:{inputPerMillion:.1,outputPerMillion:.4},'groq:test':{inputPerMillion:1,outputPerMillion:2}})};
const context=vm.createContext({isNookRequest,hasAppAiAllowance,dropModelIsExpensive,recordAiExchange,isFreeAiModel,hasFullAiCatalog,aiCatalogPrice,app,AsyncLocalStorage,aiAllowanceConfig,createAiAllowance,premiumModelLimits,aiBudgetResponse,
  process:{env:environment},AbortController,AbortSignal,URL,Headers,setTimeout,clearTimeout,
  createOpenRouterBalanceGuard:options=>createOpenRouterBalanceGuard({...options,fetchImpl:async url=>new Response(JSON.stringify({data:url.endsWith('/credits')?{total_credits:balance,total_usage:0}:{limit_remaining:null}}))}),
  authenticatedNyxUser:async req=>{const uid=req.get('authorization')?.replace('Bearer ','');if(!uid)throw Object.assign(new Error('Auth required'),{status:401});return {firebase,token:{uid,email_verified:false}};},

  founderProfileConfig:()=>({administratorUid:'owner'}),nyxClientIp:()=> 'school-network',
  sameOriginRequest:req=>req.get('sec-fetch-site')!=='cross-site',
  nyxRoleForUser:(uid,admin={})=>uid==='owner'?'owner':admin.role||'member',hasPremiumSubscription:value=>value==='premium',normalizeSubscriptionStatus:value=>value,
  fetch:async(_url,options)=>{calls++;lastPayload=JSON.parse(options.body);
    if(hold)await Promise.race([hold,new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}))]);
    return new Response(JSON.stringify({choices:[{message:{content:'hello'}}],usage:{prompt_tokens:10,completion_tokens:2,cost:0.000014}}),{headers:{'content-type':'application/json'}});
  }
});
vm.runInContext(source.slice(source.indexOf('const nyxAiBudgetContext ='),source.indexOf('async function nyxAiRateLimit')),context);
vm.runInContext(['nyxAiKey','nyxAiEndpoint','nyxAiCatalogEndpoint','nyxAiSharedProvider','nyxAiGlobalProvider','nyxAiRequestCredential'].map(declaration).join('\n'),context);
vm.runInContext(declaration('nyxAiProviderFetch')+'\n'+declaration('authenticatedNyxCloudUser'),context);
installDeveloperApi(app,{nook:createNookDeveloper({allowance:context.nyxSharedAiAllowance,catalog:actor=>context.nyxAiAvailableModels('',false,null,actor),configured:()=>true,send:(req,payload)=>context.nyxBudgetedAiFetch('shared','https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{authorization:'Bearer fixture-inference'},body:JSON.stringify(payload)})}),firebase:async()=>firebase,authenticate:context.authenticatedNyxUser,ownerUid:()=> 'owner',passwordHash:()=>'',sameOrigin:()=>true,device:async()=> 'browser',configured:()=>true,page:(_req,res)=>res.send('API'),send:async(req,payload)=>context.nyxBudgetedAiFetch('shared','https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{authorization:'Bearer fixture-inference'},body:JSON.stringify(payload)})});
for(const path of ['/api/nyx-ai'])app.post(path,async(req,res)=>{
  try {
    if(path==='/api/v1/ai')return res.status(410).json({error:'Retired'});
    const credential=context.nyxAiRequestCredential(req);
    if(credential.invalid||credential.invalidProvider)return res.status(410).json({error:'Removed'});
    const options={method:'POST',headers:{authorization:'Bearer fixture-inference'},body:JSON.stringify({model:req.body.model||'google/gemini-fixture',max_tokens:1000,messages:[{role:'user',content:'Hi'}]})};
    let response=await context.nyxAiProviderFetch({id:'shared'},'https://openrouter.ai/api/v1/chat/completions',options);
    if(req.body.repair){await response.json();response=await context.nyxAiProviderFetch({id:'shared'},'https://openrouter.ai/api/v1/chat/completions',options);}
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
  assert.equal((await send('unpriced',{model:'google/gemini-unpriced'})).status,503);assert.equal(calls,0);
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
  assert.equal((await send('late-approved',{model:'openai/gpt-5.6-luna'})).status,403,'Owner trust or a profile date cannot bypass actual Firebase creation time');
  assert.equal((await send('late-member',{model:'openai/gpt-5.6-luna'}, {'x-nyx-premium':'true'})).status,403,'Browser headers cannot grant Premium');
  assert.equal(calls,beforeEligibility,'Ineligible requests must not contact inference');
  db.records.set('nyxUserAdministration/late-premium',{subscriptionStatus:'premium'});
  assert.equal((await send('late-premium')).status,200,'Server-authorized Premium qualifies after cutoff');
  db.records.set('nyxUserAdministration/late-coowner',{role:'co_owner'});
  assert.equal((await send('late-coowner')).status,200,'Server-verified co-owner has priority access');
  assert.equal((await send('late-spoof',{model:'openai/gpt-5.6-luna'}, {'x-nyx-role':'co_owner'})).status,403,'Browser headers cannot grant co-owner priority');
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
  balance=1;await new Promise(resolve=>setTimeout(resolve,30));
  const repairCalls=calls,chargedBefore=[...db.records.values()].reduce((sum,row)=>sum+(row.tokens&&typeof row.tokens==='number'?row.tokens:0),0);
  const repaired=await send('repair-member',{repair:true});assert.equal(repaired.status,200);await repaired.text();
  await new Promise(resolve=>setTimeout(resolve,30));assert.equal(calls,repairCalls+2);assert.equal(lastPayload.max_tokens,700);
  const chargedAfter=[...db.records.values()].reduce((sum,row)=>sum+(row.tokens&&typeof row.tokens==='number'?row.tokens:0),0);assert.equal(chargedAfter-chargedBefore,24,'Both provider calls must be charged');assert.equal(db.records.get('nyxAiAllowance/global').slots.length,0);
  const freeResponse=await send('late-free-catalog',{model:'nvidia/nemotron-3-ultra-550b-a55b:free'});
  assert.equal(freeResponse.status,200);await freeResponse.text();
  assert.equal(lastPayload.provider.sort,'latency');
  assert.deepEqual(lastPayload.provider.max_price,{prompt:0,completion:0,request:0});
  for(const [uid,body,saved] of [
    ['history-member',{historyNoticeVersion:1,message:'Visible fixture question'},true],
    ['temporary-member',{historyNoticeVersion:1,temporaryChat:true,message:'Temporary secret'},false],
    ['old-client',{message:'Old client secret'},false]
  ]) {
    const reply=await send(uid,{model:'openrouter/free',...body});assert.equal(reply.status,200);await reply.text();
    const activity=await readAiActivity(db,uid);assert.equal(activity.entries.length,saved?1:0);assert.equal(activity.models['openrouter/free'].requests,1);
    if(saved){assert.equal(activity.entries[0].prompt,body.message);assert.equal(activity.entries[0].answer,'hello');}
    await new Promise(resolve=>setTimeout(resolve,30));
  }
  context.founderProfileConfig=()=>({administratorUid:fullCatalogUid});
  context.nyxAiAvailableModels=async()=>[{id:'openai/gpt-6-astra',pricing:{prompt:'.00001',completion:'.00005'}},{id:'new-vendor/new-chat',pricing:{prompt:'.000002',completion:'.000003'}}];
  balance=.01;
  for(const model of ['openai/gpt-6-astra','new-vendor/new-chat']){
    const reply=await send(fullCatalogUid,{model});assert.equal(reply.status,200,await reply.text());
    assert.equal(lastPayload.model,model);
    assert.equal(lastPayload.provider.max_price,undefined,'Exact UID avoids Nyx provider-price caps');
    await new Promise(resolve=>setTimeout(resolve,30));
  }
  const beforeUnknown=calls;
  assert.equal((await send(fullCatalogUid,{model:'unpriced/unknown'})).status,503);
  assert.equal(calls,beforeUnknown,'Unknown catalog price must never reach paid inference');
  balance=100;
  const dropReply=await send('drop-route',{model:'new-vendor/new-chat'},{},'/api/drop-ai');
  assert.equal(dropReply.status,200,await dropReply.text());
  assert.equal(lastPayload.model,'new-vendor/new-chat');
  assert.equal((await send('spoof-drop',{model:'new-vendor/new-chat',app:'drop'},{'x-app':'drop'})).status,403);
  const beforeDropUnknown=calls;
  assert.equal((await send('drop-unpriced',{model:'unpriced/unknown'},{},'/api/drop-ai')).status,503);
  assert.equal(calls,beforeDropUnknown);
  db.records.set('nyxUserAdministration/nook-route',{aiAccess:'trusted'});
  const nookReply=await send('nook-route',{model:'new-vendor/new-chat'},{},'/api/nook-ai');assert.equal(nookReply.status,200,await nookReply.text());assert.match(nookReply.headers.get('set-cookie'),/nook_device=/);
  assert([...db.records.keys()].some(k=>k.includes('nook-device-')));
  assert.equal((await send('spoof-nook',{model:'new-vendor/new-chat',app:'nook'},{'x-app':'nook'})).status,403);

  const cookie=nookReply.headers.get('set-cookie').split(';')[0];
  const keyResponse=await send('nook-route',{label:'Nook test'},{cookie},'/api/nook-developer/keys');
  assert.equal(keyResponse.status,200,await keyResponse.clone().text());const {key:nookKey}=await keyResponse.json();
  const nookStore=createKeyStore(db),keyRecord=await nookStore.authenticate(nookKey);
  assert.equal(keyRecord.app,'nook');assert(keyRecord.device);
  const info=await (await fetch(origin+'/api/nook-developer/me',{headers:{authorization:'Bearer nook-route',cookie}})).json();
  assert.equal(info.key.app,'nook');assert(info.models.includes('new-vendor/new-chat'));assert(info.models.includes('openai/gpt-6-astra'));
  assert.equal(info.usage.total.used,12);assert.equal(info.usage.expensive.used,0);
  const keyReply=await send(nookKey,{model:'openai/gpt-6-astra',messages:[{role:'user',content:'Hi'}],max_tokens:400},{cookie:'nook_device=forged',device:'forged'},'/api/v1/ai');
  assert.equal(keyReply.status,200,await keyReply.clone().text());await keyReply.text();
  await new Promise(resolve=>setTimeout(resolve,30));
  const after=await (await fetch(origin+'/api/nook-developer/me',{headers:{authorization:'Bearer nook-route',cookie}})).json();
  assert.equal(after.usage.total.used,24,'Key and chat must share the original device counter despite forged cookies');assert.equal(after.usage.expensive.used,12);
  assert.equal((await nookStore.details('nook-route')).balance,1000,'No second legacy balance is charged');
  const earlierCalls=calls;const denied=await send(nookKey,{model:'invented/model',messages:[{role:'user',content:'Hi'}]}, {},'/api/v1/ai');assert.equal(denied.status,403);assert.equal(calls,earlierCalls);
  const deviceDoc=[...db.records.keys()].find(k=>k.startsWith('nyxAiAllowance/nook-device-')&&db.records.get(k).pool?.used===24);assert(deviceDoc);
  const savedPool=structuredClone(db.records.get(deviceDoc));db.records.get(deviceDoc).pool.used=7000;
  assert.equal((await send(nookKey,{model:'new-vendor/new-chat',messages:[{role:'user',content:'Hi'}]}, {},'/api/v1/ai')).status,429);assert.equal(calls,earlierCalls);
  db.records.set(deviceDoc,savedPool);db.records.get(deviceDoc).pool.expensiveUsed=1000;
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal((await send(nookKey,{model:'openai/gpt-6-astra',messages:[{role:'user',content:'Hi'}]}, {},'/api/v1/ai')).status,429);assert.equal(calls,earlierCalls);
  await nookStore.revoke('nook-route');assert.equal((await send(nookKey,{model:'new-vendor/new-chat',messages:[{role:'user',content:'Hi'}]}, {},'/api/v1/ai')).status,401);
  console.log('PASS Nook key catalog, shared chat/device pools, expensive subset, forged-cookie isolation, depletion and revocation');
  console.log('PASS: real AI middleware auth/origin, OpenRouter routing, UID catalog pricing, parallel capacity, slot release and unverified cloud authentication');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
