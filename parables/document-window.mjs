const launches=new WeakMap();
const activations=new Map();
export function documentOrigin(config=globalThis.__NYX_RUNTIME_CONFIG__||{},page=location){
  const local=['localhost','127.0.0.1','[::1]'].includes(page.hostname);
  let saved='';
  try{saved=localStorage.getItem('nyx.documentOrigin')||'';}catch{}
  const value=saved||config.documentOrigin||(local?'http://'+page.hostname+':8082':'');
  if(!value)throw Error('The document service has not been configured.');
  const url=new URL(value);
  if(url.origin===page.origin||(!local&&url.hostname===page.hostname)||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!['http:','https:'].includes(url.protocol)||(page.protocol==='https:'&&url.protocol!=='https:'))throw Error('The document service requires a separate secure origin.');
  return url.origin;
}

export function openDocument(element,value,{signal,config,page=location,onNavigate,onError,onLinkMenu}={}){
  signal?.throwIfAborted();
  const target=new URL(value);
  if(!['http:','https:'].includes(target.protocol)||target.username||target.password)throw Error('Unsupported document address.');
  const origin=documentOrigin(config,page);
  const address=origin+'/#'+encodeURIComponent(target.href);
  element.removeAttribute('srcdoc');
  element.dataset.documentSource=target.href;
  const activated=globalThis.navigator?.userActivation?.hasBeenActive===true;
  if(activated&&!activations.has(origin))activations.set(origin,Date.now());
  const readyAt=activated?activations.get(origin):0;
  const previous=launches.get(element);
  previous?.();
  const receive=event=>{
    if(event.source!==element.contentWindow||event.origin!==origin||element.src!==address)return;
    if(event.data?.type==='document-ready'&&readyAt)element.contentWindow.postMessage({type:'document-start',url:target.href,readyAt},origin);
    if(event.data?.type==='document-error')onError?.(String(event.data.message||'Document startup failed'));
    if(event.data?.type==='document-link-menu'){
      try{const link=new URL(event.data.url),bounds=element.getBoundingClientRect();
        if(['http:','https:'].includes(link.protocol))onLinkMenu?.({url:link.href,x:bounds.left+Number(event.data.x||0),y:bounds.top+Number(event.data.y||0)});
      }catch{}
    }
    if(event.data?.type==='document-navigation'){
      try{
        const next=new URL(event.data.url);
        if(!['http:','https:'].includes(next.protocol)||next.username||next.password)return;
        element.dataset.documentSource=next.href;
        onNavigate?.({url:next.href,title:String(event.data.title||'').slice(0,512)});
      }catch{}
    }
  };
  const cleanup=()=>window.removeEventListener('message',receive);
  launches.set(element,cleanup);
  window.addEventListener('message',receive);
  if(element.src===address)element.contentWindow?.postMessage({type:'document-prepare',url:target.href},origin);
  else element.src=address;
  const cancel=()=>{cleanup();if(element.src===address)element.src='about:blank';};
  signal?.addEventListener('abort',cancel,{once:true});
  return {managed:true,engine:'document',url:target.href};
}
