import {Transport} from './pilgrimage.mjs';
import {source} from './passage.mjs';
import {content} from './liturgy.mjs';
import {partitionSuffix} from './partition.mjs';

const transport=new Transport();
async function authorize(clientId){
  let client=clientId?await self.clients.get(clientId):null;
  if(!client||client.type!=='window')client=(await self.clients.matchAll({type:'window'})).find(value=>new URL(value.url).origin===location.origin);
  if(!client)throw new Error('Document window unavailable');
  return new Promise((resolve,reject)=>{
    const channel=new MessageChannel();
    const finish=(error,token)=>{clearTimeout(timeout);channel.port1.close();error?reject(error):resolve(token)};
    const timeout=setTimeout(()=>finish(new Error('Document authorization timed out')),5000);
    channel.port1.onmessage=event=>typeof event.data?.token==='string'?finish(null,event.data.token):finish(new Error('Document authorization unavailable'));
    client.postMessage({type:'document-ticket'},[channel.port2]);
  });
}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  const path=url.pathname.match(/^\/content\/[a-z0-9-]+\//i)?.[0];
  if(!path||url.origin!==location.origin)return;
  // Navigation establishes the HttpOnly session in the destination's cookie partition.
  if(event.request.mode==='navigate')return;
  if(event.request.headers.get('accept')?.includes('text/event-stream'))return;
  event.respondWith((async()=>{
    let stage='address';
    try{
      transport.started ||= Date.now();
      const workerEntry=url.searchParams.has('document-mode');
      const mode=url.searchParams.get('document-mode')==='module'?'module':'classic';
      url.searchParams.delete('document-mode');url.searchParams.delete('document-ready-at');
      const target=source(url.href,path);
      const headers=new Headers(event.request.headers);
      headers.delete('cookie');headers.set('x-document-credentials',event.request.credentials);
      // Worker WebSockets do not consistently carry partitioned cookies.
      // This single-use ticket grants access only to this document origin.
      stage='authorization';
      headers.set('x-document-access',await authorize(event.clientId));
      if(event.request.referrer){try{headers.set('referer',source(event.request.referrer,path));}catch{}}
      stage='transport';
      const result=await transport.fetch(target,{method:event.request.method,headers,signal:event.request.signal,body:['GET','HEAD'].includes(event.request.method)?undefined:await event.request.arrayBuffer()});
      const snapshot=result.headers.get('x-document-cookies');
      if(snapshot){
        const value=JSON.parse(snapshot),origin=new URL(target).origin;
        for(const client of await self.clients.matchAll({type:'window'}))client.postMessage({type:'cookies',origin,value});
      }
      const broker=new URL(location.origin);broker.hostname='documents.'+partitionSuffix(broker.hostname);
      stage='transform';
      return await content(result,target,location.origin+path,event.request.destination,mode,{isolated:true,workerEntry,broker:broker.origin,readyAt:transport.started,cookies:result.headers.get('x-document-cookies')||''});
    }catch{return new Response('Document request failed',{status:502,headers:{'content-type':'text/plain','cache-control':'no-store','x-document-failure':stage}});}
  })());
});
