import assert from 'node:assert/strict';
import {get} from 'node:http';
import {app} from '../shepherd.js';

const server=app.listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const base='http://127.0.0.1:'+server.address().port;
const hostStatus=(host,path)=>new Promise((resolve,reject)=>get(base+path,{headers:{host}},response=>{response.resume();resolve(response.statusCode);}).on('error',reject));
try {
  for(const host of ['drop.altarworship.org.uk','drop.ridgewoodstem.org','DROP.RIDGEWOODSTEM.ORG.']) {
    for(const path of ['/','/study.html','/healthz','/api/nook-ai/models']) {
      assert.equal(await hostStatus(host,path),410,host+path);
    }
  }
  for(const path of ['/apps/drop','/apps/drop/','/apps/drop/index.html','/chapels/drop/app.mjs','/drop','/api/drop-ai','/api/drop-ai/models','/apps/%64rop/index.html']) {
    const response=await fetch(base+path);
    assert.equal(response.status,410,path);
    assert.equal(response.headers.get('cache-control'),'no-store');
  }
  for(const host of ['drop.altarworship.org.uk','drop.ridgewoodstem.org']) {
    assert.equal((await fetch(base+'/api/custom-hostnames/allow?domain='+host)).status,404);
  }
  assert.equal((await fetch(base+'/healthz')).status,200);
  console.log('PASS Drop domains, app paths, encoded paths and APIs retired; certificate requests denied; Nyx health preserved');
} finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
