// Installed only in the separate direct-S3 export, before app scripts execute.
(()=>{
 const backend=document.querySelector('meta[name="nyx-static-backend"]')?.content;
 if(!backend)return;window[Symbol.for('nyx.host.origin')]=backend;
 if(document.querySelector('meta[name="nyx-chat-enabled"]')?.content==='0')globalThis['nyx.static.chat']=false;
 if(document.querySelector('meta[name="nyx-blooket-enabled"]')?.content==='0')globalThis['nyx.static.blooket']=false;
 const key=Symbol.for('nyx.direct-s3.runtime.v2');if(window[key])return;window[key]=true;
 let hostSession='',workerContextReady=false;
 navigator.serviceWorker?.addEventListener('message',event=>{if(event.source===navigator.serviceWorker.controller&&event.data?.type==='nyx:host-session'&&typeof event.data.session==='string')hostSession=event.data.session;});
 const nativeFetch=window.fetch.bind(window);
 const ready=(async()=>{
  if(!navigator.serviceWorker)throw Error('This br00ser cannot connect this S3 site.');
  const registration=await navigator.serviceWorker.register('/direct-s3-worker.js',{scope:'/',updateViaCache:'none'});
  const installing=registration.installing||registration.waiting;
  if(installing&&installing.state!=='activated')await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('The site worker could not update.')),15000);const changed=()=>{if(installing.state==='activated'||installing.state==='redundant'){clearTimeout(timer);installing.removeEventListener('statechange',changed);installing.state==='activated'?resolve():reject(Error('The site worker could not update.'));}};installing.addEventListener('statechange',changed);changed();});
  await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller||navigator.serviceWorker.controller!==registration.active)await new Promise((resolve,reject)=>{const changed=()=>{if(navigator.serviceWorker.controller===registration.active){clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',changed);resolve();}};const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',changed);reject(Error('The site worker could not start.'));},15000);navigator.serviceWorker.addEventListener('controllerchange',changed);changed();});
  workerContextReady=true;
  hostSession=await new Promise((resolve,reject)=>{
   const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error('The connection session did not start.'));},15000);
   channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();event.data?.session?resolve(event.data.session):reject(Object.assign(Error(event.data?.error||'The connection session did not start.'),{code:event.data?.code}));};
   navigator.serviceWorker.controller.postMessage({type:'nyx:static-session'},[channel.port2]);
  });
 })();
 ready.then(()=>{const refresh=()=>{if(document.hidden)return;const channel=new MessageChannel();const timer=setTimeout(()=>channel.port1.close(),15000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();if(event.data?.session)hostSession=event.data.session;};navigator.serviceWorker.controller?.postMessage({type:'nyx:host-session-refresh'},[channel.port2]);};const interval=setInterval(refresh,1800000);document.addEventListener('visibilitychange',refresh);addEventListener('pagehide',()=>{clearInterval(interval);document.removeEventListener('visibilitychange',refresh);},{once:true});}).catch(()=>{});
 // Render the workspace immediately; only requests needing the worker wait for it.
 window[Symbol.for('nyx.direct-s3.ready')]=ready;
 ready.catch(error=>{if(parent!==window&&(!workerContextReady||error.code==='HOST_CONTEXT_REQUIRED'))parent.postMessage({type:'nyx:host-context-required'},'*');});
 window.fetch=function(input,options){const url=new URL(input instanceof Request?input.url:input,location.href);return url.origin===location.origin?ready.then(()=>nativeFetch(input,options)):nativeFetch(input,options);};
 const target=new URL(backend),NativeSocket=window.WebSocket;
 window.WebSocket=class extends NativeSocket{
  get protocol(){const value=super.protocol;return value.startsWith('nyx-host.')?'':value;}
  constructor(url,protocols){const parsed=new URL(url,location.href);if(parsed.host===location.host&&/^\/(?:api|socket\.io|resources\/live|wisp)(?:\/|$)/.test(parsed.pathname)){parsed.host=target.host;parsed.protocol='wss:';}const values=protocols===undefined?[]:Array.isArray(protocols)?[...protocols]:[protocols];if(parsed.host===target.host&&/^\/(?:resources\/live|wisp)(?:\/|$)/.test(parsed.pathname)&&hostSession)values.push('nyx-host.'+hostSession);super(parsed.href,...(values.length?[values]:[]));}
 };
})();
