import {movieEpisodes} from './movie-episodes.mjs';
import {providerPath} from './movie-mappings.mjs';

export const movieSandbox='allow-scripts allow-same-origin allow-forms allow-presentation';
const embed=source=>({...source,type:'iframe',sandbox:movieSandbox,availability:'unchecked',quality:null});

// Resolve identities through the catalog first. Never accept a client-supplied URL.
export async function combinedMovieSources(catalog,{type,id,season,episode}){
  if(!['movie','tv'].includes(type)||!/^[1-9]\d{0,9}$/.test(String(id)))throw Object.assign(new Error('Use type movie or tv and a valid TMDB ID.'),{status:400});
  if(type==='tv'){
    if(!/^\d{1,3}$/.test(String(season))||! /^[1-9]\d{0,3}$/.test(String(episode)))throw Object.assign(new Error('TV and anime require a season and episode.'),{status:400});
    const item=await catalog.episode(id,Number(season),Number(episode));
    const mapped=movieEpisodes.filter(x=>x.tmdbSeriesId===Number(id)&&x.season===Number(season)&&x.episode===Number(episode)).map(x=>({id:x.provider,name:x.providerName,url:x.embedUrl}));
    const priority=s=>s.id==='rive'?-1:s.id==='framextv'?1:0;
    const sources=[...mapped,...item.sources].sort((a,b)=>priority(a)-priority(b));
    return {version:1,media:{type,tmdbId:Number(id),season:Number(season),episode:Number(episode),title:item.title},sources:sources.filter((s,i)=>sources.findIndex(x=>x.url===s.url)===i).map(embed)};
  }
  if(season!==undefined||episode!==undefined)throw Object.assign(new Error('Season and episode apply only to TV.'),{status:400});
  const item=await catalog.details(id),mapped=[];
  for(const mapping of item.providerMappings||[])if(mapping.provider==='supaplay')try{mapped.push({id:'supaplay',name:'SupaPlay',url:'https://supaplay.fun/mw/'+providerPath(mapping.detailPath)});}catch{}
  return {version:1,media:{type,tmdbId:Number(id),title:item.title},sources:[...mapped,{id:'nhd',name:'NHD',url:`https://nhdapi.com/movie/${id}`},{id:'rive',name:'Rive',url:`https://watch.rivestream.app/embed?type=movie&id=${id}`},{id:'framextv',name:'FrameXTV',url:`https://framextv.tech/embed/${id}`}].map(embed)};
}

export function installPublicMovieRoutes(app,{catalog,route}){
  const prefix='/api/movies/v1';
  app.use(prefix,(req,res,next)=>{
    res.set({'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Expose-Headers':'Retry-After','Cross-Origin-Resource-Policy':'cross-origin'});
    if(req.method==='OPTIONS')return res.sendStatus(204);
    if(req.method!=='GET')return res.status(405).set('Allow','GET, OPTIONS').json({error:'Read-only API.'});
    next();
  });
  app.get(prefix+'/sources',route(req=>combinedMovieSources(catalog,req.query)));
  app.get(prefix+'/search',route(req=>catalog.search(req.query.q??'',Number(req.query.page??1))));
  app.get(prefix+'/tv/:id',route(req=>catalog.series(req.params.id)));
  app.get(prefix+'/tv/:id/seasons/:season',route(req=>catalog.season(req.params.id,Number(req.params.season))));
  app.get(prefix+'/movies/:id',route(async req=>{
    const {playbackUrl,providerMappings,...metadata}=await catalog.details(req.params.id);
    return metadata;
  }));
}
