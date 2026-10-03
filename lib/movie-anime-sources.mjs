// Exact TMDB season/episode identities, mapped to anime public embeds.
// Mapping schema: https://github.com/Fribb/anime-lists
const mappingUrl='https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json';
export function pickAnimeMapping(rows,id,season,episode){
 const candidates=rows.filter(r=>r?.themoviedb_id?.tv===Number(id)&&r.season?.tmdb===season&&Number.isSafeInteger(r.anilist_id)&&r.anilist_id>0).map(r=>({...r,offset:r.episode_offset?.tmdb??0})).filter(r=>Number.isInteger(r.offset)&&r.offset>=0&&episode>r.offset).sort((a,b)=>b.offset-a.offset);
 const first=candidates[0];
 if(!first||candidates.some(r=>r.offset===first.offset&&r.anilist_id!==first.anilist_id))return null;
 return {anilistId:first.anilist_id,episode:episode-first.offset};
}
export function parseAnimePage(html,anilistId,tmdbId){
 // Read constrained literals only; never execute provider JavaScript.
 const start=html.indexOf(`anime:{id:"${anilistId}",anilistId:${anilistId},`);
 if(start<0)return null;
 const end=html.indexOf('},epNum:',start);if(end<0)return null;
 const data=html.slice(start,end),providerId=data.match(/\btmdbId:"(\d+)"/)?.[1];
 if(providerId&&Number(providerId)!==Number(tmdbId))return null;
 const slugs=[...data.matchAll(/\bslug:"([a-z0-9]+(?:-[a-z0-9]+)*)"/g)],totals=[...data.matchAll(/\btotalEpisodes:(\d+)/g)];
 if(slugs.length!==1||totals.length!==1||slugs[0][1].length>200)return null;
 const total=Number(totals[0][1]);return total>0&&total<=10000?{slug:slugs[0][1],total}:null;
}
export function createAnimeSources({fetchImpl=fetch,now=Date.now}={}){
 let mappings=[],mappingUntil=0,mappingJob=null;const pages=new Map(),pending=new Map();
 async function read(url,maxBytes){
  const response=await fetchImpl(url,{signal:AbortSignal.timeout(8000),redirect:'error'});
  if(!response.ok)throw new Error('Anime lookup unavailable');
  const reader=response.body.getReader(),chunks=[];let length=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>maxBytes)throw new Error('Anime lookup too large');chunks.push(value);}}
  finally{await reader.cancel().catch(()=>{});}
  return Buffer.concat(chunks).toString('utf8');
 }
 async function mappingList(){
  if(now()<mappingUntil)return mappings;
  if(!mappingJob)mappingJob=(async()=>{try{const data=JSON.parse(await read(mappingUrl,32*1024*1024));if(!Array.isArray(data))throw new Error('Invalid mappings');mappings=data;mappingUntil=now()+86400000;}catch{mappingUntil=now()+60000;}finally{mappingJob=null;}return mappings;})();
  return mappingJob;
 }
 return async function animeEpisodeSources(id,season,episode){
  if(!/^[1-9]\d{0,9}$/.test(String(id))||!Number.isInteger(season)||season<0||!Number.isInteger(episode)||episode<1)return [];
  const match=pickAnimeMapping(await mappingList(),id,season,episode);if(!match)return [];
  if(!Number.isSafeInteger(match.anilistId)||match.anilistId>9999999999||match.episode>9999)return [];
  // AniEmbed uses the mapped AniList identity directly; AnimeX availability
  // must not prevent this independent provider from being offered.
  const fallback=[{id:'aniembed',name:'AniEmbed',url:`https://aniembed.se/e/${match.anilistId}/${match.episode}?lang=sub&autoplay=1&t=0`}];
  const key=`${id}:${match.anilistId}`;let hit=pages.get(key);
  if(!hit||hit.until<=now()){
   if(!pending.has(key)){
    if(pending.size>=4)return fallback;
    pending.set(key,(async()=>{let value=null;try{value=parseAnimePage(await read(`https://animex.one/watch/anime-${match.anilistId}-episode-1`,2*1024*1024),match.anilistId,id);}catch{}
     const result={value,until:now()+(value?3600000:60000)};if(pages.size>=256)pages.delete(pages.keys().next().value);pages.set(key,result);pending.delete(key);return result;
    })());
   }
   hit=await pending.get(key);
  }
  if(!hit.value)return fallback;
  if(match.episode>hit.value.total)return fallback;
  const {slug,total}=hit.value,e=match.episode;
  return [{id:'animex',name:'AnimeX',url:`https://plyr.animex.one/e/${slug}/${e}?lang=sub&autoplay=1&t=0&hasPrev=${e>1?1:0}&hasNext=${e<total?1:0}`},...fallback];
 };
}
