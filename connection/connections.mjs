import {Agent} from 'undici';

export function connections({capacity=32,idle=15000}={}){
  const entries=new Map();let closed=false;
  const remove=key=>{const entry=entries.get(key);if(entry){entries.delete(key);void entry.dispatcher.destroy().catch(()=>{});}};
  const sweep=setInterval(()=>{
    for(const [key,entry]of entries)if(!entry.active&&Date.now()-entry.used>=idle)remove(key);
  },idle);
  sweep.unref();
  return {
    acquire({url,address,addresses=[address]}){
      if(closed)throw new Error('Document connections closed');
      // Reuse is limited to the exact origin and freshly validated address set.
      const key=JSON.stringify([url.origin,addresses.map(value=>[value.address,value.family]).sort()]);
      let entry=entries.get(key);
      if(!entry){
        if(entries.size>=capacity){
          const unused=[...entries].filter(([,value])=>!value.active).sort((a,b)=>a[1].used-b[1].used)[0];
          if(!unused)throw new Error('Document connections busy');
          remove(unused[0]);
        }
        const dispatcher=new Agent({connections:6,pipelining:1,keepAliveTimeout:idle,keepAliveMaxTimeout:idle,
          connect:{autoSelectFamily:true,lookup:(_host,options,callback)=>options?.all?callback(null,addresses):callback(null,address.address,address.family)}});
        entry={dispatcher,active:0,used:Date.now()};entries.set(key,entry);
      }
      entry.active++;
      let released=false;
      return {dispatcher:entry.dispatcher,release(){if(!released){released=true;entry.active--;entry.used=Date.now();}}};
    },
    async close(){closed=true;clearInterval(sweep);const current=[...entries.values()];entries.clear();await Promise.all(current.map(value=>value.dispatcher.destroy().catch(()=>{})));}
  };
}
