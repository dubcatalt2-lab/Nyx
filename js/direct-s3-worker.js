const configuration=new URL('./direct-s3-config.json',self.location.href);
const settings=fetch(configuration,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Hosting configuration unavailable');return r.json();});
// A cross-site S3 frame and its worker may use different cookie partitions.
// Establish the session in the context that actually forwards API requests.
let backendSession;
function ensureBackendSession(){
 return backendSession ||= (async()=>{
  const config=await settings;let result;
  for(let i=0;i<2;i++){
   const response=await fetch(config.backend+'/api/static-host/check',{credentials:'include',cache:'no-store'});
   if(!response.ok)throw Error('The connection could not be established.');
   result=await response.json();
  }
  if(!result.supported||!result.cookies)throw Error('The required session cookie could not be saved.');
 })();
}
self.addEventListener('message',event=>{
 if(event.data?.type!=='nyx:static-session'||!event.ports[0])return;
 event.waitUntil(ensureBackendSession().then(()=>event.ports[0].postMessage({ok:true}),error=>event.ports[0].postMessage({error:error.message})));
});
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin||url.pathname==='/direct-s3-config.json'||url.pathname.startsWith('/~/'))return;
 event.respondWith((async()=>{
  const config=await settings;
  if(config.features?.chat===false && /^\/(?:apps\/chat|api\/chat|socket\.io)(?:\/|$)/.test(url.pathname))return new Response('Not found',{status:404});
  const remote=/^\/(?:api(?:\/|$)|socket\.io(?:\/|$)|healthz$|resources\/live(?:\/|$)|wisp(?:\/|$)|download\/|gn-math-|cloud\/v1\/)/.test(url.pathname);
  if(remote){
   await ensureBackendSession();
   const headers=new Headers(event.request.headers);headers.delete('host');
   const remoteResponse=await fetch(new URL(url.pathname+url.search,config.backend),{method:event.request.method,headers,body:['GET','HEAD'].includes(event.request.method)?undefined:await event.request.arrayBuffer(),mode:'cors',credentials:'include',redirect:'error',cache:'no-store',signal:event.request.signal});
   return new Response([204,205,304].includes(remoteResponse.status)||event.request.method==='HEAD'?null:remoteResponse.body,{status:remoteResponse.status,statusText:remoteResponse.statusText,headers:remoteResponse.headers});
  }
  if(config.aliases[url.pathname])url.pathname=config.aliases[url.pathname];
  if(url.pathname.endsWith('/'))url.pathname+='index.html';
  const response=await fetch(url.href===event.request.url?event.request:url.href,{headers:event.request.headers,credentials:'same-origin'});
  if(!response.ok||event.request.mode!=='navigate'||!url.pathname.endsWith('.html')||url.pathname==='/index.html')return response;
  let html=await response.text();
  const injection='<meta name="nyx-static-backend" content="'+config.backend+'">'+(config.features?.chat===false?'<meta name="nyx-chat-enabled" content="0">':'')+'<script src="'+config.runtime+'"></script>';
  html=html.replace(/<head(?:\s[^>]*)?>/i,match=>match+injection);
  const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('content-encoding');headers.delete('content-disposition');headers.set('Content-Type','text/html; charset=utf-8');
  return new Response(html,{status:response.status,headers});
 })());
});
