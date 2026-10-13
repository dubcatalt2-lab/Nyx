import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,writeFile,unlink,rmdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {brotliDecompressSync,gunzipSync} from 'node:zlib';
import {application} from './assembly.mjs';

test('assets compress, revalidate, negotiate and invalidate after a new build',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'document-asset-test-'));
  const path=join(directory,'worker.js'),original='const value="lesson";\n'.repeat(1000);
  await writeFile(path,original);
  const app=application({assetDirectory:pathToFileURL(directory+'/')});
  app.listen(0,'127.0.0.1');await once(app,'listening');
  const get=(headers={},method='GET',route='/boot/start.js')=>new Promise((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',port:app.address().port,path:route,method,headers},response=>{
      const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks)}));response.on('error',reject);
    });req.on('error',reject);req.end();
  });
  try{
    const plain=await get();assert.equal(plain.body.toString(),original);
    const variants=await Promise.all(['br','gzip'].map(async kind=>{
      const result=await get({'accept-encoding':kind});
      assert.equal(result.status,200);assert.equal(result.headers['content-encoding'],kind);
      assert.equal(result.headers.vary,'Accept-Encoding');assert.equal(result.headers['cache-control'],'no-cache');
      assert.equal(result.headers['service-worker-allowed'],'/content/');
      assert.equal(Number(result.headers['content-length']),result.body.length);
      assert(result.body.length<plain.body.length/2);
      assert.equal((kind==='br'?brotliDecompressSync(result.body):gunzipSync(result.body)).toString(),original);
      const repeat=await get({'accept-encoding':kind,'if-none-match':'"another", W/'+result.headers.etag});
      assert.equal(repeat.status,304);assert.equal(repeat.body.length,0);
      const head=await get({'accept-encoding':kind},'HEAD');assert.equal(head.body.length,0);assert.equal(head.headers['content-length'],result.headers['content-length']);
      return result;
    }));
    assert.notEqual(variants[0].headers.etag,variants[1].headers.etag);
    assert.equal((await get({'accept-encoding':'br;q=0, gzip;q=0'})).headers['content-encoding'],undefined);
    assert.equal((await get({'accept-encoding':'br;q=0.2,gzip;q=0.8'})).headers['content-encoding'],'gzip');
    assert.equal((await get({'accept-encoding':'*;q=0'})).status,406);
    assert.equal((await get({},'POST')).status,405);assert.equal((await get({},'GET','/absent')).status,404);
    const changed=original.replaceAll('lesson','school');await writeFile(path,changed);
    const update=await get({'accept-encoding':'br','if-none-match':variants[0].headers.etag});
    assert.equal(update.status,200);assert.notEqual(update.headers.etag,variants[0].headers.etag);assert.equal(brotliDecompressSync(update.body).toString(),changed);
    await unlink(path);assert.equal((await get()).status,503);
  }finally{app.closeAllConnections();app.close();await unlink(path).catch(error=>{if(error.code!=='ENOENT')throw error;});await rmdir(directory);}
});
