import {Worker} from 'node:worker_threads';
import {availableParallelism} from 'node:os';

export function compiler({workers=Math.min(2,availableParallelism()),limit=64*1024*1024,capacity=64,timeout=30000}={}) {
  const slots=Array.from({length:Math.max(1,workers)},()=>({worker:null,job:null}));
  const queue=[],cache=new Map();let bytes=0,cachedBytes=0,closed=false;
  function drop(key){const saved=cache.get(key);if(saved){cachedBytes-=saved.size;cache.delete(key);}}
  function remember(job,output){
    const size=2*(job.text.length+output.length+job.key.length),now=Date.now();
    if(size>32*1024*1024)return;
    for(const [key,saved]of cache)if(saved.expires<=now)drop(key);
    drop(job.key);
    while(cache.size&&(cache.size>=64||cachedBytes+size>32*1024*1024))drop(cache.keys().next().value);
    cache.set(job.key,{text:job.text,output,size,expires:now+300000});cachedBytes+=size;
  }
  function finish(slot,error,output){
    const job=slot.job;if(!job)return;
    slot.job=null;clearTimeout(job.timer);bytes-=job.size;
    if(error)job.reject(error);
    else {remember(job,output);job.resolve(output);}
    drain();
  }
  function launch(slot){
    const worker=new Worker(new URL('./compiler-worker.mjs',import.meta.url),{resourceLimits:{maxOldGenerationSizeMb:192,maxYoungGenerationSizeMb:16}});
    slot.worker=worker;
    worker.on('message',value=>{
      if(slot.worker!==worker)return;
      const error=value.error?Object.assign(new Error(value.error.message),{name:value.error.name}):null;
      finish(slot,error,value.output);
    });
    const failed=()=>{
      if(slot.worker!==worker)return;
      slot.worker=null;void worker.terminate();finish(slot,new Error('Document compiler stopped'));drain();
    };
    worker.on('error',failed);worker.on('exit',failed);
  }
  function drain(){
    if(closed)return;
    for(const slot of slots){
      if(slot.job||!queue.length)continue;
      if(!slot.worker)launch(slot);
      const job=slot.job=queue.shift();
      job.timer=setTimeout(()=>{
        const worker=slot.worker;slot.worker=null;void worker.terminate();finish(slot,new Error('Document compilation timed out'));
      },timeout);
      slot.worker.postMessage({kind:job.kind,text:job.text,base:job.base,prefix:job.prefix,mode:job.mode});
    }
  }
  for(const slot of slots)launch(slot);
  return {
    compile(kind,text,base,prefix,mode){
      if(closed)return Promise.reject(new Error('Document compiler closed'));
      const key=JSON.stringify([kind,base,prefix,mode]),saved=cache.get(key);
      if(saved&&saved.expires>Date.now()&&saved.text===text){cache.delete(key);cache.set(key,saved);return Promise.resolve(saved.output);}
      const size=2*text.length;
      if(bytes+size>limit||queue.length+slots.filter(slot=>slot.job).length>=capacity)return Promise.reject(new Error('Document compiler busy'));
      return new Promise((resolve,reject)=>{
        bytes+=size;
        const job={key,kind,text,base,prefix,mode,size,resolve,reject};
        // Stylesheets block the first styled paint; serve waiting styles first.
        const before=kind==='css'?queue.findIndex(value=>value.kind!=='css'):-1;
        if(before<0)queue.push(job);else queue.splice(before,0,job);
        drain();
      });
    },
    async close(){
      closed=true;cache.clear();cachedBytes=0;
      for(const job of queue.splice(0)){bytes-=job.size;job.reject(new Error('Document compiler closed'));}
      await Promise.all(slots.map(async slot=>{finish(slot,new Error('Document compiler closed'));if(slot.worker){const worker=slot.worker;slot.worker=null;await worker.terminate();}}));
    }
  };
}
