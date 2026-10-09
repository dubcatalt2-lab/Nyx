import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {aiModelAllowed,nookModelIsExpensive} from './ai-allowance.mjs';
import {hasFullAiCatalog,aiCatalogPrice} from './ai-owner-catalog.mjs';
const fail=(message,status=400)=>Object.assign(Error(message),{status});

// Both catalog checks and inference use current account policy, never privileges
// cached at key issuance. The signed workspace identity is bound server-side.
export function createNookDeveloper({allowance,catalog,send,configured}){
 const device=(req,res,firebase)=>allowance(firebase).device(req,res,{cookieName:'nook_device',maxAge:31536000});
 async function actor(u){
  const admin=(await u.firebase.firestore.collection('nyxUserAdministration').doc(u.uid).get()).data()||{};
  return {uid:u.uid,app:'nook',owner:u.owner,premium:u.premium,modelRules:admin.aiModelRules||[],blocked:admin.aiAccess==='restricted'};
 }
 async function models(u){const who=await actor(u),available=await catalog(who);if(!available.length)throw fail('The model list is temporarily unavailable. Please retry shortly.',503);return available.filter(m=>aiModelAllowed(m.id,who,aiCatalogPrice(m)));}
 async function details(req,res,u){
  const who=await actor(u),saved=await u.store.details(u.uid),current=await device(req,res,u.firebase);
  const bound=saved.nookDevice||current;
  const available=await models(u);
  const currentUsage=bound!==current?await allowance(u.firebase).nookUsage({...who,device:current}):null;
  return {uid:u.uid,configured:configured(),key:saved.key,unlimited:hasFullAiCatalog(who),
   models:available.map(m=>m.id),catalog:available.map(m=>({...m,expensive:aiCatalogPrice(m)?nookModelIsExpensive(aiCatalogPrice(m)):null})),
   usage:await allowance(u.firebase).nookUsage({...who,device:bound}),
   currentWorkspaceUsage:currentUsage,currentB\u0072owserUsage:currentUsage,
   keyUsesCurrentWorkspace:bound===current,keyUsesCurrentB\u0072owser:bound===current};
 }
 async function complete(req,res,u){
  const b=req.body||{},available=await models(u),selected=available.find(m=>m.id===b.model);
  if(!selected)throw fail('Choose a model available to your Nook account.',403);
  if(!Array.isArray(b.messages)||!b.messages.length||b.messages.length>24||Buffer.byteLength(JSON.stringify(b.messages))>300000||b.messages.some(m=>!m||!['system','user','assistant'].includes(m.role)||(typeof m.content!=='string'&&!Array.isArray(m.content))))throw fail('Send 1–24 chat messages under 300 KB.');
  if(b.max_tokens!==undefined&&(!Number.isSafeInteger(b.max_tokens)||b.max_tokens<1||b.max_tokens>65536))throw fail('max_tokens must be between 1 and 65536. Your account output cap still applies.');
  if(b.stream!==undefined&&typeof b.stream!=='boolean')throw fail('stream must be true or false.');
  if(b.tools||b.functions||b.n&&b.n!==1)throw fail('Tool calls and multiple completions are not supported.');
  const payload={model:selected.id,messages:b.messages.map(({role,content})=>({role,content})),max_tokens:b.max_tokens||1200,stream:b.stream===true};
  if(b.temperature!==undefined){if(typeof b.temperature!=='number'||b.temperature<0||b.temperature>2)throw fail('temperature must be between 0 and 2.');payload.temperature=b.temperature;}
  if(b.reasoning?.effort){if(!['none','minimal','low','medium','high','xhigh'].includes(b.reasoning.effort))throw fail('Invalid reasoning effort.');payload.reasoning={effort:b.reasoning.effort};}
  if(b.modalities!==undefined){if(!Array.isArray(b.modalities)||b.modalities.some(m=>!['text','image','audio'].includes(m)))throw fail('Invalid output modalities.');payload.modalities=b.modalities;}
  if(b.audio!==undefined){if(!/^[\w-]{1,64}$/.test(b.audio?.voice||'')||!['wav','mp3','pcm16','opus','flac','aac'].includes(b.audio?.format))throw fail('Invalid audio settings.');payload.audio={voice:b.audio.voice,format:b.audio.format};}
  req.nyxAiApp='nook';req.nyxAiBilling={firebase:u.firebase,uid:u.uid,device:u.key.device};
  const response=await send(req,payload);
  if(!response.ok){await response.body?.cancel();throw fail('The model provider could not complete this request. Try again shortly.',response.status===429?429:503);}
  if(payload.stream&&response.headers.get('content-type')?.includes('text/event-stream')){
   res.set({'Content-Type':'text/event-stream','X-Accel-Buffering':'no'});await pipeline(Readable.fromWeb(response.body),res);return;
  }
  const result=await response.json();if(result.error)throw fail('The model provider could not complete this request.',503);
  res.json(result);
 }
 return {device,details,models,send:complete};
}
