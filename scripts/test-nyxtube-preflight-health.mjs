import assert from 'node:assert/strict';
import express from 'express';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createTubeCatalog} from '../lib/nyxtube-catalog.mjs';
import {createTubeBackend,TubeError} from '../lib/nyxtube-streaming.mjs';
import {tubeStreamingRoutes} from '../lib/nyxtube-routes.mjs';
const root=await mkdtemp(join(tmpdir(),'tube-health-'));
let primary=0,backup=0;
const catalog=createTubeCatalog({env:{NYX_YTDLP_BIN:'fixture'},execute:async()=>{primary++;throw new TubeError('authentication','YouTube rejected the server login cookies.');},fallback:{enabled:true,close(){},info:async()=>{backup++;throw new TubeError('service','The backup video service is unavailable.');}}});
const backend=createTubeBackend({env:{NYX_YOUTUBE_NATIVE_ENABLED:'1',NYX_YOUTUBE_CACHE_DIR:root}});
const app=express();let denied=false;
app.use(tubeStreamingRoutes({backend,sameOrigin:()=>true,clientIp:()=> 'fixture',owner:async()=>{},publicVideo:async id=>{if(denied)throw new TubeError('video','Restricted video',422);await catalog.info(id);}}));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base='http://127.0.0.1:'+server.address().port;
try{
 for(const id of ['YE7VzlLtp-4','aqz-KE-bpKQ']){
  const response=await fetch(base+'/api/nyxtube/native/formats/'+id);
  assert.equal(response.status,503);const body=await response.json();assert.equal(body.code,'authentication');assert.match(body.error,/login cookies/);
 }
 assert.equal(primary,1,'Cooldown does not hammer the rejected login');assert.equal(backup,2);
 const status=await backend.status();assert.equal(status.state,'login_required');assert.equal(status.lastError,'authentication');assert(status.lastChecked);
 denied=true;const response=await fetch(base+'/api/nyxtube/native/prepare/YE7VzlLtp-4/720?mode=hls',{method:'POST'});assert.equal(response.status,422);assert.equal((await backend.status()).lastChecked,status.lastChecked,'A restricted video does not change service health');
 console.log('PASS rejected primary login remains visible through backup outage and cooldown; route preflight updates health; restricted videos remain denied.');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await catalog.close();await backend.close();await rm(root,{recursive:true,force:true});}
