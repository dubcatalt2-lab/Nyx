import {getMovieMappings} from './movie-mappings.mjs';
import {movieEpisodes} from './movie-episodes.mjs';
const fail=(message,status=503)=>Object.assign(new Error(message),{status});
const text=(value,max=200)=>typeof value==='string'?value.slice(0,max):'';
const image=(value,size)=>typeof value==='string'&&/^\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(value)?`https://image.tmdb.org/t/p/${size}${value}`:null;
const movie=v=>({id:v.id,kind:v.media_type==='tv'?'tv':'movie',title:text(v.title||v.name),overview:text(v.overview,5000),releaseDate:text(v.release_date||v.first_air_date,10),poster:image(v.poster_path,'w342'),backdrop:image(v.backdrop_path,'w1280'),rating:Number.isFinite(v.vote_average)?v.vote_average:null});
export function productionSeasons(data,seriesId,expectedEpisodes){
  const groups=(Array.isArray(data.groups)?data.groups:[]).filter(g=>/^Season\s+\d+(?::.*)?$/i.test(g.name||''));
  if(groups.length<2||groups.length>100)return null;
  const seen=new Set(),coordinates=new Set(),seasons=new Set(),normalized=[];
  for(const group of groups){
    const number=Number(group.name.match(/^Season\s+(\d+)/i)[1]);
    if(!Number.isInteger(number)||number<1||number>999||seasons.has(number)||!Array.isArray(group.episodes)||!group.episodes.length)return null;
    seasons.add(number);const episodes=[...group.episodes].sort((a,b)=>a.order-b.order);
    for(const [index,e] of episodes.entries()){
      const coordinate=e.season_number+'/'+e.episode_number;
      if(e.show_id!==Number(seriesId)||e.order!==index||!Number.isSafeInteger(e.id)||!Number.isInteger(e.season_number)||e.season_number<1||!Number.isInteger(e.episode_number)||e.episode_number<1||seen.has(e.id)||coordinates.has(coordinate))return null;
      seen.add(e.id);coordinates.add(coordinate);
    }
    normalized.push({number,name:group.name,episodes});
  }
  return seen.size===expectedEpisodes?normalized.sort((a,b)=>a.number-b.number):null;
}
export function createMovieCatalog({token=()=>process.env.TMDB_TOKEN,fetchImpl=fetch,now=Date.now,mappings=getMovieMappings}={}){
  const cache=new Map(),pending=new Map();
  async function request(path,params={}){
    const secret=String(token()||'').trim();if(!secret)throw fail('Movie browsing is not configured yet.');
    const url=new URL('https://api.themoviedb.org/3/'+path);url.search=new URLSearchParams({language:'en-US',...params});const key=url.href;
    const hit=cache.get(key);if(hit&&hit.until>now())return hit.value;
    if(pending.has(key))return pending.get(key);
    if(pending.size>=4)throw fail('Movie browsing is busy. Try again shortly.',429);
    const job=Promise.resolve().then(async()=>{try{
      const signal=AbortSignal.timeout(10000);
      let r;
      for(let attempt=0;attempt<3;attempt++){
        try{
          r=await fetchImpl(url,{headers:{Authorization:`Bearer ${secret}`,Accept:'application/json'},redirect:'error',signal});
          break;
        }catch(error){
          const code=error.cause?.code||error.code;
          if(signal.aborted||attempt===2||!['ECONNRESET','EPIPE','ETIMEDOUT','UND_ERR_SOCKET','UND_ERR_CONNECT_TIMEOUT'].includes(code))throw error;
          await new Promise(resolve=>setTimeout(resolve,150*(attempt+1)));
        }
      }
      if(!r.ok)throw fail(r.status===404?'This movie could not be found.':r.status===429?'Movie browsing is busy. Try again shortly.':'Movie browsing is temporarily unavailable.',r.status===404?404:r.status===429?429:503);
      const reader=r.body.getReader();let length=0,chunks=[];
      try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>(/^tv\/(\d+\/season\/\d+|episode_group\/[a-f0-9]{24})$/.test(path)?8:1)*1024*1024)throw fail('Movie data could not be loaded.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
      const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(key,{until:now()+300000,value});return value;
    }catch(e){if(e.status)throw e;throw fail('Movie browsing is temporarily unavailable. Try again shortly.');}finally{pending.delete(key);}});pending.set(key,job);return job;
  }
  async function grouped(v){
    const regular=(v.seasons||[]).filter(s=>s.season_number>0&&s.episode_count>0);
    if(regular.length!==1)return null;
    try{
      const list=await request(`tv/${v.id}/episode_groups`);
      const candidates=(list.results||[]).filter(g=>g.type===6&&/^Seasons$/i.test(g.name||'')&&/^[a-f0-9]{24}$/.test(g.id)&&g.group_count>1).sort((a,b)=>b.episode_count-a.episode_count).slice(0,2);
      for(const candidate of candidates){const groups=productionSeasons(await request(`tv/episode_group/${candidate.id}`),v.id,regular[0].episode_count);if(groups)return {id:candidate.id,groups};}
    }catch{}
    return null;
  }
  return {
    async search(query,page=1){
      if(typeof query!=='string'||query.trim().length>120)throw fail('Enter a movie title of up to 120 characters.',400);
      if(!Number.isInteger(page)||page<1||page>100)throw fail('Invalid results page.',400);
      query=query.trim();const v=await request(query?'search/multi':'movie/popular',{...(query?{query}:{}),page:String(page),include_adult:'false'});
      if(!Array.isArray(v.results))throw fail('Movie results could not be loaded.');
      const results=v.results.filter(x=>x&&Number.isSafeInteger(x.id)&&x.id>0&&!x.adult&&(!x.media_type||['movie','tv'].includes(x.media_type))).slice(0,20).map(movie);
      let featured=results.filter(x=>!/^coyote\s+vs\.?\s+acme$/i.test(x.title));
      if(!query&&page===1)try{const moana=await request('movie/1108427');if(moana.id===1108427&&!moana.adult)featured=[movie(moana),...featured.filter(x=>x.id!==1108427)];}catch{}
      return {page,totalPages:Math.min(100,Math.max(1,Number(v.total_pages)||1)),results,featured};
    },
    async series(id){
      if(!/^[1-9]\d{0,9}$/.test(String(id)))throw fail('Invalid series ID.',400);
      const v=await request(`tv/${id}`,{append_to_response:'credits'});if(v.id!==Number(id)||v.adult)throw fail('This series is not available.',404);
      const order=await grouped(v),seasons=(v.seasons||[]).filter(s=>Number.isInteger(s.season_number)&&s.season_number>=0&&s.episode_count>0).slice(0,100).map(s=>({number:s.season_number,name:text(s.name),episodeCount:s.episode_count}));
      return {...movie({...v,media_type:'tv'}),language:text(v.original_language,10),genres:(v.genres||[]).slice(0,10).map(g=>text(g.name,60)),cast:(v.credits?.cast||[]).slice(0,14).map(p=>({name:text(p.name),role:text(p.character),photo:image(p.profile_path,'w185')})),seasons:order?[...seasons.filter(s=>s.number===0),...order.groups.map(g=>({number:g.number,name:text(g.name),episodeCount:g.episodes.length}))]:seasons,episodeGroup:order?.id||null,episodes:movieEpisodes.filter(x=>x.tmdbSeriesId===v.id)};
    },
    async season(id,number){
      if(!Number.isInteger(number)||number<0||number>999)throw fail('Invalid season.',400);
      const series=await this.series(id);if(!series.seasons.some(s=>s.number===number))throw fail('Season not found.',404);
      if(series.episodeGroup&&number>0){
        const raw=await request(`tv/episode_group/${series.episodeGroup}`),groups=productionSeasons(raw,id,series.seasons.filter(s=>s.number>0).reduce((n,s)=>n+s.episodeCount,0)),group=groups?.find(g=>g.number===number);
        if(!group)throw fail('Episode list is unavailable.');
        return {seriesId:Number(id),season:number,title:series.title,episodes:group.episodes.map(e=>({id:e.id,number:e.order+1,name:text(e.name),airDate:text(e.air_date,10),sourceSeason:e.season_number,sourceEpisode:e.episode_number}))};
      }
      const v=await request(`tv/${id}/season/${number}`);
      if(v.season_number!==number||!Array.isArray(v.episodes))throw fail('Episode list is unavailable.');
      return {seriesId:Number(id),season:number,title:series.title,episodes:v.episodes.filter(e=>Number.isInteger(e.episode_number)&&e.episode_number>0&&e.season_number===number).slice(0,500).map(e=>({number:e.episode_number,name:text(e.name),airDate:text(e.air_date,10)}))};
    },
    async episode(id,season,episode){
      const data=await this.season(id,season),entry=data.episodes.find(e=>e.number===episode);if(!entry)throw fail('Episode not found.',404);
      const sourceSeason=entry.sourceSeason??season,sourceEpisode=entry.sourceEpisode??episode;
      if(entry.id){const canonical=await request(`tv/${id}/season/${sourceSeason}`);if(!canonical.episodes?.some(e=>e.id===entry.id&&e.episode_number===sourceEpisode))throw fail('Episode mapping is unavailable.');}
      return {id:`${id}/${season}/${episode}`,kind:'episode',tmdbSeriesId:Number(id),season,episode,title:data.title,episodeLabel:`Season ${season} · Episode ${episode} · ${entry.name}`,sources:[{id:'nhd',name:'NHD',url:`https://nhdapi.com/tv/${id}/${sourceSeason}/${sourceEpisode}`}]};
    },
    async details(id){
      if(!/^[1-9]\d{0,9}$/.test(String(id)))throw fail('Invalid movie ID.',400);
      const v=await request(`movie/${id}`,{append_to_response:'credits'});if(v.id!==Number(id)||v.adult)throw fail('This movie is not available.',404);
      const people=[...(v.credits?.crew||[]).filter(p=>p.job==='Director').slice(0,2),...(v.credits?.cast||[]).slice(0,14)].map(p=>({name:text(p.name),role:text(p.character||p.job),photo:image(p.profile_path,'w185')}));
      const details={...movie(v),originalTitle:text(v.original_title),cast:people,language:text(v.original_language,10),votes:Number.isFinite(v.vote_count)?v.vote_count:0,runtime:Number.isFinite(v.runtime)?v.runtime:null,genres:(v.genres||[]).slice(0,10).map(g=>text(g.name,60)),playbackUrl:`https://vidsrcme.ru/embed/movie/${v.id}`};
      return {...details,providerMappings:await mappings(details)};
    }
  };
}
export function installMovieApi(app,{catalog=createMovieCatalog(),clientId=req=>req.ip,now=Date.now}={}){
  const rates=new Map();
  const route=fn=>async(req,res)=>{res.set('Cache-Control','no-store');try{
    const id=clientId(req)||'unknown',time=now();let rate=rates.get(id);
    if(!rate||rate.until<=time){if(rates.size>=2048){for(const [key,value] of rates)if(value.until<=time)rates.delete(key);if(rates.size>=2048)throw fail('Movie browsing is busy. Try again shortly.',429);}rate={until:time+60000,count:0};rates.set(id,rate);}
    if(++rate.count>120)throw fail('Too many movie requests. Try again shortly.',429);
    res.json(await fn(req));
  }catch(e){const status=e.status||503;if(status===429)res.set('Retry-After','60');res.status(status).json({error:e.status?e.message:'Movie browsing is temporarily unavailable.'});}};
  app.get('/api/movies/search',route(req=>catalog.search(req.query.q??'',Number(req.query.page??1))));
  app.get('/api/movies/episodes',route(()=>({results:movieEpisodes})));
  app.get('/api/movies/tv/:id',route(req=>catalog.series(req.params.id)));
  app.get('/api/movies/tv/:id/season/:season',route(req=>catalog.season(req.params.id,Number(req.params.season))));
  app.get('/api/movies/tv/:id/season/:season/episode/:episode',route(req=>catalog.episode(req.params.id,Number(req.params.season),Number(req.params.episode))));
  app.get('/api/movies/:id',route(req=>catalog.details(req.params.id)));
}
