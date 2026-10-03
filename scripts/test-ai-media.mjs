import {storeMediaReservation,restoreMediaReservation} from '../lib/ai-media-reservation.mjs';
import assert from 'node:assert/strict';
import express from 'express';
import {unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {installAiMedia,videoPlan,imagePlan} from '../lib/ai-media.mjs';
import {createAiAllowance,aiAllowanceConfig} from '../lib/ai-allowance.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';
import {fullCatalogUid} from '../lib/ai-owner-catalog.mjs';

const video={id:'vendor/video',supported_durations:[8,4,6],supported_resolutions:['1080p','720p'],supported_aspect_ratios:['16:9'],supported_frame_images:['first_frame'],pricing_skus:{duration_seconds:'0.2'}};
assert.deepEqual(videoPlan(video,'hello').payload,{model:'vendor/video',prompt:'hello',duration:4,generate_audio:false,resolution:'720p',aspect_ratio:'16:9'});
assert.equal(videoPlan(video,'hello').estimate,.8);
assert.throws(()=>videoPlan({...video,supported_durations:null},'hello'));
assert.throws(()=>videoPlan({...video,pricing_skus:{}},'hello'));
const spec={id:'vendor/image',endpoints:[{provider_tag:'safe-provider',supported_parameters:{},pricing:[{billable:'output_image',unit:'image',cost_usd:.05}]}]};
assert.equal(imagePlan(spec,'hello').estimate,.05);
assert.equal(imagePlan(spec,'hello').payload.provider.allow_fallbacks,false);
assert.throws(()=>imagePlan(spec,'hello','data:image/png;base64,AAAA'));
assert.throws(()=>imagePlan({...spec,endpoints:[{...spec.endpoints[0],supported_parameters:{input_references:{min:1}}}]},'hello'));
const db=memoryFirestore(),config=aiAllowanceConfig({NYX_AI_DAILY_BUDGET_USD:'100'});
const allowance=createAiAllowance({db,config}),actor={uid:fullCatalogUid,owner:true,requestedModel:'vendor/video'};
const session=await allowance.begin(actor);
const reservation=await allowance.reserve(session,'shared',{model:actor.requestedModel,messages:[{role:'user',content:'hi'}],max_tokens:1},{inputPerMillion:0,outputPerMillion:0,requestUsd:1},{media:true});
assert.equal(session.refs.device,null);
const stored=storeMediaReservation(reservation);
assert.deepEqual(JSON.parse(JSON.stringify(stored)),stored,'Media jobs must persist without runtime references');
assert(!('device' in stored.session.refs));
const lookup=new Map(Object.values(session.refs).filter(Boolean).map(ref=>[ref.path,ref]));
const restored=restoreMediaReservation(stored,{doc:path=>lookup.get(path)});
await allowance.settle(restored,{input:0,output:0,cost:.3});
const account=(await session.refs.account.get()).data();assert.equal(account.money,300000,'Media settles to reported cost');
await allowance.finish(session,true);

const records=new Map();
const ref=id=>({get:async()=>({data:()=>records.get(id)}),set:async d=>records.set(id,d),update:async d=>records.set(id,{...records.get(id),...d})});
let calls=0,settled=0,charged=0,complete=false;
const app=express();app.use(express.json());
installAiMedia(app,{
 authorize:async req=>req.get('authorization')==='Bearer owner'?{uid:'owner',firebase:{firestore:{collection:()=>({doc:ref})}}}:null,
 catalog:async()=>[{id:'vendor/video',outputModalities:['video']},{id:'vendor/image',imageGeneration:true}],
 key:()=> 'never-expose-this',rateLimit:(req,res,next)=>next(),
 reserve:async()=>{charged++;return {stored:{test:true},accepted(){},settle:async()=>{settled++;}};},settleStored:async()=>{settled++;},
 request:async(url,options)=>{
   calls++;assert.equal(options.redirect,'error');assert(url.startsWith('https://openrouter.ai/api/v1/'));assert(!url.includes('never-expose-this'));
   if(url.endsWith('/images/models/vendor/image/endpoints'))return Response.json(spec);
   if(url.endsWith('/images')&&options.method==='POST')return Response.json({data:[{media_type:'image/png',b64_json:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='}],usage:{cost:.05}});
   if(url.endsWith('/videos/models'))return Response.json({data:[video]});
   if(url.endsWith('/videos')&&options.method==='POST'){assert.equal(JSON.parse(options.body).model,'vendor/video');return Response.json({id:'provider-job',status:'pending'},{status:202});}
   if(url.endsWith('/videos/provider-job'))return Response.json({status:complete?'completed':'in_progress',usage:{cost:.3}});
   if(url.endsWith('/content?index=0'))return new Response('test-video',{headers:{'content-type':'video/mp4'}});
   throw Error('Unexpected API request');
 }
});
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
try{
 const origin='http://127.0.0.1:'+server.address().port;
 const post=auth=>fetch(origin+'/api/nyx-ai/media',{method:'POST',headers:{'content-type':'application/json',authorization:auth},body:JSON.stringify({model:'vendor/video',message:'A forest'})});
 assert.equal((await post('Bearer other')).status,403);assert.equal(calls,0);assert.equal(charged,0);
 const response=await post('Bearer owner');assert.equal(response.status,202);const result=await response.json();assert(!JSON.stringify(result).includes('never-expose-this'));assert.equal(charged,1);
 const path=origin+'/api/nyx-ai/media/'+result.jobId,headers={authorization:'Bearer owner'};
 assert.equal((await fetch(path)).status,403);
 assert.equal((await fetch(path+'/content',{headers})).status,409);
 assert.equal((await(await fetch(path,{headers})).json()).status,'in_progress');
 complete=true;assert.equal((await(await fetch(path,{headers})).json()).status,'completed');assert.equal(settled,1);
 await fetch(path,{headers});assert.equal(settled,1,'Terminal polling does not re-charge');
 assert.equal(await(await fetch(path+'/content',{headers})).text(),'test-video');
 assert.equal((await fetch(origin+'/api/nyx-ai/media/not-a-job',{headers})).status,404);
 const imageResponse=await fetch(origin+'/api/nyx-ai/media',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({model:'vendor/image',message:'A forest'})});
 assert.equal(imageResponse.status,202);const imageJob=await imageResponse.json();assert.equal(imageJob.kind,'image');
 let imageState;for(let i=0;i<100;i++){imageState=await(await fetch(origin+'/api/nyx-ai/media/'+imageJob.jobId,{headers})).json();if(imageState.status!=='pending')break;await new Promise(r=>setTimeout(r,10));}
 assert.equal(imageState.status,'completed');
 const imageResult=await(await fetch(origin+'/api/nyx-ai/media/'+imageJob.jobId+'/content',{headers})).json();assert(imageResult.images[0].dataUrl.startsWith('data:image/png;base64,'));assert.equal(charged,2);
 await unlink(join(tmpdir(),'nyx-ai-generated-media',imageJob.jobId+'.json'));
 console.log('PASS owner-only media, validated plans/pricing, shared-budget settlement, persistent jobs, polling and authenticated content');
}finally{await new Promise(resolve=>server.close(resolve));}
