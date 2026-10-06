import {readFile,writeFile,mkdir,rename,open,unlink} from 'node:fs/promises';
import {homedir} from 'node:os';
import {dirname,join} from 'node:path';
import {randomUUID} from 'node:crypto';

const fail=message=>new Error(message);
export const movieMappingsFile=()=>process.env.NYX_MOVIE_MAPPINGS_FILE||join(homedir(),'.nyx','movie-mappings.json');
const validId=value=>/^[1-9]\d{0,9}$/.test(String(value));
export function providerPath(value){
  if(typeof value!=='string')throw fail('Enter a MovieBox detail path or SupaPlay movie link.');
  let path=value.trim();
  if(path.startsWith('https://')){
    const url=new URL(path);
    if(url.username||url.password||url.port||url.search||url.hash)throw fail('Use a plain movie link without query parameters.');
    const prefix=url.hostname==='supaplay.fun'?'/mw/':url.hostname==='h5.aoneroom.com'?'/detail/':null;
    if(!prefix||!url.pathname.startsWith(prefix))throw fail('Unsupported movie catalog link.');
    path=url.pathname.slice(prefix.length);
  }
  if(path.length>240||!/^([a-zA-Z0-9]+-)+[a-zA-Z0-9]{5,30}$/.test(path))throw fail('Invalid movie detail path; episode paths are not accepted.');
  return path;
}
// Read only the needed scalar fields from Nuxt's JSON reference table. Never evaluate scripts.
export function readProviderMovie(html,path){
  const raw=html.match(/<script[^>]*id=["']__NUXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/)?.[1];
  if(!raw)throw fail('The provider did not return movie metadata.');
  const table=JSON.parse(raw);
  if(!Array.isArray(table)||table.length>50000)throw fail('Unsupported provider metadata.');
  const scalar=ref=>Number.isInteger(ref)&&ref>=0&&['string','number','boolean'].includes(typeof table[ref])?table[ref]:undefined;
  const object=ref=>{
    let value=table[ref];
    for(let i=0;i<3&&Array.isArray(value)&&['Reactive','ShallowReactive'].includes(value[0]);i++)value=table[value[1]];
    return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  };
  const root=object(0),state=object(root.state),data=object(state.$sresData),subject=object(data.subject);
  if(scalar(subject.detailPath)!==path||scalar(subject.subjectType)!==1)throw fail('This link has no matching movie record (TV episodes are not accepted).');
  const movie=Object.fromEntries(['subjectId','title','releaseDate','duration','hasResource','detailPath','subjectType'].map(key=>[key,scalar(subject[key])]));
  if(!/^\d{1,24}$/.test(movie.subjectId||'')||!movie.title||movie.hasResource!==true)throw fail('This movie has no advertised resource.');
  return movie;
}
export async function fetchProviderMovie(value,{fetchImpl=fetch}={}){
  const path=providerPath(value);
  const response=await fetchImpl('https://h5.aoneroom.com/detail/'+path,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{Accept:'text/html'}});
  if(!response.ok)throw fail('The provider movie page is unavailable.');
  const reader=response.body.getReader();const chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024)throw fail('Provider metadata is too large.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  return readProviderMovie(Buffer.concat(chunks).toString('utf8'),path);
}
const normalized=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
// The provider's keyword search can return an empty success even on its own website.
// Discover candidates from its public catalog, then verify their individual detail records.
export function readProviderCatalog(html){
 const raw=html.match(/<script[^>]*id=["']__NUXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/)?.[1];
 if(!raw)throw fail('MovieBox catalog metadata is unavailable.');const table=JSON.parse(raw);
 if(!Array.isArray(table)||table.length>50000)throw fail('Unsupported MovieBox catalog.');
 const rows=new Map();
 for(const value of table){if(!value||typeof value!=='object'||Array.isArray(value)||table[value.subjectType]!==1)continue;
  const title=table[value.title],path=table[value.detailPath];if(typeof title!=='string'||typeof path!=='string')continue;
  try{rows.set(providerPath(path),{title,detailPath:path});}catch{}
 }
 return [...rows.values()].slice(0,500);
}
export async function findProviderMovie(tmdb,{fetchImpl=fetch}={}){
 const response=await fetchImpl('https://h5.aoneroom.com/',{redirect:'error',signal:AbortSignal.timeout(10000),headers:{Accept:'text/html'}});
 if(!response.ok)throw fail('MovieBox catalog is unavailable.');
 const reader=response.body.getReader();let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024)throw fail('MovieBox catalog is too large.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const names=[tmdb.title,tmdb.originalTitle].map(normalized).filter(Boolean);
 const candidates=readProviderCatalog(Buffer.concat(chunks).toString('utf8')).filter(x=>names.includes(normalized(x.title)));
 if(candidates.length>4)throw fail('Several MovieBox entries share this title. Supply a specific provider link for review.');
 const matches=[];
 for(const candidate of candidates){const movie=await fetchProviderMovie(candidate.detailPath,{fetchImpl});if(compareMovie(tmdb,movie).compatible)matches.push(movie);}
 if(matches.length!==1)throw fail(matches.length?'MovieBox matches are ambiguous; supply a specific provider link.':'No matching movie is in the current MovieBox catalog. Supply a known provider link; unavailable search results are not guessed.');
 return matches[0];
}
export function compareMovie(tmdb,provider){
  const reasons=[];
  const title=normalized(provider.title);
  if(!title||![tmdb.title,tmdb.originalTitle].some(v=>normalized(v)===title))reasons.push('Titles differ.');
  const year=String(tmdb.releaseDate||'').slice(0,4),other=String(provider.releaseDate||'').slice(0,4);
  if(!/^\d{4}$/.test(year)||year!==other)reasons.push('Release years differ or are missing.');
  if(provider.subjectType!==1)reasons.push('Provider entry is not a movie.');
  if(!Number.isFinite(tmdb.runtime)||tmdb.runtime<=0||!Number.isFinite(provider.duration)||provider.duration<=0||Math.abs(tmdb.runtime*60-provider.duration)>300)reasons.push('Runtime differs by more than five minutes or is missing.');
  return {compatible:reasons.length===0,reasons};
}
async function readStore(file){
  try{const raw=await readFile(file,'utf8');if(raw.length>2*1024*1024)throw fail('Mapping file is too large.');const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.movies)||data.movies.length>5000)throw fail('Invalid mapping file.');return data;}catch(e){if(e.code==='ENOENT')return {version:1,movies:[]};throw e;}
}
export async function confirmMovieMapping(tmdb,provider,{file=movieMappingsFile()}={}){
  if(!validId(tmdb.id))throw fail('Invalid TMDB movie ID.');
  const path=providerPath(provider.detailPath),comparison=compareMovie(tmdb,provider);
  if(!comparison.compatible)throw fail('Mapping was not saved: '+comparison.reasons.join(' '));
  await mkdir(dirname(file),{recursive:true});
  let lock;const lockfile=file+'.lock',temporary=file+'.'+randomUUID()+'.tmp';
  try{
    lock=await open(lockfile,'wx',0o600);
    const data=await readStore(file);
    if(data.movies.some(x=>x.tmdbId!==Number(tmdb.id)&&(x.detailPath===path||x.subjectId===provider.subjectId)))throw fail('This provider movie is already assigned to another TMDB ID.');
    const old=data.movies.find(x=>x.tmdbId===Number(tmdb.id));
    if(old&&old.detailPath!==path)throw fail('A different mapping already exists; review the stored entry before replacing it.');
    const entry={tmdbId:Number(tmdb.id),provider:'supaplay',subjectId:provider.subjectId,detailPath:path,title:tmdb.title,releaseDate:tmdb.releaseDate,runtime:tmdb.runtime,confirmedAt:new Date().toISOString()};
    data.movies=data.movies.filter(x=>x.tmdbId!==entry.tmdbId);data.movies.push(entry);
    await writeFile(temporary,JSON.stringify(data,null,2)+'\n',{mode:0o600,flag:'wx'});await rename(temporary,file);return entry;
  }finally{await unlink(temporary).catch(()=>{});if(lock){await lock.close();await unlink(lockfile);}}
}
export async function getMovieMappings(tmdb,{file=movieMappingsFile()}={}){
  // A missing/corrupt mapping must never take down ordinary TMDB browsing.
  try{const data=await readStore(file);return data.movies.filter(x=>x.tmdbId===tmdb.id&&x.provider==='supaplay'&&x.confirmedAt&&x.title===tmdb.title&&x.releaseDate===tmdb.releaseDate&&x.runtime===tmdb.runtime).flatMap(x=>{
    try{return [{provider:'supaplay',detailPath:providerPath(x.detailPath),confirmedAt:x.confirmedAt}];}catch{return [];}
  });}catch{return [];}
}
