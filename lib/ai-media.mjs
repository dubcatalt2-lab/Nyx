import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { aiOutputImages } from './ai-output-images.mjs';

const base='https://openrouter.ai/api/v1/';
const failure=(message,status=400)=>Object.assign(new Error(message),{status});
const positive=value=>Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;

export function videoPlan(spec,prompt,image){
  const durations=(spec.supported_durations||[]).filter(n=>Number.isInteger(n)&&n>0&&n<=30);
  if(!durations.length)throw failure('This model needs a source video or specialized inputs. Open its OpenRouter page to use it.');
  const duration=Math.min(...durations);
  const resolutions=(spec.supported_resolutions||[]).filter(n=>/^\d+p$/.test(n)).sort((a,b)=>parseInt(a)-parseInt(b));
  const resolution=resolutions[0];
  const rates=[];
  for(const [name,value] of Object.entries(spec.pricing_skus||{})){
    const rate=positive(value);if(rate===null)throw failure('This video model has an unsupported price.',503);
    if(name.includes('duration_seconds'))rates.push(rate*duration);
    else if(name.startsWith('cents_per_')&&name.includes('second')&&!name.includes('megapixel'))rates.push(rate/100*duration);
    else if(name.startsWith('video_tokens')){
      // OpenRouter video-token pricing: width * height * frames / 1024.
      // Bound a 16:9 frame above the selected resolution at 30 fps.
      const height=resolution?parseInt(resolution):1080;
      rates.push(rate*Math.ceil(height*height*2*30*duration/1024));
    }
  }
  if(!rates.length)throw failure('This video model has no usable price yet.',503);
  const extras=Object.entries(spec.pricing_skus||{}).reduce((total,[name,value])=>total+(name==='reference_images'?Number(value):name==='cents_per_image_input'?Number(value)/100:0),0);
  const payload={model:spec.id,prompt,duration,generate_audio:false,...(resolution?{resolution}:{}),...(spec.supported_aspect_ratios?.includes('16:9')?{aspect_ratio:'16:9'}:{})};
  if(image){
    if(!spec.supported_frame_images?.includes('first_frame'))throw failure('This video model does not accept a first-frame image. Remove the attachment.');
    payload.frame_images=[{type:'image_url',image_url:{url:image},frame_type:'first_frame'}];
  }
  return {payload,estimate:Math.max(...rates)+extras};
}

export function imagePlan(spec,prompt,image){
  const candidates=(spec.endpoints||[]).filter(e=>e.provider_tag&&e.pricing?.length);
  for(const endpoint of candidates){
    const params=endpoint.supported_parameters||{};
    if(params.input_references?.min>1||(!image&&params.input_references?.min>0))continue;
    if(image&&!params.input_references)continue;
    if(params.output_format?.values&&!params.output_format.values.some(v=>['png','jpeg','webp'].includes(v)))continue;
    const payload={model:spec.id,prompt,n:1,provider:{only:[endpoint.provider_tag],allow_fallbacks:false}};
    if(params.resolution?.values?.length)payload.resolution=[...params.resolution.values].sort((a,b)=>parseFloat(a)-parseFloat(b))[0];
    if(params.aspect_ratio?.values?.includes('1:1'))payload.aspect_ratio='1:1';
    if(params.output_format?.values)payload.output_format=params.output_format.values.find(v=>['png','jpeg','webp'].includes(v));
    if(image)payload.input_references=[{type:'image_url',image_url:{url:image}}];
    let estimate=0,valid=true;
    for(const line of endpoint.pricing){
      const price=positive(line.cost_usd);
      if(price===null||!['image','megapixel','token'].includes(line.unit)){valid=false;break;}
      estimate+=price*(line.unit==='token'?65536:line.unit==='megapixel'?16:1);
    }
    if(valid)return {payload,estimate};
  }
  throw failure('This image model needs different inputs or an unsupported output format. Open its OpenRouter page for its full controls.');
}

export function installAiMedia(app,{authorize,catalog,key,reserve,settleStored,rateLimit,request=fetch}){
  const cache=new Map();
  const imageDirectory=join(tmpdir(),'nyx-ai-generated-media');
  const cleanup=setInterval(async()=>{
    for(const name of await readdir(imageDirectory).catch(()=>[])){
      if(!/^[a-f0-9-]{36}\.json$/.test(name))continue;
      const path=join(imageDirectory,name),info=await stat(path).catch(()=>null);
      if(info&&info.mtimeMs<Date.now()-86400000)await unlink(path).catch(()=>{});
    }
  },3600000);cleanup.unref();
  async function json(path,options={},limit=1024*1024){
    const response=await request(base+path,{...options,redirect:'error',signal:options.signal||AbortSignal.timeout(110000),headers:{accept:'application/json',...(options.body?{'content-type':'application/json'}:{}),authorization:`Bearer ${key()}`,...options.headers}});
    let size=0,text='';const decoder=new TextDecoder();
    for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw failure('The media response was too large.',502);text+=decoder.decode(chunk,{stream:true});}
    let data;try{data=JSON.parse(text+decoder.decode());}catch{throw failure('OpenRouter returned an invalid media response.',502);}
    if(!response.ok||data.error)throw failure('OpenRouter could not complete this media request. Check the model inputs, provider availability and account balance.',response.status>=400?response.status:502);
    return data;
  }
  async function spec(path){let entry=cache.get(path);if(!entry||entry.until<Date.now()){entry={data:await json(path),until:Date.now()+300000};cache.set(path,entry);}return entry.data;}
  async function owned(req){const actor=await authorize(req);if(!actor)throw failure('This media catalog is available only to the designated owner account.',403);return actor;}
  const wrap=fn=>async(req,res)=>{res.set('Cache-Control','private, no-store');try{await fn(req,res);}catch(error){if(!res.headersSent)res.status(error.status||503).json({error:error.message||'Media generation is unavailable.'});else res.destroy();}};
  app.post('/api/nyx-ai/media',rateLimit,wrap(async(req,res)=>{
    const actor=await owned(req);
    const models=await catalog(actor),model=models.find(item=>item.id===req.body?.model);
    const video=model?.outputModalities?.includes('video');
    if(!model||(!video&&!model.imageGeneration))throw failure('Choose an image or video generation model.');
    const prompt=typeof req.body?.message==='string'?req.body.message.trim():'';
    if(!prompt||prompt.length>4000)throw failure('Enter a prompt of 1–4,000 characters.');
    const image=req.body?.image?.dataUrl;
    if(image){aiOutputImages({choices:[{message:{images:[{image_url:{url:image}}]}}]});}
    const details=video?(await spec('videos/models')).data?.find(item=>item.id===model.id):await spec(`images/models/${model.id}/endpoints`);
    if(!details)throw failure('OpenRouter no longer lists this media model.',503);
    const plan=video?videoPlan(details,prompt,image):imagePlan(details,prompt,image);
    const billing=await reserve(req,plan.estimate);
    let sent=false;
    try{
      if(video){
        const localId=randomUUID(),ref=actor.firebase.firestore.collection('nyxAiMediaJobs').doc(localId);
        // Save the reservation first so an interrupted request cannot orphan billing.
        await ref.set({uid:actor.uid,model:model.id,createdAt:Date.now(),status:'submitting',reservation:billing.stored});
        sent=true;
        const result=await json('videos',{method:'POST',body:JSON.stringify(plan.payload)});
        if(!/^[a-zA-Z0-9_-]{1,200}$/.test(result.id||''))throw failure('OpenRouter did not return a video job ID.',502);
        await ref.update({providerId:result.id,status:'pending'});
        billing.accepted();
        res.status(202).json({jobId:localId,model:model.id,status:'pending',duration:plan.payload.duration,resolution:plan.payload.resolution||null});
      }else{
        const localId=randomUUID(),ref=actor.firebase.firestore.collection('nyxAiMediaJobs').doc(localId);
        await ref.set({uid:actor.uid,model:model.id,kind:'image',createdAt:Date.now(),status:'pending',reservation:billing.stored});
        billing.accepted();
        res.status(202).json({jobId:localId,model:model.id,status:'pending',kind:'image'});
        void (async()=>{
          try{
            const result=await json('images',{method:'POST',body:JSON.stringify(plan.payload),signal:AbortSignal.timeout(600000)},8*1024*1024);
            const images=aiOutputImages({choices:[{message:{images:(result.data||[]).map(item=>({image_url:{url:`data:${item.media_type||'image/png'};base64,${item.b64_json}`}}))}}]});
            if(!images.length)throw failure('OpenRouter returned no image.',502);
            await billing.settle(result.usage);
            await mkdir(imageDirectory,{recursive:true,mode:0o700});
            await writeFile(join(imageDirectory,localId+'.json'),JSON.stringify({model:model.id,images}),{mode:0o600});
            await ref.update({status:'completed',finishedAt:Date.now(),reservation:null});
          }catch{
            await billing.settle(null).catch(()=>{});
            await ref.update({status:'failed',finishedAt:Date.now(),reservation:null}).catch(()=>{});
          }
        })();
      }
    }catch(error){await billing.settle(null,!sent);throw error;}
  }));
  async function job(req){
    const actor=await owned(req);
    if(!/^[a-f0-9-]{36}$/.test(req.params.id))throw failure('Unknown video job.',404);
    const ref=actor.firebase.firestore.collection('nyxAiMediaJobs').doc(req.params.id),data=(await ref.get()).data();
    if(!data||data.uid!==actor.uid||(!data.providerId&&data.kind!=='image'))throw failure('Unknown media job.',404);
    return {actor,ref,data};
  }
  app.get('/api/nyx-ai/media/:id',wrap(async(req,res)=>{
    const {actor,ref,data}=await job(req);
    if(data.kind==='image'){
      const expired=Date.now()-data.createdAt>86400000||(data.status==='pending'&&Date.now()-data.createdAt>660000);
      return res.json({status:expired?'expired':data.status,model:data.model,kind:'image'});
    }
    if(['completed','failed','cancelled','expired'].includes(data.status))return res.json({status:data.status,model:data.model,kind:'video'});
    const result=await json(`videos/${encodeURIComponent(data.providerId)}`);
    const status=['pending','in_progress','completed','failed','cancelled','expired'].includes(result.status)?result.status:'pending';
    if(['completed','failed','cancelled','expired'].includes(status)){
      await settleStored(actor,data.reservation,result.usage);
      await ref.update({status,finishedAt:Date.now(),reservation:null});
    }
    res.json({status,model:data.model,kind:'video'});
  }));
  app.get('/api/nyx-ai/media/:id/content',wrap(async(req,res)=>{
    const {data}=await job(req);if(data.status!=='completed')throw failure('This video is not ready yet.',409);
    if(data.kind==='image'){
      if(Date.now()-data.createdAt>86400000)throw failure('This image has expired.',410);
      const body=await readFile(join(imageDirectory,req.params.id+'.json'),'utf8').catch(()=>null);
      if(!body)throw failure('This image is no longer stored on this server.',410);
      return res.type('application/json').send(body);
    }
    const response=await request(base+`videos/${encodeURIComponent(data.providerId)}/content?index=0`,{headers:{authorization:`Bearer ${key()}`},redirect:'error',signal:AbortSignal.timeout(120000)});
    if(!response.ok||!/^video\/(mp4|webm)(;|$)/i.test(response.headers.get('content-type')||''))throw failure('The video is unavailable or expired.',502);
    res.type(response.headers.get('content-type'));res.set('X-Content-Type-Options','nosniff');
    let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>100*1024*1024)throw failure('The video exceeds the download limit.',502);if(res.destroyed)break;if(!res.write(chunk))await new Promise(resolve=>{const done=()=>{res.off('drain',done);res.off('close',done);resolve();};res.once('drain',done);res.once('close',done);});}res.end();
  }));
}
