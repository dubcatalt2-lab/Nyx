(() => {
 // Sandboxed games cannot use persistent browser caches. Expose a deliberately
 // non-persistent cache so optional offline caching cannot abort online startup.
 try { void globalThis.caches; } catch {
  const cache={match:async()=>undefined,matchAll:async()=>[],put:async()=>{},delete:async()=>false,keys:async()=>[]};
  Object.defineProperty(globalThis,'caches',{configurable:true,value:{open:async()=>cache,match:async()=>undefined,has:async()=>false,delete:async()=>false,keys:async()=>[]}});
 }
 try { void globalThis.indexedDB; } catch { Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:undefined}); }
 // EmulatorJS's optional ROM/core cache opens IndexedDB synchronously. Opaque
 // frames cannot open it; its documented cache switch leaves save export intact.
 if(globalThis.origin==='null')globalThis.EJS_disableDatabases=true;
 let offlineUnavailable=false;
 try { void navigator.serviceWorker; } catch {
  offlineUnavailable=true;
  const unavailable=()=>Promise.reject(new DOMException('Offline service workers are unavailable in this game sandbox.','NotSupportedError'));
  try { Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{controller:null,getRegistration:async()=>undefined,getRegistrations:async()=>[],register:unavailable,addEventListener(){},removeEventListener(){}}}); } catch {}
 }
 // Unity uses document.URL (about:srcdoc), rather than <base>, for this directory.
 const unityFactories=new WeakSet();
 function prepareUnity(){
  const factory=globalThis.createUnityInstance;
  if(typeof factory!=='function'||unityFactories.has(factory))return;
  const wrapped=function(canvas,options,...rest){
   const config={...options};
   config.streamingAssetsUrl=new URL(config.streamingAssetsUrl||'StreamingAssets',document.baseURI).href;
   return Reflect.apply(factory,this,[canvas,config,...rest]);
  };
  unityFactories.add(wrapped);globalThis.createUnityInstance=wrapped;
 }
 document.addEventListener?.('load',event=>{if(event.target?.tagName==='SCRIPT')prepareUnity();},true);
 document.addEventListener?.('DOMContentLoaded',prepareUnity);
 // Mirrored YouTube Playables run without the YouTube parent RPC host. Keep
 // game lifecycle and local save hooks functional, without ads or fake purchases.
 if(!globalThis.ytgame){
  const listeners=new Set(),empty=()=>{},resolved=async()=>{};
  const saveKey=()=> 'nyx.playable.save:'+document.baseURI;
  globalThis.ytgame={IN_PLAYABLES_ENV:false,
   game:{firstFrameReady:empty,gameReady:empty,gameLoaded:empty,loadData:async()=>{try{return localStorage.getItem(saveKey())||''}catch{return''}},saveData:async data=>{try{localStorage.setItem(saveKey(),String(data))}catch{}},sendScore:resolved},
   system:{getLanguage:async()=>navigator.language||'en',isAudioEnabled:()=>true,isMuted:()=>false,onAudioEnabledChange:callback=>{listeners.add(callback);return()=>listeners.delete(callback)},onPause:()=>empty,onResume:()=>empty},
   engagement:{sendScore:resolved},health:{logError:empty,logWarning:empty},ads:{AdResult:{UNKNOWN:'unknown',SHOWED:'showed',REJECTED:'rejected'},isAdAvailable:()=>false,requestAd:async()=>'rejected'}
  };
 }
 // Construct derives file:/// from an opaque sandbox origin unless its documented
 // baseUrl option is supplied. Opaque frames also need the supported local runtime:
 // their module worker can stall before the engine sends its ready message.
 if(globalThis.__nyxConstructBase)return;globalThis.__nyxConstructBase=true;
 let runtime,prepared=false;
 function prepare(){
  if(prepared)return;prepared=true;
  // Some mirrored Construct runtimes mistakenly call cancelAnimationFrame
  // with a callback, including their shader polling and main game loop.
  // Repair only that invalid signature; ordinary numeric cancellation is intact.
  const cancel=globalThis.cancelAnimationFrame.bind(globalThis),request=globalThis.requestAnimationFrame.bind(globalThis);
  globalThis.cancelAnimationFrame=value=>typeof value==='function'?request(value):cancel(value);
  // Offline service-worker caching is unavailable in opaque game sandboxes.
  // Its registration must not throw out of the first game tick.
  let worker;try{if(!offlineUnavailable)worker=navigator.serviceWorker;}catch{}
  if(!worker)try{Object.defineProperty(globalThis,'C3_RegisterSW',{configurable:true,get:()=>()=>{},set:()=>{}});}catch{}
 }

 Object.defineProperty(globalThis,'RuntimeInterface',{configurable:true,get:()=>runtime,set(value){
  runtime=typeof value==='function'?new Proxy(value,{construct(target,args,newTarget){
   prepare();
   const options=args[0];if(options&&typeof options==='object'){args=[{...options,baseUrl:options.baseUrl||document.baseURI,...(globalThis.origin==='null'?{useWorker:false}:{})},...args.slice(1)];}
   return Reflect.construct(target,args,newTarget);
  }}):value;
 }});
})();
