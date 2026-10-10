import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {startWispurr} from '../scripture/fellowship-relay.mjs';

const occupied=createServer(socket=>socket.end());
occupied.listen(0,'::');
await once(occupied,'listening');
const port=occupied.address().port;
let failed=false,relay;
try{
  relay=await startWispurr({port,onFailure:()=>{failed=true;}});
  assert(relay.workerPorts[0]>port);
  const deadline=Date.now()+10000;
  let status;
  while(Date.now()<deadline){
    try{status=(await fetch('http://127.0.0.1:'+relay.workerPorts[0]+'/')).status;break;}catch{await new Promise(resolve=>setTimeout(resolve,50));}
  }
  assert.equal(failed,false);
  assert.equal(typeof status,'number');
  console.log('PASS occupied IPv6 listener is skipped; new worker starts and accepts HTTP');
}finally{
  await relay?.stop();await new Promise(resolve=>occupied.close(resolve));
}
