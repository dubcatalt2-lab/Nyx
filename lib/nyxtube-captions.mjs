const LIMIT = 8 * 1024 * 1024;

export function captionSegments(payload) {
  const segments=[];let characters=0;
  for(const event of Array.isArray(payload?.events)?payload.events:[]){
    const text=(Array.isArray(event.segs)?event.segs:[]).map(s=>String(s.utf8||'')).join('').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').trim().slice(0,500);
    const start=Number(event.tStartMs)/1000,duration=Number(event.dDurationMs)/1000;
    if(!text||!Number.isFinite(start)||start<0||!Number.isFinite(duration)||duration<=0)continue;
    characters+=text.length;
    if(segments.length>=30000||characters>1000000)throw new Error('Caption track exceeds the supported size.');
    segments.push({startSeconds:start,durationSeconds:Math.min(duration,60),text});
  }
  segments.sort((a,b)=>a.startSeconds-b.startSeconds);
  // Automatic captions often replace the prior displayed line before its declared end.
  for(let i=0;i<segments.length-1;i++)if(segments[i+1].startSeconds>segments[i].startSeconds)segments[i].durationSeconds=Math.min(segments[i].durationSeconds,segments[i+1].startSeconds-segments[i].startSeconds);
  return segments;
}

export function createTubeCaptions({tracks,request=fetch,now=Date.now}){
  const cache=new Map(),inflight=new Map();
  async function load(id){
    const hit=cache.get(id);if(hit?.expires>now())return hit.value;
    cache.delete(id);if(inflight.has(id))return inflight.get(id);
    if(inflight.size>=2)throw Object.assign(new Error('Captions are busy. Try again shortly.'),{status:429});
    const task=(async()=>{
      const candidates=(await tracks(id)).filter(t=>{try{const u=new URL(t.url||t.baseUrl);return u.protocol==='https:'&&/(^|\.)youtube\.com$/.test(u.hostname)&&u.pathname==='/api/timedtext'&&!u.username&&!u.password&&(!u.port||u.port==='443');}catch{return false;}});
      const track=candidates.find(t=>/^en(-|$)/i.test(t.languageCode)&&t.kind!=='asr')||candidates.find(t=>/^en(-|$)/i.test(t.languageCode))||candidates.find(t=>t.kind!=='asr')||candidates[0];
      if(!track)return {available:false,message:'Captions are not available for this video.',segments:[]};
      const url=new URL(track.url||track.baseUrl);url.searchParams.set('fmt','json3');
      const response=await request(url,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json','User-Agent':'Mozilla/5.0'}});
      if(!response.ok||Number(response.headers.get('content-length'))>LIMIT){await response.body?.cancel();throw new Error('Captions could not be loaded from YouTube.');}
      const chunks=[];let bytes=0;
      for await(const chunk of response.body){bytes+=chunk.length;if(bytes>LIMIT)throw new Error('Caption track exceeds the supported size.');chunks.push(chunk);}
      const segments=captionSegments(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      return {available:segments.length>0,language:String(track.name||track.languageCode||'Captions').slice(0,80),languageCode:String(track.languageCode||'').slice(0,32),segments};
    })().catch(()=>({available:false,message:'Captions could not be loaded right now. Try again later.',segments:[]})).then(value=>{
      while(cache.size>=4)cache.delete(cache.keys().next().value);
      cache.set(id,{value,expires:now()+(value.available?300000:30000)});return value;
    }).finally(()=>inflight.delete(id));
    inflight.set(id,task);return task;
  }
  return async(id,at=0)=>{
    if(!/^[A-Za-z0-9_-]{11}$/.test(id)||!Number.isFinite(at)||at<0||at>864000)throw Object.assign(new Error('Invalid caption request.'),{status:400});
    const value=await load(id),start=Math.max(0,Math.floor(at/60)*60-10),until=Math.floor(at/60)*60+60;
    const segments=value.segments.filter(s=>s.startSeconds+s.durationSeconds>=start&&s.startSeconds<until+30).slice(0,1000);
    return {...value,start,until,segments};
  };
}
