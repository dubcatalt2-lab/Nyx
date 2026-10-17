(()=>{
  const config=globalThis.__NYX_STATIC_CONFIG__;
  globalThis.english_RUNTIME_CONFIG=Object.freeze({wispUrl:config.wisp,wispUrls:[config.wisp],presenceUrl:'',publicOrigin:location.origin});
  try{localStorage.setItem('nyx.httpBridge','false');localStorage.setItem('nyx.browserMode','scramjet');}catch{}
  const original=globalThis.fetch;
  globalThis.fetch=function(input,options){let url;try{url=new URL(typeof input==='string'?input:input.url,location.href);}catch{return original.call(this,input,options);}if(url.origin===location.origin&&(/\/api\//.test(url.pathname)||/\/socket.io\//.test(url.pathname)||/\/healthz$/.test(url.pathname)))return Promise.resolve(new Response(JSON.stringify({enabled:false,available:false,error:"This feature needs a N7X backend."}),{status:503,headers:{'content-type':'application/json'}}));return original.call(this,input,options);};
  const style=document.createElement('style');
  style.textContent=`[data-n7x-dock-item="ai"],[data-n7x-dock-item="music"],[data-n7x-dock-item="movies"],[data-n7x-dock-item="chat"],#n7xAccountButton,[data-n7x-profile-slot],[data-settings-category-button="accounts"],[data-settings-category-button="proxy"],[data-global-app-id="nyx-ai"],[data-global-app-id="nyx-chat"],[data-global-app-id="nyxify"],[data-global-app-id="movies"],[data-global-app-id="youtube"],[data-global-app-id="link-checker"],[data-global-app-id="link-generator"],[data-global-app-id="jsdelivr-publisher"],[data-global-app-id="n7x-api-keys"],[data-n7x-presence],.n7x-home-presence,#n7xPresenceIndicator,[data-ai-toggle],[data-ai-send],[data-switch="nyx.httpBridge"]{display:none!important}`;
  document.head.append(style);
  style.textContent+='[data-game-view="cloud"],[data-n7x-latency-bubble],[data-n7x-dock-item="youtube"],[data-n7x-dock-item="vms"],[data-global-app-id="n7x-vms"]{display:none!important}';


  const watched=new WeakSet();
  const attach=frame=>{
    if(watched.has(frame))return;
    watched.add(frame);
    const apply=()=>{try{
      const child=frame.contentDocument;
      if(!child?.head||child.querySelector('style[data-n7x-static-features]'))return;
      const copy=child.createElement('style');copy.dataset.n7xStaticFeatures='';copy.textContent=style.textContent;child.head.append(copy);
    }catch{}};
    frame.addEventListener('load',apply);apply();
  };
  new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes){
    if(node.nodeType!==1)continue;
    if(node.matches('iframe'))attach(node);
    node.querySelectorAll('iframe').forEach(attach);
  }}).observe(document.documentElement,{childList:true,subtree:true});
  document.querySelectorAll('iframe').forEach(attach);
})();
