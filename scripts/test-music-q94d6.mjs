import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {q94d6} from '../lib/q94d6.mjs';
const directory=mkdtempSync(join(tmpdir(),'n7x-catalog-')),file=join(directory,'fixture.json');
writeFileSync(file,JSON.stringify({clientId:'fixture',clientSecret:'fixture-only'}));
try{
 let tokens=0,requests=0;
 const fetchImpl=async(url,options)=>{
  if(String(url).includes('/oauth2/')){tokens++;assert.equal(options.body,'grant_type=client_credentials');return Response.json({access_token:'fixture-token',expires_in:3600});}
  assert.equal(new URL(url).hostname,'openapi.tidal.com');assert.equal(options.headers.Authorization,'Bearer fixture-token');requests++;
  if(requests===1)return new Response('',{status:401});
  return Response.json({data:[{type:'searchResults',id:'fixture'}],included:[{type:'tracks',id:'123',attributes:{title:'Fixture',version:'Live',duration:'PT1H2M3S'},relationships:{artists:{data:[{type:'artists',id:'55'}]},albums:{data:[{type:'albums',id:'66'}]}}},{type:'artists',id:'55',attributes:{name:'Artist'}},{type:'albums',id:'66',attributes:{title:'Album'}}]});
 };
 const t=q94d6({file,fetchImpl});const rows=await t.search('Fixture');assert.equal(tokens,2);assert.equal(rows[0].id,'tidal:123');assert.equal(rows[0].artistId,'tidal:55');assert.equal(rows[0].albumId,'tidal:66');assert.equal(rows[0].duration,3723);assert.equal(rows[0].title,'Fixture - Live');await t.search('Again');assert.equal(tokens,2);
 assert.deepEqual(await q94d6({file:'nonexistent'}).search('Fixture'),[]);
 console.log('PASS Tidal OAuth refresh/cache, fixed API host, recording version, duration and namespaced IDs');
}finally{unlinkSync(file);rmdirSync(directory);}
