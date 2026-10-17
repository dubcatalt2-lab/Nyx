import {isFreeAiModel} from './ai-free-models.mjs';
export function createFreeModelHealth({fetchImpl=(...args)=>fetch(...args),now=()=>Date.now()}={}){
 const blocked=new Map();
 const available=id=>!blocked.has(id)||blocked.get(id)<=now();
 return {available,
  failure(id,status,data){
   if(!isFreeAiModel(id))return null;
   const embedded=Number(data?.error?.code),http=Number(status);
   const code=Number.isInteger(embedded)&&embedded>=400&&embedded<=599?embedded:Number.isInteger(http)&&http>=400&&http<=599?http:502;
   const outage=[404,500,502,503,504].includes(code);
   if(outage)blocked.set(id,now()+300000);
   const message=outage?'This free model\'s provider is temporarily unavailable. Choose another free model or try again in five minutes.'
    :code===429?'This free model\'s provider is rate-limiting requests. Wait a little and try again, or choose another free model.'
    :'This free model\'s provider rejected the request. Try a shorter text-only message or choose another free model.';
   return Object.assign(new Error(message),{status:code,code:'free_ai_provider'});
  },
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
