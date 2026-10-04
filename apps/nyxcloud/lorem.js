export function loremDesktop({api,screen,status,connected,reconnect}){
  let disposed=false,timer,renewTimer,displayTimer,resizeObserver,queueCancelled=false,opened=false;
  const layout=()=>{
    const frame=screen.querySelector('iframe');if(!frame||disposed)return;
    if(screen.dataset.scale==='fit'){frame.style.cssText='';return;}
    const {width,height}=screen.getBoundingClientRect();if(!width||!height)return;
    const desktopHeight=Math.max(720,Math.round(height)),desktopWidth=Math.round(desktopHeight*16/9);
    frame.style.cssText='position:absolute;left:0;top:0;transform-origin:top left;width:'+desktopWidth+'px;height:'+desktopHeight+'px;transform:scale('+width/desktopWidth+','+height/desktopHeight+')';
  };
  screen.addEventListener('nyx:display-scale',layout);
  const loading=document.createElement('div');loading.className='vm-loading';loading.setAttribute('role','status');
  loading.innerHTML=`<section class="boot-card">
    <div class="boot-scene" aria-hidden="true">
      <div class="boot-halo"></div>
      <div class="boot-desktop">
        <div class="boot-window-bar"><span></span><span></span><span></span><b>NYXCLOUD</b></div>
        <div class="boot-window-body"><div class="boot-orbit"><svg viewBox="0 0 24 24"><path d="m5 17 4-10 6 10 4-10"/></svg></div><div class="boot-scan"></div></div>
        <div class="boot-window-dock"><i></i><i></i><i></i><i></i></div>
      </div>
      <div class="boot-stand"></div>
    </div>
    <p class="boot-eyebrow">YOUR PRIVATE WORKSPACE</p>
    <h1>Booting your desktop</h1>
    <div class="boot-status"><span class="boot-status-dot" aria-hidden="true"></span><p class="boot-message" aria-live="polite"></p></div>
    <div class="boot-steps" aria-hidden="true"><span class="boot-step active"><i>1</i>Prepare</span><span class="boot-step"><i>2</i>Boot</span><span class="boot-step"><i>3</i>Display</span></div>
    <p class="boot-session-note">Sessions last up to 60 minutes. Save downloaded files before leaving.</p>
    <button class="boot-cancel boot-retry" hidden>Leave queue</button>
    <button class="boot-retry boot-reconnect" hidden>Reconnect</button>
  </section>`;
  const message=loading.querySelector('.boot-message'),indicator=loading.querySelector('.boot-orbit'),retryButton=loading.querySelector('.boot-reconnect'),cancelButton=loading.querySelector('.boot-cancel');
  cancelButton.onclick=async()=>{
    queueCancelled=true;clearTimeout(timer);cancelButton.disabled=true;
    try{const result=await api('/lorem/cancel','POST');if(disposed)return;if(result.status==='ready'){open(result.vm);return;}cancelButton.hidden=true;loading.querySelector('h1').textContent='You left the queue';progress('Your place has been released.');retryButton.textContent='Join queue';retryButton.hidden=false;}
    catch(error){if(!disposed){queueCancelled=false;failed(error);}}
    finally{cancelButton.disabled=false;}
  };
  retryButton.onclick=()=>reconnect?.();screen.replaceChildren(loading);
  function progress(text,stage=0){if(disposed)return;message.textContent=text;status(text);loading.querySelectorAll('.boot-step').forEach((step,i)=>{step.classList.toggle('active',i===stage);step.classList.toggle('done',i<stage);});}
  function failed(error){if(disposed)return;indicator.hidden=true;loading.dataset.error='true';loading.querySelector('h1').textContent='Unable to open desktop';retryButton.hidden=!reconnect;progress(error.message||'The desktop could not start.');}
  function open(vm){
    if(disposed)return;
    opened=true;cancelButton.hidden=true;loading.querySelector('h1').textContent='Opening your desktop';
    const u=new URL(vm.url);if(u.origin!=='https://loremgroup.org'||u.username||u.password||u.search||u.hash||!/^\/vm\/[A-Za-z0-9_-]+\/$/.test(u.pathname))throw Error('Unsupported desktop URL.');
    const frame=document.createElement('iframe');frame.title='NyxCloud desktop';frame.src=u.href;frame.referrerPolicy='no-referrer';
    frame.allow='clipboard-read; clipboard-write; autoplay; fullscreen; display-capture; microphone; gamepad';
    frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-downloads allow-pointer-lock');frame.allowFullscreen=true;
    frame.addEventListener('load',()=>{if(disposed)return;clearTimeout(displayTimer);loading.remove();status('Desktop open');connected();},{once:true});
    screen.replaceChildren(frame,loading);resizeObserver?.disconnect();resizeObserver=new ResizeObserver(layout);resizeObserver.observe(screen);layout();progress('Opening your display...',2);
    displayTimer=setTimeout(()=>{if(!disposed)failed(Error('The display is taking longer than expected. You can reconnect.'));},45000);
  }
  async function poll(){
    try{
      const data=await api('/lorem/queue');if(disposed||queueCancelled)return;
      if(data.status==='ready'){open(data.vm);return;}
      if(data.status==='recovering')throw Error(data.message);
      if(data.status!=='queued')throw Error('Your queue reservation ended. Use Reconnect to join again.');
      cancelButton.hidden=false;loading.querySelector('h1').textContent=data.position?'You’re #'+data.position+' in line':'Waiting for a desktop';
      progress(data.reason==='service_unavailable'?'The service is reconnecting. Your place is saved.':data.providerPosition?'Waiting for provider capacity · provider position '+data.providerPosition:'Desktops are busy. Yours will open automatically.');
      timer=setTimeout(poll,5000);
    }catch(error){
      if(disposed||queueCancelled)return;
      if(error.status>=500||error.name==='TypeError'||error.name==='TimeoutError'){progress('Reconnecting to the queue. Your place is saved.');timer=setTimeout(poll,10000);}
      else failed(error);
    }
  }
  async function load(reconcile=false){
    progress('Preparing your workspace...');const data=await api('/lorem/vms');if(disposed)return;
    const existing=data.vms.find(vm=>vm.url&&/running|started/i.test(vm.state))||data.vms.find(vm=>vm.url);
    if(existing){
      if(/stopped|exited/i.test(existing.state)){
        progress('Starting the virtual machine...',1);await api('/lorem/start/'+encodeURIComponent(existing.id),'POST');if(disposed)return;
      }
      open(existing);return;
    }
    if(data.queued){await poll();return;}
    if(data.vms.length)throw Error('Your VM is not ready to connect. Use Reconnect to check again.');
    if(reconcile)throw Error('The desktop is still being prepared. Use Reconnect to check again.');
    progress('Allocating your virtual machine...',1);
    let result;try{result=await api('/lorem/create','POST');}catch(error){if(error.status===409&&!disposed)return load(true);throw error;}
    if(disposed)return;
    if(result.status==='ready')open(result.vm);else if(result.status==='queued')await poll();else throw Error('The VM service returned an unexpected response.');
  }
  let renewing=false;
  renewTimer=setInterval(async()=>{
    if(!opened||disposed||renewing)return;renewing=true;
    try{const data=await api('/lorem/queue');if(disposed)return;if(data.status==='idle'){screen.replaceChildren(loading);opened=false;failed(Error('Your desktop session ended. Reconnect to start a new session.'));}}
    catch(error){
    if(disposed)return;
    if([401,403,404].includes(error.status)){screen.replaceChildren();dispose();status('Sign in again to reconnect.');}
    else status(error.message);
    }finally{renewing=false;}
  },30000);
  load().catch(failed);
  function dispose(){disposed=true;resizeObserver?.disconnect();screen.removeEventListener('nyx:display-scale',layout);clearTimeout(timer);clearTimeout(displayTimer);clearInterval(renewTimer);}
  return dispose;
}
