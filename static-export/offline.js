(()=>{
  const config=globalThis.__NYX_STATIC_CONFIG__;
  globalThis.__NYX_RUNTIME_CONFIG__=Object.freeze({wispUrl:config.wisp,wispUrls:[config.wisp],presenceUrl:'',publicOrigin:location.origin});
  try{localStorage.setItem('nyx.httpBridge','false');localStorage.setItem('nyx.browserMode','scramjet');}catch{}
  const original=globalThis.fetch;
  globalThis.fetch=function(input,options){let url;try{url=new URL(typeof input==='string'?input:input.url,location.href);}catch{return original.call(this,input,options);}if(url.origin===location.origin&&(/\/api\//.test(url.pathname)||/\/socket.io\//.test(url.pathname)||/\/healthz$/.test(url.pathname)))return Promise.resolve(new Response(JSON.stringify({enabled:false,available:false,error:'This feature needs a Nyx backend.'}),{status:503,headers:{'content-type':'application/json'}}));return original.call(this,input,options);};
  const style=document.createElement('style');
  style.textContent=`[data-nyx-dock-item="ai"],[data-nyx-dock-item="music"],[data-nyx-dock-item="movies"],[data-nyx-dock-item="chat"],#nyxAccountButton,[data-nyx-profile-slot],[data-settings-category-button="accounts"],[data-settings-category-button="proxy"],[data-global-app-id="nyx-ai"],[data-global-app-id="nyx-chat"],[data-global-app-id="nyxify"],[data-global-app-id="movies"],[data-global-app-id="youtube"],[data-global-app-id="link-checker"],[data-global-app-id="link-generator"],[data-global-app-id="jsdelivr-publisher"],[data-global-app-id="nyx-api-keys"],[data-nyx-presence],.nyx-home-presence,#nyxPresenceIndicator,[data-ai-toggle],[data-ai-send],[data-switch="nyx.httpBridge"]{display:none!important}`;
  document.head.append(style);
  style.textContent+='[data-game-view="cloud"],[data-nyx-latency-bubble]{display:none!important}';
})();
