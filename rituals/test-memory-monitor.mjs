import assert from 'node:assert/strict';
import {startMemoryMonitor} from '../scripture/memory-monitor.mjs';
let rss=100*1024**2;const messages=[];
const monitor=startMemoryMonitor({memory:()=>({rss,heapUsed:90*1024**2,external:20*1024**2,arrayBuffers:10*1024**2}),warn:line=>messages.push(line)});
try {
 monitor.check();assert.equal(messages.length,0);
 rss=2048*1024**2;monitor.check();
 assert.deepEqual(JSON.parse(messages[0].slice('Memory pressure '.length)),{rssMiB:2048,heapMiB:90,externalMiB:20,buffersMiB:10});
 console.log('PASS memory pressure reporting distinguishes RSS, live heap and native buffers');
}finally{monitor.stop();}
