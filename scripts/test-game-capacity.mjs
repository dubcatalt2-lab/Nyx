import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {createGameProxy} from '../lib/game-proxy-stream.mjs';

const starts = [], releases = [];
const proxy = createGameProxy({maxActive:2, maxQueued:2, queueTimeout:300,
  request: async url => {
    starts.push(url);
    await new Promise(resolve => releases.push(resolve));
    return new Response('ready');
  }});
const server = http.createServer(async (req,res) => {
  if(req.url === '/health') {res.end('ok'); return;}
  try {await proxy.send(req,res,{candidates:[req.url]});}
  catch(error) {if(!res.destroyed){res.statusCode=error.status||502;res.end(error.message);}}
});
server.listen(0,'127.0.0.1'); await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
const get=path=>fetch(base+path).then(async r=>({status:r.status,body:await r.text()}));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await delay(5);}assert.fail('Capacity condition timed out');}
try {
  const one=get('/1'), two=get('/2'); await until(()=>starts.length===2);
  const abort=new AbortController();
  const cancelled=fetch(base+'/cancel',{signal:abort.signal}).catch(()=>null);
  await until(()=>proxy.stats().queued===1);
  const three=get('/3'); await until(()=>proxy.stats().queued===2);
  assert.equal((await get('/overflow')).status,503);
  assert.equal((await get('/health')).body,'ok');
  abort.abort(); await cancelled; await until(()=>proxy.stats().queued===1);
  const expired=get('/expire');
  assert.equal((await expired).status,503);
  assert.equal((await three).status,503);
  const next=get('/next'); await until(()=>proxy.stats().queued===1);
  releases.shift()(); await until(()=>starts.length===3);
  assert.deepEqual(starts,['/1','/2','/next']);
  releases.splice(0).forEach(resolve=>resolve());
  assert.equal((await one).status,200);assert.equal((await two).status,200);assert.equal((await next).status,200);
  await until(()=>proxy.stats().active===0);
  assert.equal(proxy.stats().queued,0);
  console.log('PASS bounded transfers, queue overflow/expiry, disconnect cleanup, FIFO and responsive health');
} finally {releases.splice(0).forEach(resolve=>resolve());server.closeAllConnections();server.close();}
