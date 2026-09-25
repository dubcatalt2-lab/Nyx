import assert from 'node:assert/strict';
import express from 'express';
import {installMovieApi} from '../lib/movies.mjs';
import {combinedMovieSources,movieSandbox} from '../lib/movie-public-api.mjs';
const catalog={
 async details(id){if(id==='999')throw Object.assign(new Error('Not found.'),{status:404});return {id:Number(id),title:'Example',playbackUrl:'legacy',providerMappings:[{provider:'supaplay',detailPath:'example-abcde'},{provider:'supaplay',detailPath:'https://evil.test/payload'}]};},
 async episode(id,s,e){if(e===999)throw Object.assign(new Error('Episode not found.'),{status:404});return {title:'Series',sources:[{id:'rive',name:'Rive',url:`https://watch.rivestream.app/embed?type=tv&id=${id}&season=1&episode=25`}]};},
 async search(q){return {results:[{title:q}]};},async series(){return {seasons:[{number:2}]};},async season(){return {episodes:[{number:1,sourceSeason:1,sourceEpisode:25}]};}
};
const movie=await combinedMovieSources(catalog,{type:'movie',id:'27205'});
assert.deepEqual(movie.sources.map(x=>x.id),['supaplay','nhd','rive','framextv']);
assert(movie.sources.every(x=>x.sandbox===movieSandbox&&x.quality===null&&x.availability==='unchecked'));
assert(!JSON.stringify(movie).includes('evil.test'));
const tv=await combinedMovieSources(catalog,{type:'tv',id:'95479',season:'2',episode:'1'});
assert(tv.sources[0].url.endsWith('season=1&episode=25'),'Preserve canonical episode mapping');
const mapped=await combinedMovieSources(catalog,{type:'tv',id:'95479',season:'1',episode:'1'});
assert.deepEqual(mapped.sources.map(s=>s.id),['rive','supaplay']);
for(const args of [{type:'anime',id:'1'},{type:'movie',id:'../1'},{type:'tv',id:'1'},{type:'tv',id:'1',season:'1',episode:'1.5'},{type:'movie',id:'1',episode:'1'}])await assert.rejects(()=>combinedMovieSources(catalog,args),e=>e.status===400);
await assert.rejects(()=>combinedMovieSources(catalog,{type:'tv',id:'1',season:'1',episode:'999'}),e=>e.status===404);
const app=express();installMovieApi(app,{catalog});const server=app.listen(0);await new Promise(r=>server.once('listening',r));
const base='http://127.0.0.1:'+server.address().port;
try{
 let r=await fetch(base+'/api/movies/v1/sources?type=movie&id=27205',{headers:{Origin:'https://friend.example'}});assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),'*');assert(!r.headers.has('access-control-allow-credentials'));assert.equal((await r.json()).sources.length,4);
 r=await fetch(base+'/api/movies/v1/sources',{method:'OPTIONS'});assert.equal(r.status,204);
 r=await fetch(base+'/api/movies/v1/sources',{method:'POST'});assert.equal(r.status,405);
 r=await fetch(base+'/api/movies/v1/movies/27205');const details=await r.json();assert(!('playbackUrl'in details));assert(!('providerMappings'in details));
 r=await fetch(base+'/api/movies/v1/search?q=Frieren');assert.equal((await r.json()).results[0].title,'Frieren');
 r=await fetch(base+'/api/movies/v1/tv/1/seasons/2');assert.equal((await r.json()).episodes[0].sourceEpisode,25);
 r=await fetch(base+'/api/movies/v1/sources?type=movie&id=999');assert.equal(r.status,404);
 for(let i=0;i<121;i++)r=await fetch(base+'/api/movies/v1/sources?type=movie&id=27205');assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'60');assert.equal(r.headers.get('access-control-allow-origin'),'*');
 r=await fetch(base+'/api/movies/search?q=x');assert.equal(r.status,429,'Public and existing API share abuse limits');
 console.log('PASS: combined movie/anime/TV API, mappings, invalid identities, CORS, read-only methods, metadata and shared rate limits.');
}finally{await new Promise(r=>server.close(r));}
