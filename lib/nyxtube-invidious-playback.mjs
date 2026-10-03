import {invidiousEmbedOrigin} from './nyxtube-invidious.mjs';

const fail=(message,status=503)=>Object.assign(new Error(message),{status});
const decode=value=>value.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'");
export function invidiousPlaybackSource(html,id,origin){
  const data=html.match(/<script\s+id="video_data"[^>]*>([\s\S]*?)<\/script>/i);
  let video;try{video=JSON.parse(data?.[1]);}catch{throw fail('The video service did not return a player.');}
  if(video.id!==id||video.live_now||!(video.length_seconds>0))throw fail('This video is unavailable.',422);
  for(const tag of html.match(/<source\b[^>]*>/gi)||[]){
    const src=tag.match(/\bsrc="([^"]+)"/i)?.[1],type=tag.match(/\btype="([^"]+)"/i)?.[1];
    if(!src||!type?.startsWith('video/mp4'))continue;
    const url=new URL(decode(src),origin),base=new URL(origin);
    const host=url.hostname===base.hostname||url.hostname.endsWith('.companion.'+base.hostname);
    if(url.protocol!=='https:'||url.username||url.password||url.port||!host)continue;
    if(!['/latest_version','/companion/latest_version'].includes(url.pathname)||url.searchParams.get('id')!==id||url.searchParams.get('local')!=='true')continue;
    return {id,url:url.href,type:'video/mp4',duration:video.length_seconds};
  }
  throw fail('A playable video stream is unavailable.');
}

// Resolve only an operator-configured public player. Never relay arbitrary URLs,
// scripts, cookies or video bytes. Clients stream from its existing media proxy.
export function createInvidiousPlayback({env=process.env,fetch:request=fetch,now=Date.now}={}){
  const cache=new Map(),inflight=new Map(),controllers=new Set();let closed=false;
  async function resolve(id,{refresh=false}={}){
    if(!/^[A-Za-z0-9_-]{11}$/.test(id))throw fail('Choose a valid video.',400);
    const origin=invidiousEmbedOrigin(env);
    if(!origin||closed)throw fail('The video service is unavailable.');
    const saved=cache.get(id);if(!refresh&&saved?.expires>now())return saved.value;
    if(inflight.has(id))return inflight.get(id);
    if(inflight.size>=4)throw fail('The video service is busy. Retrying shortly.',429);
    const controller=new AbortController();controllers.add(controller);
    const timer=setTimeout(()=>controller.abort(),10000);
    const task=(async()=>{
      const url=new URL('/embed/'+id,origin);url.search=new URLSearchParams({local:'true',quality:'medium',hl:'en-US'}).toString();
      const response=await request(url,{signal:controller.signal,redirect:'error',headers:{Accept:'text/html'}});
      if(!response.ok){await response.body?.cancel();throw fail('The video service could not load this video.',response.status===429?429:503);}
      if(!response.headers.get('content-type')?.includes('text/html')){await response.body?.cancel();throw fail('Unexpected video service response.');}
      const chunks=[];let bytes=0;
      for await(const chunk of response.body){bytes+=chunk.length;if(bytes>512*1024){controller.abort();throw fail('Unexpected video service response.');}chunks.push(chunk);}
      const value=invidiousPlaybackSource(Buffer.concat(chunks).toString('utf8'),id,origin);
      cache.delete(id);cache.set(id,{value,expires:now()+30000});
      while(cache.size>64)cache.delete(cache.keys().next().value);
      return value;
    })().catch(error=>{cache.delete(id);throw error.status?error:fail('The video service could not be reached.');}).finally(()=>{clearTimeout(timer);controllers.delete(controller);inflight.delete(id);});
    inflight.set(id,task);return task;
  }
  return {resolve,close(){closed=true;for(const c of controllers)c.abort();cache.clear();}};
}
