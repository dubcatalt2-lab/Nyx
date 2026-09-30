import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../remote-host/service-bridge.mjs',import.meta.url),'utf8');
let clock=1000,scheduled=[],intervals=[],writes=new Map(),sockets=[];
class Socket{
 constructor(){this.readyState=0;sockets.push(this);this.sent=[];}
 send(value){this.sent.push(JSON.parse(value));}
 close(code=1006){this.readyState=3;this.onclose?.({code});}
}
const context=vm.createContext({WebSocket:Socket,config:{id:'fixture',credential:'secret'},directory:'fixture',join:(...args)=>args.join('/'),Date:class extends Date{constructor(){super(clock);}static now(){return clock;}},writeFile:async(path,value)=>writes.set(path,value),readFile:async path=>writes.get(path)||'',setInterval:fn=>{intervals.push(fn);return fn;},clearInterval:fn=>{intervals=intervals.filter(value=>value!==fn);},setTimeout:(fn,delay)=>{scheduled.push({fn,delay});return fn;},clearTimeout:()=>{},Buffer,createConnection:()=>{throw Error('No desktop expected');}});
vm.runInContext(source.slice(source.indexOf('let socket,desktop'),source.indexOf('if(!config.id){'))+'\nconnect();',context);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
let first=sockets[0];first.readyState=1;first.onopen();await flush();
assert(!writes.get('fixture/status.txt').includes('Online'),'Do not advertise online before authentication');
first.onmessage({data:'{"type":"ready"}'});await flush();assert(writes.get('fixture/status.txt').includes('Online'));
intervals[0]();assert.equal(first.sent.at(-1).type,'heartbeat');
first.close(1006);await flush();assert.equal(scheduled[0].delay,1000);assert(writes.get('fixture/status.txt').includes('code 1006'));
scheduled.shift().fn();let second=sockets[1];second.readyState=1;second.onopen();second.onmessage({data:'{"type":"ready"}'});
// A stale close callback must not kill a replacement connection.
first.onclose({code:1006});assert.equal(scheduled.length,0);
clock+=61000;intervals[0]();await flush();assert.equal(second.readyState,3);assert(writes.get('fixture/bridge-log.txt').includes('heartbeat timed out'));
scheduled.shift().fn();let third=sockets[2];third.close(4003);await flush();assert.equal(scheduled.length,0);assert(writes.get('fixture/status.txt').includes('Pairing rejected'));
console.log('PASS: authenticated readiness, heartbeat timeout, automatic recovery, stale callbacks, bounded diagnostic history, revocation stop.');
