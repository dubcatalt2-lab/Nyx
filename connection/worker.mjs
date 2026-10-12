import {source} from './address.mjs';
import {content} from './transform.mjs';
import {cookieStore} from './cookies.mjs';
const profiles=new Map();
const storage=cookieStore();
function profileFor(id){
  if(!profiles.has(id))profiles.set(id,storage.then(store=>store.load(id)).then(cookies=>({cookies,save:()=>storage.then(store=>store.save(id,cookies))})));
  return profiles.get(id);
}
const sessions = new Map();
const reconnecting = new Map();

function reconnect(id){
  if(reconnecting.has(id))return reconnecting.get(id).promise;
  let finish;
  const promise=new Promise(resolve=>{finish=resolve;});
  const timer=setTimeout(()=>{reconnecting.delete(id);finish(null);},8000);
  reconnecting.set(id,{promise,resolve:value=>{clearTimeout(timer);reconnecting.delete(id);finish(value);}});
  void self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
    for(const client of clients){
      const url=new URL(client.url);
      if(url.origin===self.location.origin&&url.pathname==='/')client.postMessage({type:'document-reconnect',session:id});
    }
  }).catch(()=>reconnecting.get(id)?.resolve(null));
  return promise;
}

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if(event.data?.type==='cookie'){
    event.waitUntil((async()=>{
      const url=new URL(event.source.url),match=url.pathname.match(/^\/content\/([a-z0-9-]+)\//i);
      const session=match&&sessions.get(match[1]);
      if(!session)return;
      const target=source(url.href,match[0]),profile=await profileFor(session.profile);
      profile.cookies.set(target,event.data.value);
      await profile.save();
      event.source.postMessage({type:'cookies',base:target,value:profile.cookies.snapshot(target)});
    })());
    return;
  }
  if(!event.source?.url||new URL(event.source.url).origin!==self.location.origin||new URL(event.source.url).pathname!=='/')return;
  if(!/^[a-z0-9-]+$/i.test(event.data?.profile||'')||!Number.isFinite(event.data.readyAt)||event.data.readyAt<=0)return;
  if (event.data?.type !== 'connect' || !/^[a-z0-9-]+$/i.test(event.data.session) || !event.ports[0]) return;
  const port = event.ports[0];
  const pending = new Map();
  let sequence = 0;
  port.onmessage = message => {
    const next = pending.get(message.data?.id);
    if (!next) return;
    pending.delete(message.data.id);
    clearTimeout(next.timer);
    if (message.data.error) next.reject(new Error(message.data.error));
    else{
      const response=new Response([204,205,304].includes(message.data.status) || next.method === 'HEAD' ? null : message.data.body, {status: message.data.status, headers: message.data.headers});
      Object.defineProperty(response,'headerPairs',{value:message.data.headers});
      next.resolve(response);
    }
  };
  const previous = sessions.get(event.data.session);
  if(previous&&previous.owner!==event.source.id)return;
  previous?.close();
  sessions.set(event.data.session, {
    profile:event.data.profile,owner:event.source.id,readyAt:event.data.readyAt,
    close() { for (const next of pending.values()) { clearTimeout(next.timer); next.reject(new Error('Session replaced')); } port.close(); },
    async fetch(request,headers=[...request.headers]) {
      const body = request.body ? await request.arrayBuffer() : null;
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('Document request timed out')); }, 65000);
        pending.set(id, {resolve, reject, timer, method: request.method});
        port.postMessage({id, url: request.url, method: request.method, headers, body}, body ? [body] : []);
      });
    }
  });
  port.postMessage({ready: true});
  reconnecting.get(event.data.session)?.resolve(sessions.get(event.data.session));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const match = url.pathname.match(/^\/content\/([a-z0-9-]+)\//i);
  if (!match) return;
  const prefix = match[0];
  event.respondWith((async () => {
    const session = sessions.get(match[1]) || await reconnect(match[1]);
    if (!session) return new Response('<!doctype html><title>Reconnect</title><p>Return to the document window and press Open to reconnect.</p>', {status: 409, headers: {'content-type':'text/html'}});
    try {
      const isWorker = ['worker','sharedworker'].includes(event.request.destination);
      const workerEntry=url.searchParams.has('document-mode');
      const mode = isWorker && url.searchParams.get('document-mode') === 'module' ? 'module' : 'classic';
      if (isWorker) url.searchParams.delete('document-mode');
      if (isWorker) url.searchParams.delete('document-ready-at');
      const target = source(url.href, prefix);
      if(!await self.clients.get(session.owner)){session.close();sessions.delete(match[1]);throw new Error('Document window closed');}
      const profile=await profileFor(session.profile);
      const headers=new Headers(event.request.headers);
      headers.delete('cookie');
      let parent=target;
      if(event.request.referrer){
        try{parent=source(event.request.referrer,prefix);}catch{}
      }
      const sameOrigin=new URL(parent).origin===new URL(target).origin;
      const credentials=event.request.credentials==='include'||(event.request.credentials==='same-origin'&&sameOrigin);
      const context=sameOrigin?'strict':event.request.mode==='navigate'&&event.request.method==='GET'?'lax':'none';
      if(credentials){const value=profile.cookies.header(target,context);if(value)headers.set('cookie',value);}
      if(headers.has('origin'))headers.set('origin',new URL(parent).origin);
      if(headers.has('referer'))headers.set('referer',parent);
      const request = new Request(target, {method: event.request.method, headers, body: ['GET','HEAD'].includes(event.request.method) ? undefined : await event.request.arrayBuffer()});
      const response = await session.fetch(request,[...headers]);
      if(credentials&&profile.cookies.receive(target,response.headerPairs)){
        await profile.save();
        if(event.clientId){
          const client=await self.clients.get(event.clientId);
          if(client){
            try{const page=source(client.url,prefix);client.postMessage({type:'cookies',base:page,value:profile.cookies.snapshot(page)});}catch{}
          }
        }
      }
      return await content(response, target, prefix, event.request.destination, mode,{workerEntry,readyAt:session.readyAt,cookies:JSON.stringify(profile.cookies.snapshot(target))});
    } catch {
      return new Response('Document request failed', {status: 502, headers: {'content-type': 'text/plain'}});
    }
  })());
});

