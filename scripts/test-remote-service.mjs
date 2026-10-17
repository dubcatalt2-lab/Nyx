import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {EventEmitter} from 'node:events';
const source=await readFile(new URL('../remote-host/service-bridge.mjs',import.meta.url),'utf8');
let clock=1000,scheduled=[],intervals=[],writes=new Map(),sockets=[],desktops=[];
class Socket{
 constructor(){this.readyState=0;sockets.push(this);this.sent=[];this.bufferedAmount=0;this.bytes=0;}
 send(value){if(Buffer.isBuffer(value)){this.bytes+=value.length;this.bufferedAmount+=value.length;}else this.sent.push(JSON.parse(value));}
 close(code=1006){this.readyState=3;this.onclose?.({code});}
}
class Desktop extends EventEmitter{constructor(){super();this.destroyed=false;this.paused=false;this.writableLength=0;desktops.push(this);}pause(){this.paused=true;}resume(){this.paused=false;}destroy(){this.destroyed=true;this.emit('close');}write(){}}
const context=vm.createContext({WebSocket:Socket,config:{id:'fixture',credential:'secret'},directory:'fixture',join:(...args)=>args.join('/'),Date:class extends Date{constructor(){super(clock);}static now(){return clock;}},writeFile:async(path,value)=>writes.set(path,value),readFile:async path=>writes.get(path)||'',setInterval:fn=>{intervals.push(fn);return fn;},clearInterval:fn=>{intervals=intervals.filter(value=>value!==fn);},setTimeout:(fn,delay)=>{scheduled.push({fn,delay});return fn;},clearTimeout:()=>{},Buffer,createConnection:()=>new Desktop()});
vm.runInContext(source.slice(source.indexOf('let socket,desktop'),source.indexOf('if(!config.id){'))+'\nconnect();',context);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
let first=sockets[0];first.readyState=1;first.onopen();await flush();
assert(!writes.get('fixture/status.txt').includes('Online'),'Do not advertise online before authentication');
first.onmessage({data:'{"type":"ready"}'});await flush();assert(writes.get('fixture/status.txt').includes('Online'));
intervals[0]();assert.equal(first.sent.at(-1).type,'heartbeat');
first.onmessage({data:'{"type":"control","active":true}'});const desktop=desktops[0];
for(let i=0;i<512;i++){
 desktop.emit('data',Buffer.alloc(64*1024));
 if(desktop.paused){assert(first.bufferedAmount<=256*1024);first.bufferedAmount=0;intervals.at(-1)();assert(!desktop.paused);}
}
assert.equal(first.bytes,32*1024*1024);assert(!desktop.destroyed,'Slow uplink must not destroy the desktop stream');
first.onmessage({data:'{"type":"control","active":false}'});assert(desktop.destroyed);assert.equal(intervals.length,1,'Drain timer must be cleared on disconnect');
first.onerror({error:{message:'Network error',cause:{code:'ECONNRESET',message:'secret'}}});first.close(1006);await flush();assert.equal(scheduled[0].delay,1000);assert(writes.get('fixture/status.txt').includes('code 1006'));assert(writes.get('fixture/status.txt').includes('ECONNRESET'));assert(!writes.get('fixture/bridge-log.txt').includes('secret'));
scheduled.shift().fn();let second=sockets[1];second.readyState=1;second.onopen();second.onmessage({data:'{"type":"ready"}'});
// A stale close callback must not kill a replacement connection.
first.onclose({code:1006});assert.equal(scheduled.length,0);
clock+=61000;intervals[0]();await flush();assert.equal(second.readyState,3);assert(writes.get('fixture/bridge-log.txt').includes('heartbeat timed out'));
scheduled.shift().fn();let third=sockets[2];third.close(4003);await flush();assert.equal(scheduled.length,0);assert(writes.get('fixture/status.txt').includes('Pairing rejected'));
console.log('PASS: authenticated readiness, heartbeat timeout, automatic recovery, stale callbacks, bounded diagnostic history, revocation stop.');
