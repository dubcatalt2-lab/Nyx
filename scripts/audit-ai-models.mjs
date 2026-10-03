// Read-only provider/capability audit. This does not generate billable content.
import {mkdir,writeFile} from 'node:fs/promises';
import {imagePlan,videoPlan} from '../lib/ai-media.mjs';
import {supportsConversationVoice} from '../apps/agents/voice-capabilities.js';
const base='https://openrouter.ai/api/v1/';
async function get(path){
 const response=await fetch(base+path,{headers:{accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('HTTP '+response.status);
 return response.json();
}
const [catalog,images,videos]=await Promise.all(['models?output_modalities=all','images/models','videos/models'].map(get));
const imageIds=new Set(images.data.map(m=>m.id)),videoSpecs=new Map(videos.data.map(m=>[m.id,m]));
let next=0;const results=[];
async function worker(){for(;;){const index=next++;if(index>=catalog.data.length)return;const model=catalog.data[index],out=model.architecture?.output_modalities||['text'];
 const row={id:model.id,inputs:model.architecture?.input_modalities||[],outputs:out,generationTested:false};
 if(model.id.endsWith(':batch'))row.path='Batch API (not interactive chat)';
 else if(out.includes('video'))row.path='Owner video generation';
 else if(out.includes('image'))row.path='Image generation';
 else if(supportsConversationVoice({id:model.id,outputModalities:out}))row.path='Native voice chat';
 else if(out.includes('audio'))row.path='Music; not conversational voice';
 else if(out.includes('text'))row.path='Text chat / coding';
 else row.path='Specialized API; not conversational chat';
 try{
  const details=await get('models/'+model.id.split('/').map(encodeURIComponent).join('/')+'/endpoints');
  row.providers=details.data?.endpoints?.length||0;row.availability=row.providers?'Providers listed':'No providers listed';
 }catch(error){row.availability=error.message;}
 if(out.includes('image')&&imageIds.has(model.id))try{
  const details=await get('images/models/'+model.id.split('/').map(encodeURIComponent).join('/')+'/endpoints');
  const plan=imagePlan(details,'A blue circle');row.imagePlan={supported:true,estimateUsd:plan.estimate};
 }catch(error){row.imagePlan={supported:false,reason:error.message};}
 if(out.includes('video'))try{const spec=videoSpecs.get(model.id);if(!spec)throw Error('Absent from video catalog');const plan=videoPlan(spec,'A blue circle');row.videoPlan={supported:true,estimateUsd:plan.estimate};}catch(error){row.videoPlan={supported:false,reason:error.message};}
 results[index]=row;
 if(results.filter(Boolean).length%100===0)console.log('Audited '+results.filter(Boolean).length+' models');
 await new Promise(resolve=>setTimeout(resolve,100));
}}
await Promise.all(Array.from({length:4},worker));
const byPath={};for(const row of results)byPath[row.path]=(byPath[row.path]||0)+1;
const report={checkedAt:new Date().toISOString(),total:results.length,byPath,providersListed:results.filter(r=>r.providers>0).length,unavailable:results.filter(r=>!r.providers).map(r=>({id:r.id,status:r.availability})),unsupportedPlans:results.filter(r=>r.imagePlan?.supported===false||r.videoPlan?.supported===false),results};
await mkdir('.codex-artifacts',{recursive:true});
await writeFile('.codex-artifacts/ai-model-audit.json',JSON.stringify(report,null,2));
await writeFile('.codex-artifacts/ai-model-audit.md','# AI model audit\n\nChecked '+report.checkedAt+'. This is a read-only catalog and route audit, not proof that each model generated a response.\n\n'+Object.entries(byPath).map(([path,count])=>`- ${path}: ${count}`).join('\n')+'\n\n| Model | Route | Provider availability |\n|---|---|---|\n'+results.map(r=>`| ${r.id} | ${r.path} | ${r.availability} |`).join('\n')+'\n');
console.log(JSON.stringify({...report,results:undefined}));
