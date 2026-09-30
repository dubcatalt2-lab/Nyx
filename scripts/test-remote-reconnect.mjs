import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';

const source=readFileSync('apps/remote/app.js','utf8');
const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
const functions=ast.body.filter(n=>n.type==='FunctionDeclaration'&&['disconnect','reconnect'].includes(n.id.name)).map(n=>source.slice(n.start,n.end)).join('\n');
function fixture(){
 const elements=new Map(),tasks=new Map(),delays=[];let nextId=0,now=0,starts=0,pendingReject;
 const element=id=>{if(!elements.has(id))elements.set(id,{hidden:true,removeAttribute(){},replaceChildren(){},classList:{remove(){}}});return elements.get(id);};
 const context=vm.createContext({
  $,Math,URL,clearTimeout:id=>tasks.delete(id),setTimeout:(fn,ms)=>{const id=++nextId;tasks.set(id,{fn,at:now+ms});delays.push(ms);return id;},
  list:async()=>{},send(){},notice:text=>context.message=text,
  start:async()=>{starts++;vm.runInContext('disconnect();generation++;',context);if(context.pending)await new Promise((_,reject)=>pendingReject=reject);throw Object.assign(Error('Computer is offline.'),{status:context.status||409});}
 });
 function $(id){return element(id);}
 vm.runInContext('let reconnectTimer,connectTimer,generation=0,reconnectAttempts=0,desktopControls,rfb,socket,frameUrl;\n'+functions+';this.retry=reconnect;this.stop=disconnect;',context);
 return {context,delays,elements,tasks,get starts(){return starts},reject:()=>pendingReject?.(Error('offline')),async tick(){const [id,task]=[...tasks].sort((a,b)=>a[1].at-b[1].at)[0]||[];assert(task,'Expected another automatic retry');tasks.delete(id);now=task.at;task.fn();await new Promise(resolve=>setImmediate(resolve));}};
}
{
 const f=fixture();f.context.retry({id:'fixture'},'Bridge disconnected.');
 for(let i=0;i<8;i++)await f.tick();
 assert.equal(f.starts,8,'Retries must continue beyond the old five-attempt limit');
 assert.deepEqual(f.delays.slice(0,6),[3000,6000,12000,24000,30000,30000]);
 assert(f.delays.every(delay=>delay<=30000));
 f.context.stop();assert.equal(f.tasks.size,0);assert.equal(f.elements.get('cancelReconnect').hidden,true);
}
for(const status of [401,403,404]){
 const f=fixture();f.context.status=status;f.context.retry({},'Lost connection');await f.tick();
 assert.equal(f.tasks.size,0,'Authorization denial/removal must stop retries');
 assert.equal(f.elements.get('cancelReconnect').hidden,true);
}
{
 const f=fixture();f.context.retry({},'Computer is already in use.',false);assert.equal(f.tasks.size,0);
}
{
 const f=fixture();f.context.pending=true;f.context.retry({},'Lost connection');await f.tick();f.context.stop();f.reject();
 await new Promise(resolve=>setImmediate(resolve));assert.equal(f.tasks.size,0,'Cancelled in-flight attempts must not restart');
}
console.log('PASS persistent retries, capped backoff, cancellation, revoked access and stale-attempt guards.');
