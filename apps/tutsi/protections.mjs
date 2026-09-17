// Small, explicit host list. Match domain boundaries, never words in a query string.
export const adHosts = ['doubleclick.net','googlesyndication.com','googleadservices.com','adnxs.com','adsrvr.org','adinplay.com','adsterra.com','popads.net','popcash.net','propellerads.com','monetag.com','exoclick.com','trafficjunky.net','taboola.com','outbrain.com','criteo.com','pubmatic.com','rubiconproject.com','amazon-adsystem.com','ads.emulatorjs.org'];
export const riskyExtension = /\.(?:exe|msi|msp|scr|com|bat|cmd|ps1|vbs|vbe|wsf|wsh|jse|hta|jar|apk|appx|msix|dmg|pkg|deb|rpm|sh|crx|iso)(?:$|[?#])/i;
export const protectionDefaults={adBlock:true,popupBlock:true,downloadBlock:true};
export const policyFrom = settings => Object.fromEntries(Object.keys(protectionDefaults).map(key=>[key,settings[key]!==false]));
export function isAdUrl(value) {
  try {const host=new URL(value).hostname.toLowerCase();return adHosts.some(domain=>host===domain||host.endsWith('.'+domain));}catch{return false;}
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
    if(risky||verdict==='blocked'){
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
  if(window.__tutsiProtection)return;
  window.__tutsiProtection=true;
  const risky=new RegExp(riskySource,'i');
  const tell=kind=>{try{parent.postMessage({type:'tutsi:protection',kind},'*')}catch{}};
  const downloadRisk=link=>{
    return [link.getAttribute('download')||'',link.getAttribute('href')||''].some(value=>{try{value=decodeURIComponent(value)}catch{}return risky.test(value)});
  };
  const popupTarget=target=>!!target&&!['_self','_parent','_top'].includes(target.toLowerCase());
  const nativeOpen=window.open;
  window.open=function(...args){if(policy.popupBlock){tell('popup');return null;}return Reflect.apply(nativeOpen,this,args)};
  const denyLink=link=>{
    if(policy.downloadBlock&&downloadRisk(link)){tell('download');return true;}
    if(policy.popupBlock&&popupTarget(link.target||document.querySelector('base[target]')?.target)){tell('popup');return true;}
    return false;
  };
  const click=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){if(!denyLink(this))return Reflect.apply(click,this,arguments)};
  for(const type of ['click','auxclick'])document.addEventListener(type,event=>{
    const link=event.target?.closest?.('a[href],area[href]');
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
export function protectionSource(policy){return `(${pageProtection.toString()})(${JSON.stringify(policyFrom(policy))},${JSON.stringify(riskyExtension.source)});`;}
export function protectionSandbox(settings){
  return 'allow-scripts allow-same-origin allow-forms allow-downloads allow-modals allow-pointer-lock allow-presentation'+(settings.popupBlock===false?' allow-popups':'');
}
