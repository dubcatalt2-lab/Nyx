(() => {
 // Construct derives file:/// from an opaque sandbox origin unless its documented
 // baseUrl option is supplied. Preserve the game's explicit base and worker policy.
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
  let worker;try{worker=navigator.serviceWorker;}catch{}
  if(!worker)try{Object.defineProperty(globalThis,'C3_RegisterSW',{configurable:true,get:()=>()=>{},set:()=>{}});}catch{}
 }

 Object.defineProperty(globalThis,'RuntimeInterface',{configurable:true,get:()=>runtime,set(value){
  runtime=typeof value==='function'?new Proxy(value,{construct(target,args,newTarget){
   prepare();
   const options=args[0];if(options&&typeof options==='object'&&!options.baseUrl){args=[{...options,baseUrl:document.baseURI},...args.slice(1)];}
   return Reflect.construct(target,args,newTarget);
  }}):value;
 }});
})();
