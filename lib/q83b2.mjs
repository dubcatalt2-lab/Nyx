import {matchMetingRecording} from './nyxify-meting.mjs';
const fail=(message,status=502)=>Object.assign(new Error(message),{status});
export function q83b2(meting,{fetchImpl=fetch}={}){
  const cache=new Map(),pending=new Map(),registered=new Map();
  let active=0;
  function put(map,key,value){map.delete(key);map.set(key,value);while(map.size>256)map.delete(map.keys().next().value);}
  async function api(path,params={}){
    const url=new URL('https://api.audius.co/v1'+path);
    for(const [key,value]of Object.entries({app_name:'N7X',...params}))url.searchParams.set(key,String(value));
    const response=await fetchImpl(url,{signal:AbortSignal.timeout(12000),redirect:'error',headers:{Accept:'application/json'}});
    if(!response.ok){await response.body?.cancel();throw fail('Audius lookup is unavailable.');}
    let size=0;const chunks=[];
    for await(const chunk of response.body){size+=chunk.length;if(size>2*1024*1024)throw fail('Audius response is too large.');chunks.push(chunk);}
    return JSON.parse(Buffer.concat(chunks).toString('utf8')).data;
  }
  async function audius(hints){
    const rows=await api('/tracks/search',{query:String(hints.title).slice(0,180)+' '+String(hints.artist).slice(0,120),limit:50});
    const candidates=(Array.isArray(rows)?rows:[]).filter(t=>/^[a-zA-Z0-9]{1,16}$/.test(t.id)&&t.is_streamable!==false&&!t.is_delete&&!t.is_stream_gated&&matchMetingRecording({name:t.title,artists:[{name:t.user?.name}],duration:Number(t.duration)*1000},hints));
    candidates.sort((a,b)=>Math.abs(a.duration-Number(hints.duration||a.duration))-Math.abs(b.duration-Number(hints.duration||b.duration)));
    const track=candidates[0];if(!track)throw fail('No matching Audius recording.',404);
    put(registered,track.id,Date.now()+3600000);
    return {mode:'meting',provider:'audius',title:track.title,durationSeconds:track.duration,streamUrl:'/api/nyxify/q83b2/'+track.id};
  }
  async function resolve(hints,{id='',prefetch=false}={}){
    const clean={title:String(hints.title||'').trim().slice(0,180),artist:String(hints.artist||'').trim().slice(0,120),duration:Number(hints.duration)||0};
    if(!clean.title||!clean.artist||clean.duration<0||clean.duration>14400)throw fail('Invalid song metadata.',400);
    const key=JSON.stringify([clean,id]);const old=cache.get(key);
    if(old?.until>Date.now())return structuredClone(old.value);
    if(pending.has(key))return pending.get(key);
    if(active>=(prefetch?1:4))throw fail('Music lookup is busy. Please retry.',503);
    active++;
    const task=(async()=>{
      const results=await Promise.allSettled([audius(clean),String(id).startsWith('netease:')?meting.resolveId(id.slice(8),clean,{prefetch}):meting.resolve(clean,{prefetch})]);
      const matches=results.flatMap((r,i)=>r.status==='fulfilled'?[{...r.value,provider:i===0?'audius':'meting'}]:[]);
      if(!matches.length)throw fail('Neither audio provider has a matching full recording.',404);
      matches.sort((a,b)=>Math.abs(a.durationSeconds-(clean.duration||a.durationSeconds))-Math.abs(b.durationSeconds-(clean.duration||b.durationSeconds)));
      const value={...matches[0],alternatives:matches.slice(1)};
      put(cache,key,{value,until:Date.now()+300000});return structuredClone(value);
    })().finally(()=>{active--;pending.delete(key);});
    pending.set(key,task);return task;
  }
  async function streamUrl(id){
    if(!/^[a-zA-Z0-9]{1,16}$/.test(String(id))||!(registered.get(id)>Date.now()))throw fail('Select this recording again.',404);
    const track=await api('/tracks/'+id);
    if(!track||track.is_streamable===false||track.is_stream_gated||track.is_delete)throw fail('This recording is unavailable.',404);
    return 'https://api.audius.co/v1/tracks/'+id+'/stream?app_name=N7X';
  }
  return {resolve,streamUrl};
}
