import assert from 'node:assert/strict';
import express from 'express';
import {createNyxCloudAccess,hasNyxCloudAccess,nyxCloudOwnerUid} from '../scripture/nyxcloud-access.mjs';

assert.equal(hasNyxCloudAccess({uid:nyxCloudOwnerUid}),true);
assert.equal(hasNyxCloudAccess({uid:'other',role:'owner',owner:true}),false);
const app=express(),verified=[];
app.use('/api/nyxcloud',createNyxCloudAccess({firebase:async()=>({auth:{
  async verifyIdToken(token,revocation){
    verified.push([token,revocation]);
    if(['revoked','disabled','invalid'].includes(token))throw Error('Invalid session');
    return {uid:token==='owner'?nyxCloudOwnerUid:'other',role:'owner'};
  }
}})}));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base=`http://127.0.0.1:${server.address().port}/api/nyxcloud`;
try{
  for(const token of ['',nyxCloudOwnerUid,'member','revoked','disabled','invalid']){
    const response=await fetch(base+'/access',{headers:token?{Authorization:'Bearer '+token}:{}});
    assert.equal(response.status,404,token||'anonymous');
    assert.equal(response.headers.get('cache-control'),'no-store');
  }
  const response=await fetch(base+'/access',{headers:{Authorization:'Bearer owner'}});
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{allowed:true,available:false,status:'reserved'});
  assert(verified.every(([,revocation])=>revocation===true));
  for(const path of ['/launch','/connect','/sessions']){
    assert.equal((await fetch(base+path,{method:'POST',headers:{Authorization:'Bearer owner'}})).status,404);
  }
  console.log('PASS NyxCloud exact UID, forged role/UID denial, revoked/disabled denial, no public VM launch/connect, reserved-only capability');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
