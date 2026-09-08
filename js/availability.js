/* Availability is evidence of reachability, not proof that a machine crashed. */
(()=>{
  let failures=0, firstFailure=0, relayFailures=0, relayUrl='', getRelay=null, busy=false, relayTimer=null, cancelProbe=null, relayGeneration=0;
  let hostDown=false, relayDown=false, banner=null;
  function render(){
    const offline=navigator.onLine===false;
    const message=offline ? 'You are offline. Check your internet connection.' : hostDown
      ? 'Nyx VPS is unreachable and may be down. Report to vdrtes on Discord immediately!'
      : relayDown ? (getRelay?.().custom
        ? 'Having trouble connecting to your custom Wisp relay. Retrying automatically...'
        : 'Having trouble connecting to Wisp. Retrying automatically...') : '';
    if(!message){if(banner) banner.hidden=true;return}
    if(!banner){
      banner=document.createElement('div');banner.id='nyxAvailabilityWarning';
      // Shadow DOM keeps semantic warning colors independent of all themes.
      const root=banner.attachShadow({mode:'open'});
      root.innerHTML='<style>:host{position:fixed!important;left:12px!important;right:12px!important;bottom:14px!important;z-index:2147483647!important;pointer-events:none!important}:host([hidden]){display:none!important}.notice{box-sizing:border-box;display:flex;align-items:center;gap:12px;max-width:650px;margin:auto;padding:14px 18px;border:1px solid #9c3f49;border-radius:14px;background:#201014;color:#ff9aa5;box-shadow:0 6px 24px #0006;font:600 14px/1.5 system-ui,sans-serif;overflow-wrap:anywhere}svg{width:25px;height:25px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8}@media(max-width:480px){.notice{padding:12px;font-size:13px}}</style><div class="notice" role="alert" aria-atomic="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 4.2 2.1 18.5A1.7 1.7 0 0 0 3.6 21h16.8a1.7 1.7 0 0 0 1.5-2.5L13.7 4.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9v5m0 3v1"/></svg><span></span></div>';
      document.body.append(banner);
    }
    const text=banner.shadowRoot.querySelector('span');
    if(text.textContent!==message) text.textContent=message;
    banner.hidden=false;
  }
  function recordHealth(ok){
    if(navigator.onLine===false){reset();render();return}
    if(ok){const recovered=hostDown;failures=0;firstFailure=0;hostDown=false;if(recovered)scheduleRelay(0)}
    else{
      if(!failures) firstFailure=Date.now();
      failures++;
      if(failures>=3 && Date.now()-firstFailure>=10000) hostDown=true;
    }
    render();
  }
  function reset(){failures=0;firstFailure=0;hostDown=false;relayFailures=0;relayDown=false}
  function probe(url){
    return new Promise(resolve=>{
      let socket, timer, settled=false;
      const done=ok=>{if(settled)return;settled=true;clearTimeout(timer);cancelProbe=null;if(socket){socket.onopen=socket.onerror=socket.onclose=null;try{socket.close()}catch{}}resolve(ok)};
      cancelProbe=()=>done(null);
      timer=setTimeout(()=>done(false),10000);
      try{socket=new WebSocket(url);socket.onopen=()=>done(true);socket.onerror=socket.onclose=()=>done(false)}catch{done(false)}
    });
  }
  function scheduleRelay(delay){
    clearTimeout(relayTimer);
    relayTimer=setTimeout(()=>void checkRelay(),delay);
  }
  function resumeRelay(){
    relayGeneration++;
    cancelProbe?.();
    clearTimeout(relayTimer);
    relayFailures=0;
    if(!document.hidden && navigator.onLine!==false) scheduleRelay(0);
  }
  async function checkRelay(){
    if(busy || document.hidden || navigator.onLine===false || hostDown || !getRelay) return;
    const selected=getRelay();
    if(!/^wss?:\/\//i.test(selected.url)){
      relayUrl='';relayFailures=0;relayDown=false;render();scheduleRelay(30000);return;
    }
    if(relayUrl!==selected.url){relayUrl=selected.url;relayFailures=0;relayDown=false;render()}
    const generation=relayGeneration;
    busy=true;
    try{
      const ok=await probe(selected.url);
      if(generation!==relayGeneration || ok===null || document.hidden || navigator.onLine===false) return;
      if(getRelay().url!==selected.url){relayFailures=0;relayDown=false;render();scheduleRelay(0);return}
      relayFailures=ok?0:relayFailures+1;
      relayDown=ok?false:(relayDown || relayFailures>=3);
      render();
      scheduleRelay(ok?30000:5000);
    }finally{busy=false}
  }
  window.NyxAvailability={recordHealth,start(resolveRelay){
    if(getRelay)return;
    getRelay=resolveRelay;
    void checkRelay();
    addEventListener('offline',()=>{reset();resumeRelay();render()});
    addEventListener('online',()=>{reset();resumeRelay();render()});
    document.addEventListener('visibilitychange',resumeRelay);
  }};
})();
