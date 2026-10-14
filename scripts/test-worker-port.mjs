import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {startWispurr} from '../lib/wispurr-relay.mjs';
const occupied=createServer();occupied.listen(0,'::');await new Promise(r=>occupied.once('listening',r));
let relay;const failures=[];
try{const port=occupied.address().port;relay=await startWispurr({port,onFailure:e=>failures.push(e.message)});assert(relay.workerPorts[0]>port);assert.equal((await fetch('http://127.0.0.1:'+relay.workerPorts[0]+'/health')).status,200);assert.equal(relay.isRunning,true);assert.deepEqual(failures,[]);console.log('PASS occupied IPv6 port is skipped; separate worker becomes healthy without stopping the existing listener.');}finally{await relay?.stop();await new Promise(r=>occupied.close(r));}
