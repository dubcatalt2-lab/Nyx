import {sourceWebsiteUrl} from "./navigation.mjs";
import {browserAdSource} from "./browser-ad-runtime.mjs";
import {gameAdSource} from "./game-ad-runtime.mjs";
﻿// Small, explicit host list. Match domain boundaries, never words in a query string.
export const adHosts = ['adtrafficquality.google','r9x.in','clickadu.com','hilltopads.net','html5.api.gamedistribution.com','gamemonetize.com','imasdk.googleapis.com','mgid.com','onclickads.net','openx.net','playwire.com','sdk.poki.com','trafficjunky.com','venatusmedia.com','doubleclick.net','googlesyndication.com','googleadservices.com','adnxs.com','adsrvr.org','adinplay.com','adsterra.com','popads.net','popcash.net','propellerads.com','monetag.com','exoclick.com','trafficjunky.net','taboola.com','outbrain.com','criteo.com','pubmatic.com','rubiconproject.com','amazon-adsystem.com','ads.emulatorjs.org'];
export const riskyExtension = /\.(?:exe|msi|msp|scr|com|bat|cmd|ps1|vbs|vbe|wsf|wsh|jse|hta|jar|apk|appx|msix|dmg|pkg|deb|rpm|sh|crx|iso)(?:$|[?#])/i;
export const protectionDefaults={adBlock:true,popupBlock:true,downloadBlock:true};
export const policyFrom = settings => Object.fromEntries(Object.keys(protectionDefaults).map(key=>[key,settings[key]!==false]));
export function isAdUrl(value) {
  try {const host=new URL(value).hostname.toLowerCase();return adHosts.some(domain=>host===domain||host.endsWith('.'+domain)) || /(?:^|\/)(?:ads?|ad[-_.]?(?:loader|manager|script)|jump[_-]gamemonetize|poki-(?:master-loader|sdk))\.(?:js|mjs)(?:$|\/)/i.test(new URL(value).pathname) || (host==='serve.app.playsaurus.com' && new URL(value).pathname.includes('/ad-campaigns/'));}catch{return false;}
}
export function riskyFile(value) {try{return riskyExtension.test(decodeURIComponent(String(value)))}catch{return riskyExtension.test(String(value))}}
const notify=kind=>globalThis.dispatchEvent?.(new CustomEvent('tutsi:protection',{detail:{kind}}));
export function protectTransport(transport,getPolicy,{checkDownload=async url=>{
  const response=await fetch('/api/download-safety/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url}),signal:AbortSignal.timeout(6000)});
  if(!response.ok)return 'unverified';return (await response.json()).verdict;
}}={}) {
  const request=transport.request.bind(transport);
  transport.request=async(remote,...args)=>{
    const policy=getPolicy(),url=String(remote);
    if(policy.adBlock&&isAdUrl(url))return {status:200,statusText:'OK',headers:[['content-type','text/plain'],['cache-control','no-store']],body:new Response('').body};
    const response=await request(remote,...args);
    if(!policy.downloadBlock)return response;
    const headers=new Headers(response.headers),disposition=headers.get('content-disposition')||'',type=headers.get('content-type')||'';
    const attachment=/^attachment\b/i.test(disposition);
    const risky=riskyFile(url)||riskyFile(/filename\*?=(?:UTF-8''|["'])?([^"';]+)/i.exec(disposition)?.[1]||'')||/application\/(?:x-msdownload|x-msdos-program|vnd\.android\.package-archive|x-apple-diskimage)/i.test(type);
    let verdict='unverified';
    if(attachment&&!risky){try{verdict=await checkDownload(url)}catch{}}
    const unverifiedRejected=attachment&&!risky&&verdict!=='clear'&&verdict!=='blocked'&&!globalThis.confirm?.('This download source could not be verified. Download anyway?');
    if(risky||verdict==='blocked'||unverifiedRejected){
      try{await response.body?.cancel?.()}catch{}
      notify('download');
      return {status:403,statusText:'Blocked',headers:[['content-type','text/plain; charset=utf-8']],body:new Response('Download blocked by Tutsi. You can change download protection in Settings.').body};
    }
    return response;
  };
  const connect=transport.connect.bind(transport);
  transport.connect=(url,protocols,headers,onopen,onmessage,onclose,onerror)=>{
    if(getPolicy().adBlock&&isAdUrl(url)) {queueMicrotask(()=>{onerror?.(new Error('Blocked advertising connection'));onclose?.(1008,'Blocked')});return [()=>{},()=>{}];}
    return connect(url,protocols,headers,onopen,onmessage,onclose,onerror);
  };
  return transport;
}

// Injected before page scripts. All configuration is serialized, not interpolated code.
export function pageProtection(policy, riskySource) {
  if(window.__tutsiProtection){Object.assign(window.__tutsiProtection,policy);window.__tutsiRefreshPopup?.();return;}
  window.__tutsiProtection=policy;
  const risky=new RegExp(riskySource,'i');
  const tell=kind=>{try{parent.postMessage({type:'tutsi:protection',kind},'*')}catch{}};
  const downloadRisk=link=>{
    return [link.getAttribute('download')||'',link.getAttribute('href')||''].some(value=>{try{value=decodeURIComponent(value)}catch{}return risky.test(value)});
  };
  const popupTarget=target=>!!target&&!['_self','_parent','_top'].includes(target.toLowerCase());
  let guardedOpen;
  window.__tutsiRefreshPopup=()=>{
    if(window.open===guardedOpen)return;
    const nativeOpen=window.open;
    guardedOpen=function(...args){
      if(policy.popupBlock&&String(args[1]||'').toLowerCase()!=='_self'){tell('popup');return null;}
      return Reflect.apply(nativeOpen,this,args);
    };
    window.open=guardedOpen;
  };
  window.__tutsiRefreshPopup();
  const checking=new WeakSet();
  const safeDownload=async link=>{
    if(checking.has(link))return;
    checking.add(link);
    try{
      const href=link.href,filename=link.getAttribute('download')||'';
      let result={verdict:'unverified'};
      const checkUrl=/^(blob|data):/i.test(href)?location.href:href;
      try{
        const host=window.__tutsiCheckDownload;
        if(host)result=await host(checkUrl,filename);
      }catch{}
      if(result.verdict==='blocked'){tell('download');return;}
      if(result.verdict!=='clear'&&!window.confirm('This download source could not be verified. Download anyway?'))return;
      const copy=document.createElement('a');copy.href=href;copy.download=filename;copy.rel='noopener';
      Reflect.apply(click,copy,[]);
    }finally{checking.delete(link);}
  };
  const denyLink=link=>{
    if(policy.downloadBlock&&downloadRisk(link)){tell('download');return true;}
    if(policy.downloadBlock&&(link.hasAttribute('download')||/\.(zip|7z|rar|bin)(?:$|[?#])/i.test(link.href))){void safeDownload(link);return true;}
    if(policy.popupBlock&&popupTarget(link.target||document.querySelector('base[target]')?.target)){tell('popup');return true;}
    return false;
  };
  const click=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){if(!denyLink(this))return Reflect.apply(click,this,arguments)};
  for(const type of ['click','auxclick'])document.addEventListener(type,event=>{
    const link=event.target?.closest?.('a[href],area[href]');
    // Deliberate search results stay in this frame; unsolicited popups stay blocked.
    if(link&&event.isTrusted&&type==='click'&&event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey&&!link.hasAttribute('download')&&!downloadRisk(link)){
      let source=new URL(location.href);
      const envelope=source.pathname.match(/^\/~\/tm\/[^/]+\/[^/]+\/(.+)$/);
      try{if(envelope)source=new URL(decodeURIComponent(envelope[1]));}catch{}
      const host=source.hostname.replace(/^www\./,'');
      const result=host==='duckduckgo.com'?link.closest('article,.result,.results_links,[data-testid="result"]'):host==='google.com'?link.closest('#search,.MjjYud,.g'):host==='bing.com'?link.closest('.b_algo'):null;
      if(result){
        try{
          let url=new URL(link.href,location.href),direct='';
          if(url.hostname==='duckduckgo.com')direct=url.searchParams.get('uddg')||'';
          if(/^(www\.)?google\.com$/.test(url.hostname)&&url.pathname==='/url')direct=url.searchParams.get('q')||url.searchParams.get('url')||'';
          if(/^(www\.)?bing\.com$/.test(url.hostname)&&url.pathname.startsWith('/ck/a')){const encoded=url.searchParams.get('u')||'';if(encoded.startsWith('a1'))direct=atob(encoded.slice(2).replace(/-/g,'+').replace(/_/g,'/'));}
          if(/^https?:\/\//i.test(direct))url=new URL(direct);
          if(/^https?:$/.test(url.protocol)){
            link.href=url.href;link.target='_self';
            if(denyLink(link)){event.preventDefault();event.stopImmediatePropagation();}
            return;
          }
        }catch{}
      }
    }
    if(link&&denyLink(link)){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  document.addEventListener('submit',event=>{
    if(policy.popupBlock&&popupTarget(event.submitter?.formTarget||event.target?.target)) {event.preventDefault();event.stopImmediatePropagation();tell('popup');}
  },true);
  const submit=HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit=function(){if(policy.popupBlock&&popupTarget(this.target)){tell('popup');return;}return Reflect.apply(submit,this,arguments)};
  if(policy.adBlock){
    const style=document.createElement('style');style.textContent='.adsbygoogle,[data-ad-client],[data-ad-slot],.ad-container,.ad-banner,.ad-overlay,[aria-label="Advertisement"]{display:none!important}';
    (document.head||document.documentElement).append(style);
  }
}
export function protectionSource(policy){return `(${pageProtection.toString()})(${JSON.stringify(policyFrom(policy))},${JSON.stringify(riskyExtension.source)});\n${policy.adBlock!==false?browserAdSource+'\n'+gameAdSource:""}`;}
export function protectionSandbox(settings){
  return 'allow-scripts allow-same-origin allow-forms allow-downloads allow-modals allow-pointer-lock allow-presentation'+(settings.popupBlock===false?' allow-popups':'');
}

// Share Nyx's game hook and protect descendants of registered built-in app frames.
export function installGameProtectionHost(getSettings, getAppFrames) {
  window.__tutsiGameHost = true;
  const watched = new WeakSet(), documents = new WeakSet();
  function install(frame) {
    if (frame?.tagName !== 'IFRAME') return false;
    try {
      let owner = frame.ownerDocument.defaultView;
      const hosts = getAppFrames().map(frame=>frame.contentWindow);
      while (owner && !hosts.includes(owner) && owner !== window) owner = owner.parent;
      if (!hosts.includes(owner)) return false;
    } catch { return false; }
    frame.setAttribute('sandbox',frame.ownerDocument.location.pathname==='/apps/movies/'?'allow-scripts allow-same-origin allow-forms allow-presentation':protectionSandbox(getSettings()));
    const protect = () => {
      try {
        const doc = frame.contentDocument;
        if (!doc?.documentElement) return;
        frame.setAttribute('sandbox',frame.ownerDocument.location.pathname==='/apps/movies/'?'allow-scripts allow-same-origin allow-forms allow-presentation':protectionSandbox(getSettings()));
        installPageProtection(frame,getSettings());
        const scan = () => doc.querySelectorAll('iframe').forEach(install);
        scan();
        if (!documents.has(doc)) {
          documents.add(doc);
          let timer;
          new MutationObserver(() => {
            if (!timer) timer = setTimeout(() => {timer=0;scan()}, 50);
          }).observe(doc.documentElement,{childList:true,subtree:true});
        }
      } catch {} // Cross-origin providers cannot be modified by the host.
    };
    if (!watched.has(frame)) {
      watched.add(frame);
      frame.addEventListener('load',()=>{protect();setTimeout(protect,80);setTimeout(protect,500)});
    }
    protect();
    return true;
  }
  window.nyxInstallGameAdProtection = install;
  return install;
}

// Install after the engine has attached too: its window hooks can replace early guards.
export function installPageProtection(frame,settings){
  try{
    const win=frame.contentWindow;
    win.__tutsiCheckDownload=async(url,filename)=>{
      const response=await fetch('/api/download-safety/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:sourceWebsiteUrl(url,location.origin)||url,filename}),signal:AbortSignal.timeout(6000)});
      if(!response.ok)return {verdict:'unverified'};
      return response.json();
    };
    win.eval(protectionSource(settings));
  }catch{} // Cross-origin content is constrained by the frame sandbox instead.
}

export function installShellPopupProtection(getSettings,isBrowsing){
  const nativeOpen=window.open;
  window.open=function(...args){
    if(getSettings().popupBlock!==false&&isBrowsing()&&String(args[1]||'').toLowerCase()!=='_self'){
      notify('popup');return null;
    }
    return Reflect.apply(nativeOpen,this,args);
  };
}
