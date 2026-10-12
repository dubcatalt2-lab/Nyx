import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {isolatedApplication} from './isolated-app.mjs';
import {partition} from './partition.mjs';

test('cross-origin media retains original referrer, range and partial response',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'document-media-'));
 let received;
 const upstream=createServer((req,res)=>{received=req.headers;res.writeHead(206,{'content-type':'video/mp4','content-range':'bytes 0-3/100','accept-ranges':'bytes'});res.end(Buffer.from([0,1,2,3]));}).listen(0,'127.0.0.1');
 await once(upstream,'listening');
 const service=isolatedApplication({suffix:'localhost',protocol:'http:',directory,resolveDestination:async value=>({url:new URL(new URL(value).pathname,'http://127.0.0.1:'+upstream.address().port),address:{address:'127.0.0.1',family:4}})});
 service.server.listen(0,'127.0.0.1');await once(service.server,'listening');
 try{
  const port=service.server.address().port;
  const result=await new Promise((resolve,reject)=>{
   const req=request({hostname:'127.0.0.1',port,path:'/content/page/'+encodeURIComponent('https://media.example/clip.mp4'),headers:{host:partition('https://media.example','localhost')+':'+port,referer:'http://'+partition('https://page.example','localhost')+':'+port+'/content/page/'+encodeURIComponent('https://page.example/watch?id=1'),range:'bytes=0-3','sec-fetch-dest':'video'}},res=>{const bytes=[];res.on('data',chunk=>bytes.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(bytes)}));});req.on('error',reject);req.end();
  });
  assert.equal(result.status,206);assert.deepEqual(result.body,Buffer.from([0,1,2,3]));
  assert.equal(result.headers['content-range'],'bytes 0-3/100');assert.equal(received.range,'bytes=0-3');
  assert.equal(received.referer,'https://page.example/watch?id=1');
 }finally{await service.close();service.server.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise(r=>service.server.close(r)),new Promise(r=>upstream.close(r))]);await rm(directory,{recursive:true,force:true});}
});
