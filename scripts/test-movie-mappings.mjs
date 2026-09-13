import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {providerPath,readProviderMovie,fetchProviderMovie,compareMovie,confirmMovieMapping,getMovieMappings,findProviderMovie} from '../lib/movie-mappings.mjs';
import {createMovieCatalog} from '../lib/movies.mjs';
const tmdb={id:1108427,title:'Moana',originalTitle:'Moana',releaseDate:'2026-07-08',runtime:115};
const provider={subjectId:'784222266707137040',title:'Moana',releaseDate:'2026-07-10',duration:6900,hasResource:true,detailPath:'moana-KHgXxMgKVV',subjectType:1};
const table=[['ShallowReactive',1],{state:2},['Reactive',3],{$sresData:4},{subject:5},{}];
for(const [key,value] of Object.entries(provider)){table[5][key]=table.length;table.push(value);}
// Untrusted comments/recommendations must not override the root movie record.
table.push({title:6,detailPath:7,subjectType:8});
const html='<script id="__NUXT_DATA__" type="application/json">'+JSON.stringify(table)+'</script>';
assert.deepEqual(readProviderMovie(html,provider.detailPath),provider);
assert.throws(()=>readProviderMovie(html,'inception-AbCdE123'));
for(const link of ['https://evil.example/detail/moana-KHgXxMgKVV','https://supaplay.fun/mw/a-BcDef/1/1','../secret','https://supaplay.fun:123/mw/moana-KHgXxMgKVV','https://supaplay.fun/mw/moana-KHgXxMgKVV?q=x'])assert.throws(()=>providerPath(link));
let fetched=0;
assert.deepEqual(await fetchProviderMovie(provider.detailPath,{fetchImpl:async(url,options)=>{fetched++;assert.equal(url,'https://h5.aoneroom.com/detail/'+provider.detailPath);assert.equal(options.redirect,'error');return new Response(html);}}),provider);
await assert.rejects(()=>fetchProviderMovie('https://evil.example/foo',{fetchImpl:()=>{fetched++;}}));assert.equal(fetched,1);
assert.equal(compareMovie(tmdb,provider).compatible,true);
for(const changed of [{releaseDate:'2016-01-01'},{title:'Moana 2',originalTitle:'Moana 2'},{runtime:90},{runtime:null}])assert.equal(compareMovie({...tmdb,...changed},provider).compatible,false);
assert.equal(compareMovie(tmdb,{...provider,subjectType:2}).compatible,false);
assert.deepEqual(await findProviderMovie(tmdb,{fetchImpl:async()=>new Response(html)}),provider);
await assert.rejects(()=>findProviderMovie({...tmdb,title:'Another movie',originalTitle:''},{fetchImpl:async()=>new Response(html)}),/No matching/);
const dir=await mkdtemp(join(tmpdir(),'nyx-mapping-')),file=join(dir,'mappings.json');
try{
  assert.deepEqual(await getMovieMappings(tmdb,{file}),[]);
  await assert.rejects(()=>confirmMovieMapping({...tmdb,releaseDate:'2016-01-01'},provider,{file}));
  await confirmMovieMapping(tmdb,provider,{file});
  assert.equal((await getMovieMappings(tmdb,{file}))[0].detailPath,provider.detailPath);
  assert.deepEqual(await getMovieMappings({...tmdb,releaseDate:'2016-01-01'},{file}),[]);
  await assert.rejects(()=>confirmMovieMapping({...tmdb,id:277834},provider,{file}),/already assigned/);
  await assert.rejects(()=>confirmMovieMapping(tmdb,{...provider,detailPath:'moana-AbCdE12'},{file}),/different mapping/);
  const before=await readFile(file,'utf8');await writeFile(file+'.lock','');await assert.rejects(()=>confirmMovieMapping(tmdb,provider,{file}));assert.equal(await readFile(file,'utf8'),before);await rm(file+'.lock');
  const catalog=createMovieCatalog({token:()=> 'test',mappings:movie=>getMovieMappings(movie,{file}),fetchImpl:async()=>Response.json({id:tmdb.id,title:tmdb.title,original_title:tmdb.title,release_date:tmdb.releaseDate,runtime:115})});
  assert.equal((await catalog.details(tmdb.id)).providerMappings[0].provider,'supaplay');
  await writeFile(file,'broken');assert.deepEqual((await catalog.details(tmdb.id)).providerMappings,[]);
  console.log('PASS: authoritative metadata, URL isolation, remake/type/runtime rejection, confirmed persistence, duplicate/concurrent protection, catalog integration and corrupt-file fallback.');
}finally{await rm(dir,{recursive:true,force:true});}
