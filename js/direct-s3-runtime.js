// Installed only in the separate direct-S3 export, before app scripts execute.
(()=>{
 const backend=document.querySelector('meta[name="nyx-static-backend"]')?.content;
 if(!backend)return;
 if(document.querySelector('meta[name="nyx-chat-enabled"]')?.content==='0')globalThis['nyx.static.chat']=false;
 if(document.querySelector('meta[name="nyx-blooket-enabled"]')?.content==='0')globalThis['nyx.static.blooket']=false;
 const key=Symbol.for('nyx.direct-s3.runtime.v2');if(window[key])return;window[key]=true;
 const nativeFetch=window.fetch.bind(window);
 const ready=(async()=>{
  if(!navigator.serviceWorker)throw Error('This br00ser cannot connect this S3 site.');
  const registration=await navigator.serviceWorker.register('/direct-s3-worker.js',{scope:'/',updateViaCache:'none'});
  const installing=registration.installing||registration.waiting;
  if(installing&&installing.state!=='activated')await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('The site worker could not update.')),15000);const changed=()=>{if(installing.state==='activated'||installing.state==='redundant'){clearTimeout(timer);installing.removeEventListener('statechange',changed);installing.state==='activated'?resolve():reject(Error('The site worker could not update.'));}};installing.addEventListener('statechange',changed);changed();});
  await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller||navigator.serviceWorker.controller!==registration.active)await new Promise((resolve,reject)=>{const changed=()=>{if(navigator.serviceWorker.controller===registration.active){clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',changed);resolve();}};const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',changed);reject(Error('The site worker could not start.'));},15000);navigator.serviceWorker.addEventListener('controllerchange',changed);changed();});
 })();
 // Render the workspace immediately; only requests needing the worker wait for it.
 window[Symbol.for('nyx.direct-s3.ready')]=ready;
 ready.catch(()=>{});
 window.fetch=function(input,options){const url=new URL(input instanceof Request?input.url:input,location.href);return url.origin===location.origin?ready.then(()=>nativeFetch(input,options)):nativeFetch(input,options);};
 const target=new URL(backend),NativeSocket=window.WebSocket;
 window.WebSocket=class extends NativeSocket{
  constructor(url,protocols){const parsed=new URL(url,location.href);if(parsed.host===location.host&&/^\/(?:api|socket\.io|resources\/live|wisp)(?:\/|$)/.test(parsed.pathname)){parsed.host=target.host;parsed.protocol='wss:';}super(parsed.href,...(protocols===undefined?[]:[protocols]));}
 };
})();
