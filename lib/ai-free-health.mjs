import {isFreeAiModel} from './ai-free-models.mjs';
export function createFreeModelHealth({fetchImpl=(...args)=>fetch(...args),now=()=>Date.now()}={}){
 const blocked=new Map();
 const available=id=>!blocked.has(id)||blocked.get(id)<=now();
 return {available,
  failure(id,status){if(isFreeAiModel(id)&&[404,502,503,504].includes(Number(status)))blocked.set(id,now()+300000);},
  async filter(models){
   await Promise.all(models.filter(m=>isFreeAiModel(m.id)&&m.id!=='openrouter/free').map(async model=>{
    try{
     const response=await fetchImpl('https://openrouter.ai/api/v1/models/'+model.id+'/endpoints',{signal:AbortSignal.timeout(2000)});
     if(!response.ok)return;
     const data=await response.json();const endpoints=data.data?.endpoints;if(!Array.isArray(endpoints))return;
     const usable=endpoints.some(e=>(e.status===undefined||e.status===0)&&Number(e.pricing?.prompt)===0&&Number(e.pricing?.completion)===0);
     if(!usable)blocked.set(model.id,now()+300000);
    }catch{/* A failed health lookup is not evidence that inference is down. */}
   }));
   return models.filter(m=>available(m.id));
  }
 };
}
