import assert from 'node:assert/strict';
import express from 'express';
import {createLoremCloud} from '../lib/nyxcloud-lorem.mjs';
let mode='delayed',starts=0,reads=0;
const item={id:'one',url:'https://loremgroup.org/vm/one/',status:'exited'};
const entry={uid:'alice',status:'ready',vm:{id:'one',url:item.url,state:'exited'},expiresAt:Date.now()+60000};
const state={version:1,entries:[entry],syncedAt:0,migrated:true,sessionPolicy:2};
const app=express();app.use('/api',createLoremCloud({key:'fixture',store:task=>task(state,async()=>{}),firebase:async()=>({auth:{verifyIdToken:async uid=>({uid})}}),fetchImpl:async url=>{
 if(url.endsWith('/api/dev/list')){reads++;return Response.json({vms:mode==='missing'?[]:[{...item,status:mode==='running'||(starts&&reads>=3)?'running':'exited'}]});}
 if(url.includes('/api/start/')){starts++;return Response.json({status:'success'});}
 throw Error('Unexpected provider operation');
}}));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
const start=(uid='alice')=>fetch(base+'/api/start/one',{method:'POST',headers:{Authorization:'Bearer '+uid,Origin:base}});
try{
 const begun=Date.now();assert.equal((await start()).status,200);assert(Date.now()-begun>=900);assert.equal(starts,1);assert.equal(entry.vm.state,'running');
 mode='running';assert.equal((await start()).status,200);assert.equal(starts,1,'running desktops must not restart');
 assert.equal((await start('bob')).status,404);assert.equal(starts,1);
 mode='missing';assert.equal((await start()).status,404);assert.equal(starts,1);
 entry.expiresAt=Date.now()-1;assert.equal((await start()).status,410);assert.equal(starts,1);
 console.log('PASS delayed startup confirmation, existing running session preservation, ownership, missing and expired desktops');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
