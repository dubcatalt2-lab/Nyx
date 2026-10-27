// Lifecycle cleanup for provider scripts; this is not a security sandbox.
let executing=null,installed=false;
const owners=new WeakMap(),listeners=new WeakMap();
const NativeObserver=window.MutationObserver;
const interaction=/^(?:click|pointerdown|pointerup|mousedown|mouseup|touchstart|touchend)$/;
let nativeAdd,nativeRemove;
function nonCancelling(event){return new Proxy(event,{get(target,key){if(['preventDefault','stopPropagation','stopImmediatePropagation'].includes(key))return()=>{};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;},set(target,key,value){if(key==='cancelBubble'||key==='returnValue')return true;return Reflect.set(target,key,value,target);}});}
const current=()=>executing||owners.get(document.currentScript);
const allowed=s=>!s.closed&&s.eligible();
function run(s,fn,receiver,args){if(!allowed(s))return;const previous=executing;executing=s;try{return Reflect.apply(fn,receiver,args);}finally{executing=previous;}}
const wrap=(s,fn)=>typeof fn==='function'?function(...args){return run(s,fn,this,args);}:fn;
function install(){
 if(installed)return;installed=true;
 const open=window.open;
 window.open=function(...args){const s=current();if(s?.reservePopup&&(!allowed(s)||!s.inputEvent?.isTrusted||!interaction.test(s.inputEvent.type)||!s.reservePopup(s.inputEvent)))return null;return Reflect.apply(open,this,args);};
 const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;nativeAdd=add;nativeRemove=remove;
 EventTarget.prototype.addEventListener=function(type,listener,options){
  const s=current();if(!s||!listener)return Reflect.apply(add,this,arguments);
  const capture=typeof options==='boolean'?options:Boolean(options?.capture),records=listeners.get(this)||[];
  if(records.some(r=>r.type===type&&r.listener===listener&&r.capture===capture))return;
  const wrapped=event=>{if(interaction.test(event.type)&&!s.accept(event,s.nodes))return;const input=s.nonBlocking&&interaction.test(event.type)?nonCancelling(event):event;const previous=s.inputEvent;s.inputEvent=event;try{return typeof listener==='function'?run(s,listener,this,[input]):run(s,listener.handleEvent,listener,[input]);}finally{s.inputEvent=previous;}};
  const record={type,listener,capture,wrapped,options};records.push(record);listeners.set(this,records);
  s.cleanup.add(()=>{remove.call(this,type,wrapped,capture);const i=records.indexOf(record);if(i!==-1)records.splice(i,1);});
  return add.call(this,type,wrapped,options);
 };
 EventTarget.prototype.removeEventListener=function(type,listener,options){const capture=typeof options==='boolean'?options:Boolean(options?.capture),records=listeners.get(this),i=records?.findIndex(r=>r.type===type&&r.listener===listener&&r.capture===capture)??-1;if(i!==-1){const [r]=records.splice(i,1);return remove.call(r.forwarded?document:this,type,r.wrapped,r.forwarded?false:options);}return Reflect.apply(remove,this,arguments);};
 for(const [name,cancel] of [['setTimeout','clearTimeout'],['setInterval','clearInterval'],['requestAnimationFrame','cancelAnimationFrame']]){
  const original=window[name].bind(window),clear=window[cancel].bind(window);
  window[name]=function(fn,...args){const s=current();if(!s)return original(fn,...args);if(typeof fn!=='function'||!allowed(s))return 0;let id;const cleanup=()=>clear(id);id=original(function(...values){if(name!=='setInterval')s.cleanup.delete(cleanup);return run(s,fn,this,values);},...args);s.cleanup.add(cleanup);return id;};
 }
 const then=Promise.prototype.then;Promise.prototype.then=function(resolve,reject){const s=current();return then.call(this,s?wrap(s,resolve):resolve,s?wrap(s,reject):reject);};
 const microtask=window.queueMicrotask.bind(window);window.queueMicrotask=fn=>{const s=current();return microtask(s?wrap(s,fn):fn);};
 for(const name of ['MutationObserver','ResizeObserver','IntersectionObserver']){const Original=window[name];if(!Original)continue;const Scoped=function(fn,...args){const s=current(),observer=new Original(s?wrap(s,fn):fn,...args);if(s)s.cleanup.add(()=>observer.disconnect());return observer;};Scoped.prototype=Original.prototype;Object.setPrototypeOf(Scoped,Original);window[name]=Scoped;}
 const create=Document.prototype.createElement;Document.prototype.createElement=function(...args){const node=Reflect.apply(create,this,args),s=current();if(s){owners.set(node,s);s.nodes.add(node);}return node;};
 for(const name of ['appendChild','insertBefore']){const original=Node.prototype[name];Node.prototype[name]=function(node,...args){const s=current();if(s){owners.set(node,s);s.nodes.add(node);}return original.call(this,node,...args);};}
}
export function loadPublisherScripts(tags,eligible,accept,{nonBlocking=false,reservePopup=null}={}){
 install();const s={closed:false,eligible,accept,nonBlocking,reservePopup,nodes:new Set(),cleanup:new Set()};
 if(nonBlocking){
  const passThrough=()=>{for(const node of s.nodes){if(!(node instanceof HTMLElement)||!node.isConnected)continue;if(['SCRIPT','STYLE','LINK','META'].includes(node.tagName))continue;if(nonBlocking==='empty'){const style=getComputedStyle(node),box=node.getBoundingClientRect();if(!['fixed','absolute'].includes(style.position)||box.width<innerWidth*.8||box.height<innerHeight*.8||node.textContent.trim()||node.querySelector('iframe,img,video,button,a,input'))continue;}
   // Popunder tags have no in-page controls: none of their DOM may intercept input.
   for(const element of [node,...node.querySelectorAll('*')])if(element instanceof HTMLElement&&(element.style.getPropertyValue('pointer-events')!=='none'||element.style.getPropertyPriority('pointer-events')!=='important'))element.style.setProperty('pointer-events','none','important');
   for(const record of listeners.get(node)||[]){if(!interaction.test(record.type)||record.forwarded)continue;record.forwarded=true;nativeRemove.call(node,record.type,record.wrapped,record.capture);nativeAdd.call(document,record.type,record.wrapped,typeof record.options==='object'?{...record.options,capture:false}:false);s.cleanup.add(()=>nativeRemove.call(document,record.type,record.wrapped,false));}
  }};
  const observer=new NativeObserver(passThrough);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class']});s.cleanup.add(()=>observer.disconnect());
 }
 run(s,()=>{for(const tag of tags){const script=document.createElement('script');script.dataset.zone=tag.zone;script.dataset.cfasync='false';script.src=tag.src;script.async=true;document.head.append(script);}},null,[]);
 return()=>{s.closed=true;for(const dispose of s.cleanup)dispose();s.cleanup.clear();for(const node of s.nodes)node.remove?.();s.nodes.clear();};
}
