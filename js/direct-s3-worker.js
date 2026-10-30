const configuration=new URL('./direct-s3-config.json',self.location.href);
const settings=fetch(configuration,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Hosting configuration unavailable');return r.json();});
// The connection identity is stored on this site's own origin, not in cross-site cookies.
let backendSession,identityRecord,activeBackend;
const unavailableBackends=new Set();
async function identityStore(){
 if(!identityRecord)identityRecord=(async()=>{
  const store=await caches.open('nyx.host.identity.v1'),key=new URL('/_host_identity',self.location.origin).href;
  const saved=await store.match(key);let value;try{value=saved?await saved.json():null;}catch{}
  if(!/^[a-f0-9]{32}$/.test(value?.client||''))value={client:Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join(''),session:''};
  return {value,save:async()=>store.put(key,new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}}))};
 })();
 return identityRecord.catch(error=>{if(['SecurityError','NotAllowedError'].includes(error.name))error.code='HOST_CONTEXT_REQUIRED';throw error;});
}
function ensureBackendSession(){
 if(!backendSession){const promise=(async()=>{
  const config=await settings,record=await identityStore();
  const headers=new Headers({'X-Nyx-Host-Client':record.value.client});if(record.value.session)headers.set('X-Nyx-Host-Session',record.value.session);
  const candidates=[...new Set([config.backend,...(config.backends||[])])].map(value=>{const url=new URL(value);if(url.protocol!=='https:'||url.origin!==value)throw Error('Invalid connection configuration');return value;}).sort((a,b)=>Number(unavailableBackends.has(a))-Number(unavailableBackends.has(b)));
  const connect=async backend=>{const response=await fetch(backend+'/api/static-host/check',{headers,credentials:'include',cache:'no-store',signal:globalThis.AbortSignal?.timeout(4000)});if(!response.ok)throw Error('Connection setup returned '+response.status);const result=await response.json();if(!result.supported||typeof result.session!=='string'||!result.session)throw Error('The connection session could not be established.');return {backend,session:result.session};};
  let connected;try{connected=await connect(candidates[0]);}catch(firstError){if(candidates.length<2)throw firstError;try{connected=await Promise.any(candidates.slice(1).map(connect));}catch{throw Error('None of the configured connections could be reached.');}}
  activeBackend=connected.backend;unavailableBackends.delete(activeBackend);record.value.session=connected.session;await record.save();for(const client of await self.clients?.matchAll({type:'window'})||[])client.postMessage({type:'nyx:host-session',session:connected.session,backend:activeBackend});return connected.session;
 })();backendSession=promise;promise.catch(()=>{if(backendSession===promise)backendSession=null;});}
 return backendSession;
}
self.addEventListener('message',event=>{
 if(!['nyx:static-session','nyx:host-session-refresh'].includes(event.data?.type)||!event.ports[0])return;if(event.data.type==='nyx:host-session-refresh')backendSession=null;
 event.waitUntil(ensureBackendSession().then(session=>event.ports[0].postMessage({ok:true,session,backend:activeBackend}),error=>event.ports[0].postMessage({error:error.message,code:error.code})));
});
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin||url.pathname==='/direct-s3-config.json'||url.pathname.startsWith('/~/'))return;
 event.respondWith((async()=>{
  const config=await settings;
  if(config.features?.chat===false && /^\/(?:apps\/chat|api\/chat|socket\.io)(?:\/|$)/.test(url.pathname))return new Response('Not found',{status:404});
  if(config.features?.blooket===false && /^\/(?:apps\/blooket|blooket)(?:\/|$)/.test(url.pathname))return new Response('Not found',{status:404});
  const entry=config.entryAliases?.[url.pathname];
  if(entry){url.pathname=entry;if(event.request.mode==='navigate')return Response.redirect(url.href,308);}
  const remote=/^\/(?:api(?:\/|$)|socket\.io(?:\/|$)|healthz$|resources\/live(?:\/|$)|wisp(?:\/|$)|download\/|game-cover$|duckmath-games$|(?:reading|math|gn-math|gms-games|gms-studies|reds-misc)-|cloud\/v1\/)/.test(url.pathname);
  if(remote){
   let session=await ensureBackendSession();
   const headers=new Headers(event.request.headers);headers.delete('host');headers.set('X-Nyx-Host-Session',session);
   const body=['GET','HEAD'].includes(event.request.method)?undefined:await event.request.arrayBuffer();
   let requestBackend=activeBackend;
   const send=()=>fetch(new URL(url.pathname+url.search,requestBackend),{method:event.request.method,headers,body,mode:'cors',credentials:'include',redirect:'error',cache:'no-store',signal:event.request.signal});
   let remoteResponse;try{remoteResponse=await send();}catch(error){unavailableBackends.add(requestBackend);if(activeBackend===requestBackend)backendSession=null;if(!['GET','HEAD'].includes(event.request.method))throw error;session=await ensureBackendSession();requestBackend=activeBackend;headers.set('X-Nyx-Host-Session',session);remoteResponse=await send();}
   if(remoteResponse.status===428){
    const detail=await remoteResponse.clone().json().catch(()=>null);
    if(detail?.code==='HOST_SESSION_REQUIRED'){
     const previous=backendSession;if(await previous===session&&backendSession===previous)backendSession=null;
     session=await ensureBackendSession();requestBackend=activeBackend;headers.set('X-Nyx-Host-Session',session);remoteResponse=await send();
    }
   }
   const returnedHeaders=new Headers(remoteResponse.headers);if(event.request.headers.get('origin')==='null'&&/^\/(?:reading|math|gn-math|gms-games|gms-studies|reds-misc)-/.test(url.pathname))returnedHeaders.set('Access-Control-Allow-Origin','null');
   return new Response([204,205,304].includes(remoteResponse.status)||event.request.method==='HEAD'?null:remoteResponse.body,{status:remoteResponse.status,statusText:remoteResponse.statusText,headers:returnedHeaders});
  }
  if(config.aliases[url.pathname])url.pathname=config.aliases[url.pathname];
  if(url.pathname.endsWith('/'))url.pathname+='index.html';
  const response=await fetch(url.href===event.request.url?event.request:url.href,{headers:event.request.headers,credentials:'same-origin'});
  if(!response.ok||event.request.mode!=='navigate'||!url.pathname.endsWith('.html')||url.pathname==='/index.html'||url.pathname==='/connection-check.html')return response;
  let html=await response.text();
  const injection='<meta name="nyx-static-backend" content="'+config.backend+'">'+(config.features?.chat===false?'<meta name="nyx-chat-enabled" content="0">':'')+(config.features?.blooket===false?'<meta name="nyx-blooket-enabled" content="0">':'')+'<script src="'+config.runtime+'"></script>';
  html=html.replace(/<head(?:\s[^>]*)?>/i,match=>match+injection);
  const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('content-encoding');headers.delete('content-disposition');headers.set('Content-Type','text/html; charset=utf-8');
  return new Response(html,{status:response.status,headers});
 })());
});
