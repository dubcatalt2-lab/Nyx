import assert from 'node:assert/strict';
import express from 'express';
import {additionalSources,additionalSourceUrl,providerDefinitions} from '../apps/movies/providers.mjs';
import {installMovieImages} from '../lib/movie-images.mjs';
assert.equal(providerDefinitions.length,10);
for(const args of [['movie',27205],['tv',95479,1,25]]){
 const rows=additionalSources(...args);assert.equal(rows.length,10);
 for(const row of rows){assert.equal(additionalSourceUrl(row.url),row.url);if(args[0]==='tv')assert(row.url.endsWith('/95479/1/25'));}
}
for(const value of ['https://vidfast.pro.evil.test/movie/1','https://user@vidfast.pro/movie/1','https://vidfast.pro/movie/1?url=https://evil.test','https://vidcore.net/movie/1','https://vidfast.pro/movie/0','https://vidfast.pro/tv/1/1/0'])assert.equal(additionalSourceUrl(value),null);
assert.deepEqual(additionalSources('tv',1,undefined,1),[]);
let calls=0,active=0,peak=0;
const app=express();installMovieImages(app,{fetchImpl:async(url,options)=>{calls++;active++;peak=Math.max(peak,active);assert(url.startsWith('https://image.tmdb.org/t/p/'));assert.equal(options.redirect,'error');await new Promise(r=>setTimeout(r,30));active--;return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/jpeg'}})}});
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
try{
 const rs=await Promise.all(Array.from({length:10},(_,i)=>fetch(base+'/api/movies/image/w342/test'+i+'.jpg')));assert(rs.every(r=>r.status===200));assert(peak<=4);
 const before=calls;assert.equal((await fetch(base+'/api/movies/image/w342/test0.jpg')).status,200);assert.equal(calls,before);
 assert.equal((await fetch(base+'/api/movies/image/bad/test.jpg')).status,400);
 assert.equal((await fetch(base+'/api/movies/image/w342/test.svg')).status,400);
 console.log('PASS 10 provider identities, canonical episodes, hostile URLs, image fixed origin/cache/queue/concurrency/type validation');
}finally{await new Promise(r=>server.close(r));}
