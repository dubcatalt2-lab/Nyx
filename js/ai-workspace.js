(function(){
  'use strict';

  const MESSAGE_KEY='nyx.aiMessages';
  const THREADS_KEY='nyx.aiThreads.v1';
  const ACTIVE_THREAD_KEY='nyx.aiActiveThread';
  const MODEL_KEY='nyx.aiModel';
  const PERSONAL_KEY_SESSION='nyx.aiPersonalKey.session';
  const PERSONAL_KEY_DEVICE='nyx.aiPersonalKey.device';
  const PERSONAL_BASE_SESSION='nyx.aiPersonalBaseUrl.session';
  const PERSONAL_BASE_DEVICE='nyx.aiPersonalBaseUrl.device';
  const PERSONAL_PROFILES_SESSION='nyx.aiPersonalProfiles.session';
  const PERSONAL_PROFILES_DEVICE='nyx.aiPersonalProfiles.device';
  const PERSONAL_ACTIVE_PROFILE='nyx.aiPersonalProfile.active';
  const PROVIDER_KEY='nyx.aiSharedProvider';
  const RESPONSE_DEPTH_KEY='nyx.aiResponseDepth';
  const USAGE_KEY='nyx.aiUsage.v1';
  const DEFAULT_MODEL='chatgpt-5.4-mini';
  const MAX_MESSAGES=40;
  const MAX_THREADS=40;
  const MAX_INPUT_HEIGHT=190;
  const MAX_IMAGE_BYTES=8*1024*1024;
  const MAX_PREPARED_IMAGE_CHARS=1200000;
  const MAX_PREPARED_IMAGE_EDGE=1600;
  const MAX_TEXT_ATTACHMENT_CHARS=18000;
  const SUPPORTED_IMAGE_TYPES=new Set(['image/png','image/jpeg','image/webp','image/gif']);
  const KNOWN_VISION_MODELS=new Set(['nocturne:flash']);

  const app=document.querySelector('[data-ai-app]');
  const feed=document.getElementById('feed');
  const conversation=document.getElementById('conversation');
  const form=document.getElementById('form');
  const input=document.getElementById('input');
  const send=document.getElementById('send');
  const model=document.getElementById('model');
  const providerSelect=document.getElementById('providerSelect');
  const providerState=document.getElementById('providerState');
  const modelPicker=document.getElementById('modelPicker');
  const modelTrigger=document.getElementById('modelTrigger');
  const modelSelected=document.getElementById('modelSelected');
  const modelMenu=document.getElementById('modelMenu');
  const modelOptionsHost=document.getElementById('modelOptions');
  const clear=document.getElementById('clear');
  const threadTitle=document.getElementById('threadTitle');
  const characterCount=document.getElementById('characterCount');
  const sidebar=document.getElementById('aiSidebar');
  const sidebarToggle=document.getElementById('sidebarToggle');
  const sidebarClose=document.getElementById('sidebarClose');
  const sidebarScrim=document.getElementById('sidebarScrim');
  const newChat=document.getElementById('newChat');
  const temporaryChat=document.getElementById('temporaryChat');
  const threadList=document.getElementById('threadList');
  const threadCount=document.getElementById('threadCount');
  const historyEmpty=document.getElementById('historyEmpty');
  const threadSearch=document.getElementById('threadSearch');
  const depthButtons=[...document.querySelectorAll('[data-response-depth]')];
  const sidebarModelName=document.getElementById('sidebarModelName');
  const usageWeek=document.getElementById('usageWeek');
  const usageAll=document.getElementById('usageAll');
  const usageRequests=document.getElementById('usageRequests');
  const profileButton=document.getElementById('aiProfile');
  const profileAvatar=document.getElementById('profileAvatar');
  const profileInitial=document.getElementById('profileInitial');
  const profileName=document.getElementById('profileName');
  const profileHandle=document.getElementById('profileHandle');
  const imageInput=document.getElementById('imageInput');
  const attachImage=document.getElementById('attachImage');
  const attachmentPreview=document.getElementById('attachmentPreview');
  const attachmentThumbnail=document.getElementById('attachmentThumbnail');
  const attachmentName=document.getElementById('attachmentName');
  const attachmentStatus=document.getElementById('attachmentStatus');
  const removeAttachment=document.getElementById('removeAttachment');
  const screenPreview=document.getElementById('screenPreview');
  const screenVideo=document.getElementById('screenVideo');
  const screenStatus=document.getElementById('screenStatus');
  const shareScreen=document.getElementById('shareScreen');
  const stopScreenShare=document.getElementById('stopScreenShare');
  const apiKeySettings=document.getElementById('apiKeySettings');
  const apiKeyDialog=document.getElementById('apiKeyDialog');
  const apiKeyForm=document.getElementById('apiKeyForm');
  const apiKeyProfiles=document.getElementById('apiKeyProfiles');
  const apiProfileNew=document.getElementById('apiProfileNew');
  const apiProfileLabel=document.getElementById('apiProfileLabel');
  const apiKeyInput=document.getElementById('apiKeyInput');
  const apiBaseUrl=document.getElementById('apiBaseUrl');
  const apiBaseOfox=document.getElementById('apiBaseOfox');
  const apiKeyRemember=document.getElementById('apiKeyRemember');
  const apiKeyReveal=document.getElementById('apiKeyReveal');
  const apiKeyFeedback=document.getElementById('apiKeyFeedback');
  const apiKeyRemove=document.getElementById('apiKeyRemove');
  const apiKeyCancel=document.getElementById('apiKeyCancel');
  const apiKeyClose=document.getElementById('apiKeyClose');
  const apiKeySave=document.getElementById('apiKeySave');
  if(!app||!feed||!conversation||!form||!input||!send||!model||!providerSelect||!modelPicker||!modelTrigger||!modelSelected||!modelMenu||!modelOptionsHost||!clear||!threadTitle||!sidebar||!sidebarToggle||!sidebarClose||!sidebarScrim||!newChat||!temporaryChat||!threadList||!threadCount||!historyEmpty||!threadSearch||depthButtons.length!==3||!sidebarModelName||!usageWeek||!usageAll||!usageRequests||!profileButton||!profileAvatar||!profileInitial||!profileName||!profileHandle||!imageInput||!attachImage||!attachmentPreview||!attachmentThumbnail||!attachmentName||!attachmentStatus||!removeAttachment||!screenPreview||!screenVideo||!screenStatus||!shareScreen||!stopScreenShare||!apiKeySettings||!apiKeyDialog||!apiKeyForm||!apiKeyProfiles||!apiProfileNew||!apiProfileLabel||!apiKeyInput||!apiBaseUrl||!apiBaseOfox||!apiKeyRemember||!apiKeyReveal||!apiKeyFeedback||!apiKeyRemove||!apiKeyCancel||!apiKeyClose||!apiKeySave) return;

  let activeController=null;
  let followStream=true;
  let modelCatalog=[{id:DEFAULT_MODEL,label:'GPT-5.4 Mini',company:'ChatGPT',vision:true}];
  let threads=[];
  let activeThreadId='';
  let temporaryMode=false;
  let temporaryMessages=[];
  let attachedImage=null;
  let attachedText=null;
  let screenStream=null;
  let editingProfileId='';
  let nyxAiAccountAuthPromise=null;
  let globalProviders=[];

  function personalKeyProvider(key=personalApiKey(),baseUrl=personalApiBaseUrl()){
    const value=String(key||'');
    if(/^nyx_[A-Za-z0-9_-]{16}_[A-Za-z0-9_-]{43}$/.test(value)) return 'Nyx';
    if(/^sk-navy-/i.test(value)) return 'Navy';
    const customBase=String(baseUrl||'').trim();
    if(customBase){
      try{return new URL(customBase).hostname.replace(/^api\./i,'')||'OpenAI-compatible'}catch{return 'OpenAI-compatible'}
    }
    return 'Nocturne';
  }

  function personalApiKey(){
    return String(sessionStorage.getItem(PERSONAL_KEY_SESSION)||localStorage.getItem(PERSONAL_KEY_DEVICE)||'').trim();
  }

  function personalKeyRemembered(){
    return Boolean(localStorage.getItem(PERSONAL_KEY_DEVICE));
  }

  function personalApiBaseUrl(){
    return String(sessionStorage.getItem(PERSONAL_BASE_SESSION)||localStorage.getItem(PERSONAL_BASE_DEVICE)||'').trim();
  }

  function normalizedPersonalProfile(value,remember=false){
    const id=String(value?.id||'').trim();
    const key=String(value?.key||'').trim();
    const baseUrl=String(value?.baseUrl||'').trim();
    const label=String(value?.label||'').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,50);
    return /^[a-z0-9_-]{8,80}$/i.test(id)&&key.length>=8&&key.length<=512?[{id,key,baseUrl,label,remember:Boolean(remember)}]:[];
  }

  function personalProfiles(){
    const read=(storage,name,remember)=>{
      try{
        const values=JSON.parse(storage.getItem(name)||'[]');
        return Array.isArray(values)?values.flatMap(value=>normalizedPersonalProfile(value,remember)):[];
      }catch{return[]}
    };
    const merged=new Map();
    [...read(localStorage,PERSONAL_PROFILES_DEVICE,true),...read(sessionStorage,PERSONAL_PROFILES_SESSION,false)].forEach(profile=>merged.set(profile.id,profile));
    return [...merged.values()].slice(0,8);
  }

  function writePersonalProfiles(profiles){
    const clean=profiles.slice(0,8).map(({id,key,baseUrl,label,remember})=>({id,key,baseUrl,label,remember:Boolean(remember)}));
    const device=clean.filter(profile=>profile.remember);
    const session=clean.filter(profile=>!profile.remember);
    if(device.length) localStorage.setItem(PERSONAL_PROFILES_DEVICE,JSON.stringify(device));
    else localStorage.removeItem(PERSONAL_PROFILES_DEVICE);
    if(session.length) sessionStorage.setItem(PERSONAL_PROFILES_SESSION,JSON.stringify(session));
    else sessionStorage.removeItem(PERSONAL_PROFILES_SESSION);
  }

  function personalProfileName(profile){
    if(profile?.label) return profile.label;
    return personalKeyProvider(profile?.key,profile?.baseUrl);
  }

  function ensureActivePersonalProfile(){
    const key=personalApiKey();
    if(!key) return null;
    const baseUrl=personalApiBaseUrl();
    let profiles=personalProfiles();
    let profile=profiles.find(item=>item.id===localStorage.getItem(PERSONAL_ACTIVE_PROFILE))||profiles.find(item=>item.key===key&&item.baseUrl===baseUrl);
    if(!profile){
      profile={id:`provider_${crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)}`,key,baseUrl,label:personalKeyProvider(key,baseUrl),remember:personalKeyRemembered()};
      profiles=[...profiles,profile].slice(-8);
      writePersonalProfiles(profiles);
    }
    localStorage.setItem(PERSONAL_ACTIVE_PROFILE,profile.id);
    return profile;
  }

  function fillPersonalProfileForm(profile=null){
    editingProfileId=String(profile?.id||'');
    apiProfileLabel.value=profile?.label||'';
    apiKeyInput.value=profile?.key||'';
    apiBaseUrl.value=profile?.baseUrl||'';
    apiKeyRemember.checked=Boolean(profile?.remember);
    apiKeyInput.type='password';
    apiKeyReveal.setAttribute('aria-pressed','false');
    apiKeyReveal.setAttribute('aria-label','Show API key');
  }

  function renderPersonalProfiles(){
    const activeId=String(localStorage.getItem(PERSONAL_ACTIVE_PROFILE)||'');
    const profiles=personalProfiles();
    apiKeyProfiles.innerHTML=profiles.length?profiles.map(profile=>{
      const detail=profile.baseUrl?profile.baseUrl:'Automatic provider detection';
      return `<div class="ai-key-profile${profile.id===activeId?' is-active':''}" data-key-profile="${escapeHtml(profile.id)}"><button class="ai-key-profile-select" type="button" data-key-profile-select="${escapeHtml(profile.id)}"><strong>${escapeHtml(personalProfileName(profile))}${profile.id===activeId?' · Active':''}</strong><small>${escapeHtml(detail)}</small></button><button class="ai-key-profile-remove" type="button" data-key-profile-remove="${escapeHtml(profile.id)}" aria-label="Remove ${escapeHtml(personalProfileName(profile))}">×</button></div>`;
    }).join(''):'<p class="ai-key-profile-empty">No personal providers saved yet.</p>';
  }

  async function nyxAiParentToken(){
    if(parent===window) return '';
    const requestId=`ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise(resolve=>{
      let settled=false;
      const finish=value=>{if(settled)return;settled=true;clearTimeout(timeout);removeEventListener('message',receive);resolve(String(value||''));};
      const receive=event=>{if(event.source===parent&&event.origin===location.origin&&event.data?.type==='nyx:account-token-response'&&event.data.requestId===requestId)finish(event.data.token);};
      const timeout=setTimeout(()=>finish(''),2500);
      addEventListener('message',receive);
      parent.postMessage({type:'nyx:account-token-request',requestId},location.origin);
    });
  }

  async function nyxAiAccountToken(){
    const parentToken=await nyxAiParentToken();
    if(parentToken) return parentToken;
    if(!nyxAiAccountAuthPromise){
      nyxAiAccountAuthPromise=(async()=>{
        try{
          const configResponse=await fetch('/api/founder-profile/auth-config',{cache:'no-store'});
          const config=await configResponse.json();
          if(!config?.enabled||!config?.apiKey||!config?.projectId)return null;
          const [{initializeApp,getApps},{getAuth,setPersistence,browserLocalPersistence}]=await Promise.all([
            import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js')
          ]);
          const firebaseApp=getApps().find(item=>item.name==='nyx-founder-owner')||initializeApp({apiKey:config.apiKey,authDomain:`${config.projectId}.firebaseapp.com`,projectId:config.projectId},'nyx-founder-owner');
          const auth=getAuth(firebaseApp);
          try{await setPersistence(auth,browserLocalPersistence)}catch{}
          if(typeof auth.authStateReady==='function')await auth.authStateReady();
          return auth;
        }catch{return null}
      })();
    }
    const auth=await nyxAiAccountAuthPromise;
    try{return auth?.currentUser?await auth.currentUser.getIdToken():''}catch{return ''}
  }

  async function aiHeaders(headers={}){
    const key=personalApiKey();
    const token=await nyxAiAccountToken();
    const provider=String(providerSelect.value||'shared');
    const baseUrl=personalApiBaseUrl();
    return {...headers,...(key?{'x-nyx-ai-api-key':key,...(baseUrl?{'x-nyx-ai-base-url':baseUrl}:{})}:{'x-nyx-ai-provider':provider}),...(token?{Authorization:`Bearer ${token}`}:{})};
  }

  function selectedProvider(){
    const saved=String(localStorage.getItem(PROVIDER_KEY)||'shared');
    return globalProviders.some(provider=>provider.id===saved)?saved:(globalProviders[0]?.id||'shared');
  }

  function syncProviderControl(){
    const personal=Boolean(personalApiKey());
    providerSelect.disabled=personal||globalProviders.length<2;
    providerSelect.title=personal?'Your personal key chooses the provider. Remove it to switch shared providers.':globalProviders.length<2?'Only one shared provider is configured.':'Shared AI provider';
    if(providerState){
      providerState.hidden=!personal;
      providerState.textContent=personal?`Personal ${personalKeyProvider()} key active`:'';
    }
  }

  function renderProviders(){
    const selected=selectedProvider();
    providerSelect.innerHTML=globalProviders.map(provider=>`<option value="${escapeHtml(provider.id)}">${escapeHtml(provider.label)}</option>`).join('')||'<option value="shared">Nyx Shared</option>';
    providerSelect.value=selected;
    syncProviderControl();
  }

  async function loadProviders(){
    try{
      const response=await fetch('/api/nyx-ai/providers',{headers:await aiHeaders({accept:'application/json'})});
      const data=await response.json();
      if(!response.ok) throw new Error(data?.error||'Shared providers are unavailable.');
      globalProviders=Array.isArray(data?.providers)?data.providers.flatMap(item=>{
        const id=String(item?.id||'').trim();
        const label=String(item?.label||id).trim();
        return /^[a-z][a-z0-9-]{0,30}$/i.test(id)&&label?[{id,label}]:[];
      }):[];
    }catch{globalProviders=[]}
    renderProviders();
  }

  function updateApiKeyControl(message='',state=''){
    const active=Boolean(personalApiKey());
    const provider=personalKeyProvider();
    apiKeySettings.classList.toggle('has-personal-key',active);
    apiKeySettings.setAttribute('aria-label',active?`Change your personal ${provider} AI API key`:'Set a personal Nyx or Nocturne AI API key');
    apiKeySettings.title=active?`Using your personal ${provider} AI key`:'Using Nyx AI key';
    apiKeyRemove.disabled=!active;
    apiKeyFeedback.className=`ai-key-feedback${state?` is-${state}`:''}`;
    apiKeyFeedback.textContent=message||(active?`Your personal ${provider} key is active.`:'Nyx will use its shared AI key until you add your own.');
    syncProviderControl();
  }

  function openApiKeyDialog(){
    const profile=ensureActivePersonalProfile();
    fillPersonalProfileForm(profile);
    renderPersonalProfiles();
    updateApiKeyControl();
    apiKeyDialog.showModal();
    requestAnimationFrame(()=>apiKeyInput.focus());
  }

  function closeApiKeyDialog(){
    if(apiKeyDialog.open) apiKeyDialog.close();
    apiKeySettings.focus();
  }

  function storePersonalApiKey(key,baseUrl,remember){
    sessionStorage.removeItem(PERSONAL_KEY_SESSION);
    localStorage.removeItem(PERSONAL_KEY_DEVICE);
    sessionStorage.removeItem(PERSONAL_BASE_SESSION);
    localStorage.removeItem(PERSONAL_BASE_DEVICE);
    const storage=remember?localStorage:sessionStorage;
    storage.setItem(remember?PERSONAL_KEY_DEVICE:PERSONAL_KEY_SESSION,key);
    if(baseUrl) storage.setItem(remember?PERSONAL_BASE_DEVICE:PERSONAL_BASE_SESSION,baseUrl);
  }

  function removePersonalApiKey(){
    sessionStorage.removeItem(PERSONAL_KEY_SESSION);
    localStorage.removeItem(PERSONAL_KEY_DEVICE);
    sessionStorage.removeItem(PERSONAL_BASE_SESSION);
    localStorage.removeItem(PERSONAL_BASE_DEVICE);
  }

  async function activatePersonalProfile(profile){
    if(!profile) return;
    storePersonalApiKey(profile.key,profile.baseUrl,profile.remember);
    localStorage.setItem(PERSONAL_ACTIVE_PROFILE,profile.id);
    fillPersonalProfileForm(profile);
    renderPersonalProfiles();
    updateApiKeyControl(`Checking ${personalProfileName(profile)}…`);
    await loadModels();
  }

  async function deletePersonalProfile(id){
    const profiles=personalProfiles();
    const activeId=String(localStorage.getItem(PERSONAL_ACTIVE_PROFILE)||'');
    const remaining=profiles.filter(profile=>profile.id!==id);
    writePersonalProfiles(remaining);
    if(id===activeId){
      localStorage.removeItem(PERSONAL_ACTIVE_PROFILE);
      removePersonalApiKey();
      if(remaining.length) await activatePersonalProfile(remaining[0]);
      else{
        fillPersonalProfileForm();
        updateApiKeyControl('Personal provider removed. Nyx is using its shared AI provider.','success');
        await loadModels();
      }
    }
    renderPersonalProfiles();
  }

  function responseDepth(){
    const value=localStorage.getItem(RESPONSE_DEPTH_KEY)||'normal';
    return ['off','normal','extended'].includes(value)?value:'normal';
  }

  function syncResponseDepth(){
    const current=responseDepth();
    depthButtons.forEach(button=>{
      const selected=button.dataset.responseDepth===current;
      button.classList.toggle('is-active',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
  }

  function storedUsage(){
    try{
      const items=JSON.parse(localStorage.getItem(USAGE_KEY)||'[]');
      return Array.isArray(items)?items.filter(item=>Number.isFinite(item?.at)&&Number.isFinite(item?.tokens)&&item.tokens>0).slice(-1000):[];
    }catch{return[]}
  }

  function renderUsage(){
    const items=storedUsage();
    const cutoff=Date.now()-7*86_400_000;
    const format=value=>new Intl.NumberFormat(undefined,{notation:value>=10_000?'compact':'standard',maximumFractionDigits:1}).format(value);
    usageWeek.textContent=format(items.filter(item=>item.at>=cutoff).reduce((sum,item)=>sum+item.tokens,0));
    usageAll.textContent=format(items.reduce((sum,item)=>sum+item.tokens,0));
    usageRequests.textContent=format(items.length);
  }

  function recordUsage(prompt,answer){
    const items=storedUsage();
    items.push({at:Date.now(),tokens:Math.max(1,Math.ceil((String(prompt||'').length+String(answer||'').length)/4))});
    try{localStorage.setItem(USAGE_KEY,JSON.stringify(items.slice(-1000)))}catch{}
    renderUsage();
  }

  function themeHex(value,fallback='#6687b2'){
    const raw=String(value||'').trim();
    return /^#[0-9a-f]{6}$/i.test(raw)?raw.toLowerCase():fallback;
  }

  function shadeThemeHex(value,percent=0){
    const color=themeHex(value);
    const amount=Math.max(-100,Math.min(100,Number(percent)||0))/100;
    const channel=index=>{
      const current=parseInt(color.slice(index,index+2),16);
      return Math.round(amount>=0?current+(255-current)*amount:current*(1+amount));
    };
    return '#'+[1,3,5].map(index=>channel(index).toString(16).padStart(2,'0')).join('');
  }

  function parentThemePalette(){
    try{
      if(parent===window||parent.location.origin!==location.origin) return null;
      const parentDocument=parent.document;
      const bodyStyle=parent.getComputedStyle(parentDocument.body);
      const rootStyle=parent.getComputedStyle(parentDocument.documentElement);
      const read=(name,fallback='')=>bodyStyle.getPropertyValue(name).trim()||rootStyle.getPropertyValue(name).trim()||fallback;
      const accent=read('--nyx-chrome-accent',read('--theme-a','#6687b2'));
      const bright=read('--nyx-final-shortcut-icon',read('--nyx-chrome-bright',accent));
      return {
        canvas:read('--nyx-unified-canvas',read('--nyx-chrome-deep','#080e18')),
        deep:read('--nyx-unified-top',read('--nyx-chrome-deep','#050912')),
        surface:read('--nyx-home-panel',read('--nyx-chrome-base','#101827')),
        raised:read('--nyx-home-panel-soft',read('--nyx-chrome-active','#141f31')),
        hover:read('--nyx-chrome-hover',read('--nyx-home-panel-soft','#1a293e')),
        line:read('--nyx-home-line','#2a3b54'),
        text:read('--nyx-home-text',read('--theme-strong','#d4deec')),
        muted:read('--nyx-home-muted','#899bb5'),
        accent,
        bright
      };
    }catch{return null}
  }

  function fallbackThemePalette(theme){
    const stored=theme==='custom'?localStorage.getItem('nyx.customThemeColor'):'';
    const accent=themeHex(stored||window.NyxLogo?.colors?.[theme]||window.NyxLogo?.colors?.default||'#6687b2');
    return {
      canvas:shadeThemeHex(accent,-84),
      deep:shadeThemeHex(accent,-91),
      surface:shadeThemeHex(accent,-74),
      raised:shadeThemeHex(accent,-68),
      hover:shadeThemeHex(accent,-58),
      line:shadeThemeHex(accent,-30),
      text:'#f4f7ff',
      muted:shadeThemeHex(accent,48),
      accent:shadeThemeHex(accent,8),
      bright:shadeThemeHex(accent,38)
    };
  }

  function applyWorkspaceTheme(theme=localStorage.getItem('nyx.theme')||'default'){
    const clean=String(theme||'default').trim().toLowerCase()||'default';
    const palette=parentThemePalette()||fallbackThemePalette(clean);
    const root=document.documentElement;
    const values={
      '--ai-bg':'#000000',
      '--ai-bg-deep':'#000000',
      '--ai-surface':'#080808',
      '--ai-surface-raised':'#0e0e0e',
      '--ai-surface-hover':'#141414',
      '--ai-border':'rgba(255,255,255,.10)',
      '--ai-border-strong':'rgba(255,255,255,.18)',
      '--ai-text':'#f7f7f8',
      '--ai-text-soft':'#d7d7db',
      '--ai-muted':'#929299',
      '--ai-muted-dark':'#68686f',
      '--ai-accent':'#d7d7dc',
      '--ai-accent-bright':'#f7f7f8',
      '--ai-accent-soft':'rgba(255,255,255,.07)',
      '--ai-accent-border':'rgba(255,255,255,.18)',
      '--ai-accent-foreground':'#050505',
      '--ai-accent-glow':'rgba(255,255,255,.08)',
      '--ai-theme-hover-border':`color-mix(in srgb,${palette.bright} 82%,#ffffff 8%)`
    };
    Object.entries(values).forEach(([name,value])=>root.style.setProperty(name,value));
    root.dataset.nyxTheme=clean;
    document.body.dataset.nyxTheme=clean;
    document.body.className=document.body.className.replace(/\btheme-[\w-]+\b/g,'').trim();
    document.body.classList.add(`theme-${clean}`);
    applyLogoTheme(clean);
  }

  function escapeHtml(value){
    return String(value??'').replace(/[&<>"']/g,character=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[character]);
  }

  function normalizedTextAttachment(value){
    const content=String(value?.content||'');
    if(!content||content.length>MAX_TEXT_ATTACHMENT_CHARS) return null;
    const name=String(value?.name||'pasted-text.txt').replace(/[\\/:*?"<>|\x00-\x1f]/g,'-').slice(0,100)||'pasted-text.txt';
    return {name:name.toLowerCase().endsWith('.txt')?name:`${name}.txt`,content,size:Number(value?.size)||new Blob([content],{type:'text/plain'}).size};
  }

  function normalizedMessages(value){
    return Array.isArray(value)
      ? value.map(item=>{
          if(!item||!['user','assistant'].includes(item.role)) return null;
          const content=item.role==='assistant'?responseParts(item.content).answer.trim():String(item.content||'').trim();
          if(!content) return null;
          const message={role:item.role,content};
          const textAttachment=item.role==='user'?normalizedTextAttachment(item.textAttachment):null;
          if(textAttachment) message.textAttachment=textAttachment;
          return message;
        }).filter(Boolean).slice(-MAX_MESSAGES)
      : [];
  }

  function chatTitle(messages){
    const first=normalizedMessages(messages).find(item=>item.role==='user')?.content.trim()||'New conversation';
    return first.length>46?`${first.slice(0,46)}…`:first;
  }

  function normalizedThread(value){
    const messages=normalizedMessages(value?.messages);
    const createdAt=Number(value?.createdAt)||Date.now();
    return {
      id:String(value?.id||''),
      title:String(value?.title||chatTitle(messages)).trim().slice(0,64)||'New conversation',
      messages,
      model:String(value?.model||DEFAULT_MODEL),
      createdAt,
      updatedAt:Number(value?.updatedAt)||createdAt
    };
  }

  function storedThreads(){
    try{
      const value=JSON.parse(localStorage.getItem(THREADS_KEY)||'[]');
      return Array.isArray(value)
        ? value.map(normalizedThread).filter(thread=>thread.id&&thread.messages.length).sort((left,right)=>right.updatedAt-left.updatedAt).slice(0,MAX_THREADS)
        : [];
    }catch{return[]}
  }

  function legacyMessages(){
    try{return normalizedMessages(JSON.parse(localStorage.getItem(MESSAGE_KEY)||'[]'))}catch{return[]}
  }

  function persistThreads(){
    threads=threads.filter(thread=>thread.id&&thread.messages.length).sort((left,right)=>right.updatedAt-left.updatedAt).slice(0,MAX_THREADS);
    try{localStorage.setItem(THREADS_KEY,JSON.stringify(threads))}catch{}
  }

  function syncLegacyMessages(messages){
    try{
      if(messages.length) localStorage.setItem(MESSAGE_KEY,JSON.stringify(messages));
      else localStorage.removeItem(MESSAGE_KEY);
    }catch{}
  }

  function activeThread(){return threads.find(thread=>thread.id===activeThreadId)||null}

  function initializeThreads(){
    threads=storedThreads();
    if(!threads.length){
      const legacy=legacyMessages();
      if(legacy.length){
        const now=Date.now();
        const thread=normalizedThread({id:`chat-${now.toString(36)}`,messages:legacy,model:localStorage.getItem(MODEL_KEY)||DEFAULT_MODEL,createdAt:now,updatedAt:now});
        threads=[thread];
        activeThreadId=thread.id;
        persistThreads();
      }
    }
    if(!activeThreadId){
      const stored=localStorage.getItem(ACTIVE_THREAD_KEY)||'';
      activeThreadId=threads.some(thread=>thread.id===stored)?stored:(threads[0]?.id||'');
    }
    if(activeThreadId){
      localStorage.setItem(ACTIVE_THREAD_KEY,activeThreadId);
      syncLegacyMessages(activeThread()?.messages||[]);
    }
  }

  function savedMessages(){
    return temporaryMode?normalizedMessages(temporaryMessages):normalizedMessages(activeThread()?.messages||[]);
  }

  function saveMessages(value){
    const messages=normalizedMessages(value);
    if(temporaryMode){
      temporaryMessages=messages;
      return;
    }
    const now=Date.now();
    let thread=activeThread();
    if(!thread&&messages.length){
      thread=normalizedThread({id:`chat-${now.toString(36)}-${Math.random().toString(36).slice(2,7)}`,messages,model:model.value||DEFAULT_MODEL,createdAt:now,updatedAt:now});
      threads.unshift(thread);
      activeThreadId=thread.id;
      localStorage.setItem(ACTIVE_THREAD_KEY,activeThreadId);
    }else if(thread){
      thread.messages=messages;
      thread.title=chatTitle(messages);
      thread.model=model.value||thread.model||DEFAULT_MODEL;
      thread.updatedAt=now;
    }
    syncLegacyMessages(messages);
    persistThreads();
    renderThreadList();
  }

  function applyLogoTheme(theme){
    return window.NyxLogo?.apply(theme||localStorage.getItem('nyx.theme')||'default',document).catch?.(()=>{});
  }

  function mathMarkup(value,displayMode=false){
    const source=String(value??'').trim();
    if(!source) return '';
    try{
      if(window.katex?.renderToString){
        return window.katex.renderToString(source,{
          displayMode:Boolean(displayMode),
          throwOnError:false,
          strict:'ignore',
          trust:false,
          output:'htmlAndMathml'
        });
      }
    }catch(error){
      console.warn('Nyx AI could not render math:',error);
    }
    const readable=source
      .replace(/\\text\{([^{}]*)\}/g,'$1')
      .replace(/\\[,;:!]/g,' ')
      .replace(/\\(?:quad|qquad)\b/g,' ')
      .replace(/\\(?:times|cdot)/g,' × ')
      .replace(/\\leq?/g,'≤')
      .replace(/\\geq?/g,'≥')
      .replace(/\\neq/g,'≠')
      .replace(/\\pm/g,'±')
      .replace(/[{}]/g,'');
    return `<span class="ai-math-fallback">${escapeHtml(readable)}</span>`;
  }

  function inlineMarkdown(value){
    const code=[];
    let source=String(value??'').replace(/`([^`\n]+)`/g,(_match,text)=>{
      const token=`@@NYX_INLINE_${code.length}@@`;
      code.push(`<code>${escapeHtml(text)}</code>`);
      return token;
    });
    const math=[];
    source=source.replace(/\\+\[([^\n]*?)\\+\]|\\+\(([^\n]*?)\\+\)/g,(_match,display,inline)=>{
      const token=`@@NYX_MATH_${math.length}@@`;
      math.push(mathMarkup(display??inline,display!==undefined));
      return token;
    });
    let html=escapeHtml(source);
    html=html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    html=html.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>');
    html=html.replace(/__([^_\n]+)__/g,'<strong>$1</strong>');
    html=html.replace(/~~([^~\n]+)~~/g,'<s>$1</s>');
    html=html.replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<em>$2</em>');
    math.forEach((token,index)=>{html=html.replace(`@@NYX_MATH_${index}@@`,token)});
    code.forEach((token,index)=>{html=html.replace(`@@NYX_INLINE_${index}@@`,token)});
    return html;
  }

  function tableCells(line){
    return String(line).trim().replace(/^\||\|$/g,'').split('|').map(cell=>cell.trim());
  }

  function isTableDivider(line){
    const cells=tableCells(line);
    return cells.length>1&&cells.every(cell=>/^:?-{3,}:?$/.test(cell));
  }

  function displayMathFence(line){
    const trimmed=String(line??'').trim();
    if(/^\\+\[$/.test(trimmed)) return 'bracket';
    if(trimmed==='$$') return 'dollar';
    return '';
  }

  function isDisplayMathClose(line,type){
    const trimmed=String(line??'').trim();
    return type==='bracket'?/^\\+\]$/.test(trimmed):trimmed==='$$';
  }

  function displayMathLine(line){
    const trimmed=String(line??'').trim();
    const bracket=trimmed.match(/^\\+\[([\s\S]*?)\\+\]$/);
    if(bracket) return bracket[1];
    const dollar=trimmed.match(/^\$\$([\s\S]*?)\$\$$/);
    return dollar?dollar[1]:null;
  }

  function isBlockStart(lines,index){
    const line=lines[index]||'';
    return Boolean(displayMathFence(line))||displayMathLine(line)!==null||isDisplayMathClose(line,'bracket')||/^```/.test(line)||/^#{1,3}\s+/.test(line)||/^>\s?/.test(line)||/^\s*[-*+]\s+/.test(line)||/^\s*\d+[.)]\s+/.test(line)||/^\s*(?:---+|___+)\s*$/.test(line)||line.includes('\t')||(line.includes('|')&&isTableDivider(lines[index+1]||''));
  }

  function markdown(value){
    const lines=String(value??'').replace(/\r\n?/g,'\n').split('\n');
    const blocks=[];
    for(let index=0;index<lines.length;){
      const line=lines[index];
      if(!line.trim()){index+=1;continue}

      const fence=line.match(/^```([^\s`]*)\s*$/);
      if(fence){
        const language=(fence[1]||'code').slice(0,24);
        const code=[];
        index+=1;
        while(index<lines.length&&!/^```\s*$/.test(lines[index])){code.push(lines[index]);index+=1}
        if(index<lines.length) index+=1;
        blocks.push(`<div class="ai-code-block"><div class="ai-code-head"><span>${escapeHtml(language)}</span><button class="ai-code-copy" type="button" data-copy-code aria-label="Copy code"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/></svg><span>Copy</span></button></div><pre><code>${escapeHtml(code.join('\n'))}</code></pre></div>`);
        continue;
      }

      const displayFence=displayMathFence(line);
      if(displayFence){
        let closeIndex=index+1;
        while(closeIndex<lines.length&&!isDisplayMathClose(lines[closeIndex],displayFence)) closeIndex+=1;
        if(closeIndex<lines.length){
          blocks.push(`<div class="ai-math-block">${mathMarkup(lines.slice(index+1,closeIndex).join('\n'),true)}</div>`);
          index=closeIndex+1;
          continue;
        }
        let endIndex=index+1;
        while(endIndex<lines.length&&lines[endIndex].trim()) endIndex+=1;
        const unfinishedMath=lines.slice(index+1,endIndex).join('\n');
        if(unfinishedMath.trim()) blocks.push(`<div class="ai-math-block">${mathMarkup(unfinishedMath,true)}</div>`);
        index=endIndex;
        continue;
      }

      const displayMath=displayMathLine(line);
      if(displayMath!==null){
        blocks.push(`<div class="ai-math-block">${mathMarkup(displayMath,true)}</div>`);
        index+=1;
        continue;
      }

      if(isDisplayMathClose(line,'bracket')){
        index+=1;
        continue;
      }

      if(line.includes('\t')){
        const rows=[];
        while(index<lines.length&&lines[index].includes('\t')&&lines[index].trim()){
          rows.push(lines[index].split(/\t+/).map(cell=>cell.trim()));
          index+=1;
        }
        const width=Math.max(0,...rows.map(row=>row.length));
        if(rows.length>1&&width>1){
          const headers=rows.shift();
          blocks.push(`<div class="ai-table-wrap"><table><thead><tr>${Array.from({length:width},(_item,cellIndex)=>`<th>${inlineMarkdown(headers[cellIndex]||'')}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${Array.from({length:width},(_item,cellIndex)=>`<td>${inlineMarkdown(row[cellIndex]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
          continue;
        }
        blocks.push(`<p>${rows.flat().map(inlineMarkdown).join('<br>')}</p>`);
        continue;
      }

      if(line.includes('|')&&isTableDivider(lines[index+1]||'')){
        const headers=tableCells(line);
        index+=2;
        const rows=[];
        while(index<lines.length&&lines[index].includes('|')&&lines[index].trim()){
          rows.push(tableCells(lines[index]));
          index+=1;
        }
        blocks.push(`<div class="ai-table-wrap"><table><thead><tr>${headers.map(cell=>`<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${headers.map((_header,cellIndex)=>`<td>${inlineMarkdown(row[cellIndex]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
        continue;
      }

      const heading=line.match(/^(#{1,3})\s+(.+)$/);
      if(heading){
        const level=heading[1].length;
        blocks.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
        index+=1;
        continue;
      }

      if(/^>\s?/.test(line)){
        const quote=[];
        while(index<lines.length&&/^>\s?/.test(lines[index])){quote.push(lines[index].replace(/^>\s?/,''));index+=1}
        blocks.push(`<blockquote>${quote.map(inlineMarkdown).join('<br>')}</blockquote>`);
        continue;
      }

      const unordered=/^\s*[-*+]\s+/.test(line);
      const ordered=/^\s*\d+[.)]\s+/.test(line);
      if(unordered||ordered){
        const items=[];
        const pattern=ordered?/^\s*\d+[.)]\s+/:/^\s*[-*+]\s+/;
        while(index<lines.length&&pattern.test(lines[index])){items.push(lines[index].replace(pattern,''));index+=1}
        const tag=ordered?'ol':'ul';
        blocks.push(`<${tag}>${items.map(item=>`<li>${inlineMarkdown(item)}</li>`).join('')}</${tag}>`);
        continue;
      }

      if(/^\s*(?:---+|___+)\s*$/.test(line)){
        blocks.push('<hr>');
        index+=1;
        continue;
      }

      const paragraph=[line];
      index+=1;
      while(index<lines.length&&lines[index].trim()&&!isBlockStart(lines,index)){
        paragraph.push(lines[index]);
        index+=1;
      }
      blocks.push(`<p>${paragraph.map(inlineMarkdown).join('<br>')}</p>`);
    }
    return blocks.join('');
  }

  function messageCopyButton(){
    return `<button class="ai-message-copy" type="button" data-copy-message title="Copy message" aria-label="Copy message"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/></svg></button>`;
  }

  function setAttachmentStatus(text){
    attachmentStatus.textContent=String(text||'');
  }

  function formatAttachmentSize(size){
    const bytes=Math.max(0,Number(size)||0);
    if(bytes<1024) return `${bytes} B`;
    return `${(bytes/1024).toFixed(bytes<10240?1:0)} KB`;
  }

  function pastedTextFileName(){
    const now=new Date();
    const pad=value=>String(value).padStart(2,'0');
    return `pasted-text-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.txt`;
  }

  function clearAttachment(){
    attachedImage=null;
    attachedText=null;
    imageInput.value='';
    attachmentPreview.hidden=true;
    attachmentPreview.classList.remove('is-error','is-file-error','is-text-file');
    attachmentThumbnail.hidden=false;
    attachmentThumbnail.removeAttribute('src');
    attachmentName.textContent='';
    setAttachmentStatus('Ready to send');
    attachImage.classList.remove('has-attachment');
    attachImage.setAttribute('aria-label','Attach an image');
    removeAttachment.title='Remove attachment';
    removeAttachment.setAttribute('aria-label','Remove attachment');
  }

  function showAttachmentError(message,label='Image not attached'){
    clearAttachment();
    attachmentPreview.hidden=false;
    attachmentPreview.classList.add('is-error','is-file-error');
    attachmentThumbnail.hidden=true;
    attachmentName.textContent=label;
    setAttachmentStatus(message);
  }

  function setAttachment(image){
    stopScreenSharing();
    attachedText=null;
    attachedImage=image;
    attachmentPreview.hidden=false;
    attachmentPreview.classList.remove('is-error','is-file-error','is-text-file');
    attachmentThumbnail.hidden=false;
    attachmentThumbnail.src=image.dataUrl;
    attachmentName.textContent=image.name;
    setAttachmentStatus('Ready to send');
    attachImage.classList.add('has-attachment');
    attachImage.setAttribute('aria-label',`Replace attached image: ${image.name}`);
    removeAttachment.title='Remove image';
    removeAttachment.setAttribute('aria-label','Remove attached image');
  }

  function setTextAttachment(content){
    const text=String(content||'');
    if(!text) return null;
    stopScreenSharing();
    if(text.length>MAX_TEXT_ATTACHMENT_CHARS){
      showAttachmentError(`Pasted text is limited to ${MAX_TEXT_ATTACHMENT_CHARS.toLocaleString()} characters.`,`Text file not attached`);
      return null;
    }
    const attachment=normalizedTextAttachment({name:pastedTextFileName(),content:text});
    if(!attachment) return null;
    attachedImage=null;
    attachedText=attachment;
    imageInput.value='';
    attachmentPreview.hidden=false;
    attachmentPreview.classList.remove('is-error','is-file-error');
    attachmentPreview.classList.add('is-text-file');
    attachmentThumbnail.hidden=true;
    attachmentThumbnail.removeAttribute('src');
    attachmentName.textContent=attachment.name;
    setAttachmentStatus(`${formatAttachmentSize(attachment.size)} · Ready to send`);
    attachImage.classList.remove('has-attachment');
    attachImage.setAttribute('aria-label','Attach an image (replaces the text file)');
    removeAttachment.title='Remove text file';
    removeAttachment.setAttribute('aria-label','Remove attached text file');
    return attachment;
  }

  function readImageFile(file){
    if(!file||!SUPPORTED_IMAGE_TYPES.has(String(file.type||'').toLowerCase())){
      showAttachmentError('Choose a PNG, JPG, WebP, or GIF image.');
      return Promise.resolve(null);
    }
    if(file.size>MAX_IMAGE_BYTES){
      showAttachmentError('Choose an image smaller than 8 MB.');
      return Promise.resolve(null);
    }
    return new Promise(resolve=>{
      const reader=new FileReader();
      reader.onload=()=>{
        const image={name:file.name||'Attached image',size:file.size,type:file.type,dataUrl:String(reader.result||'')};
        setAttachment(image);
        resolve(image);
      };
      reader.onerror=()=>{
        showAttachmentError('Nyx could not read that image.');
        resolve(null);
      };
      reader.readAsDataURL(file);
    });
  }

  function prepareImageForModel(source){
    if(!source?.dataUrl) return Promise.reject(new Error('The attached image is unavailable.'));
    return new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>{
        try{
          const originalWidth=Math.max(1,image.naturalWidth||1);
          const originalHeight=Math.max(1,image.naturalHeight||1);
          if(source.dataUrl.length<=MAX_PREPARED_IMAGE_CHARS){
            resolve({dataUrl:source.dataUrl,mime:source.type,width:originalWidth,height:originalHeight,screenCapture:source.screenCapture===true});
            return;
          }
          const canvas=document.createElement('canvas');
          const context=canvas.getContext('2d');
          if(!context) throw new Error('Image preparation is unavailable.');
          let scale=Math.min(1,MAX_PREPARED_IMAGE_EDGE/Math.max(originalWidth,originalHeight));
          let prepared='';
          for(let attempt=0;attempt<7;attempt+=1){
            canvas.width=Math.max(1,Math.round(originalWidth*scale));
            canvas.height=Math.max(1,Math.round(originalHeight*scale));
            context.fillStyle='#ffffff';
            context.fillRect(0,0,canvas.width,canvas.height);
            context.drawImage(image,0,0,canvas.width,canvas.height);
            prepared=canvas.toDataURL('image/jpeg',Math.max(.52,.9-attempt*.07));
            if(prepared.length<=MAX_PREPARED_IMAGE_CHARS) break;
            scale*=.82;
          }
          if(!prepared||prepared.length>MAX_PREPARED_IMAGE_CHARS) throw new Error('Nyx could not prepare that image within the upload limit.');
          resolve({dataUrl:prepared,mime:'image/jpeg',width:originalWidth,height:originalHeight,screenCapture:source.screenCapture===true});
        }catch(error){reject(error)}
      };
      image.onerror=()=>reject(new Error('Nyx could not decode that image.'));
      image.src=source.dataUrl;
    });
  }

  function stopScreenSharing(){
    const active=screenStream;
    screenStream=null;
    if(active) active.getTracks().forEach(track=>track.stop());
    screenVideo.srcObject=null;
    screenPreview.hidden=true;
    shareScreen.classList.remove('has-attachment');
    shareScreen.setAttribute('aria-pressed','false');
    screenStatus.textContent='A fresh frame is attached only when you send.';
  }

  async function startScreenSharing(){
    if(!navigator.mediaDevices?.getDisplayMedia){
      showAttachmentError('Screen sharing is not supported by this browser.','Screen sharing unavailable');
      return;
    }
    stopScreenSharing();
    clearAttachment();
    try{
      const stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:5,max:10}},audio:false});
      const track=stream.getVideoTracks()[0];
      if(!track) throw new Error('No screen was selected.');
      screenStream=stream;
      track.addEventListener('ended',stopScreenSharing,{once:true});
      screenVideo.srcObject=stream;
      screenPreview.hidden=false;
      shareScreen.classList.add('has-attachment');
      shareScreen.setAttribute('aria-pressed','true');
      screenStatus.textContent='A fresh frame is attached only when you send.';
      await screenVideo.play().catch(()=>{});
    }catch(error){
      stopScreenSharing();
      if(error?.name!=='NotAllowedError') showAttachmentError(error?.message||'Nyx could not start screen sharing.','Screen sharing unavailable');
    }
  }

  function captureSharedScreen(){
    if(!screenStream||screenStream.getVideoTracks()[0]?.readyState==='ended') return Promise.reject(new Error('Screen sharing has ended. Start it again to attach your screen.'));
    const width=Math.max(1,screenVideo.videoWidth||Number(screenStream.getVideoTracks()[0]?.getSettings?.().width)||0);
    const height=Math.max(1,screenVideo.videoHeight||Number(screenStream.getVideoTracks()[0]?.getSettings?.().height)||0);
    if(width<=1||height<=1) return Promise.reject(new Error('The shared screen is not ready yet. Wait a moment and try again.'));
    const scale=Math.min(1,MAX_PREPARED_IMAGE_EDGE/Math.max(width,height));
    const canvas=document.createElement('canvas');
    const context=canvas.getContext('2d');
    if(!context) return Promise.reject(new Error('Screen capture is unavailable in this browser.'));
    canvas.width=Math.max(1,Math.round(width*scale));
    canvas.height=Math.max(1,Math.round(height*scale));
    context.drawImage(screenVideo,0,0,canvas.width,canvas.height);
    let quality=.88;
    let dataUrl=canvas.toDataURL('image/jpeg',quality);
    while(dataUrl.length>MAX_PREPARED_IMAGE_CHARS&&quality>.5){
      quality-=.08;
      dataUrl=canvas.toDataURL('image/jpeg',quality);
    }
    if(dataUrl.length>MAX_PREPARED_IMAGE_CHARS) return Promise.reject(new Error('Nyx could not prepare that screen frame within the upload limit.'));
    return Promise.resolve({name:'Shared screen',size:Math.ceil(dataUrl.length*.75),type:'image/jpeg',dataUrl,screenCapture:true});
  }

  function responseParts(value){
    const source=String(value||'');
    const tag=/<\/?think\b[^>]*>/gi;
    let answer='';
    let reasoning='';
    let cursor=0;
    let inThinking=false;
    let match;
    while((match=tag.exec(source))){
      const chunk=source.slice(cursor,match.index);
      if(inThinking) reasoning+=chunk;
      else answer+=chunk;
      if(/^<\//.test(match[0])) inThinking=false;
      else inThinking=true;
      cursor=match.index+match[0].length;
    }
    const tail=source.slice(cursor);
    if(inThinking) reasoning+=tail;
    else answer+=tail;
    if(!inThinking){
      const unfinished=answer.match(/<\/?t(?:h(?:i(?:n(?:k)?)?)?)?$/i);
      if(unfinished) answer=answer.slice(0,-unfinished[0].length);
    }
    return {answer,reasoning};
  }

  function appendReasoning(content,text){
    const details=document.createElement('details');
    details.className='ai-reasoning';
    const summary=document.createElement('summary');
    summary.textContent='Thinking';
    const body=document.createElement('div');
    body.className='ai-reasoning-body';
    body.innerHTML=markdown(text);
    details.append(summary,body);
    content.appendChild(details);
  }

  function setMessageContent(message,text,{error=false,thinking=false}={}){
    const content=message.querySelector('.ai-message-content');
    if(!content) return;
    message.classList.toggle('ai-message-error',error);
    message.classList.toggle('is-thinking',thinking);
    if(thinking){
      message._nyxMessageText='';
      content.innerHTML='<span class="ai-thinking" aria-label="Nyx AI is thinking"><i></i><i></i><i></i></span>';
      return;
    }
    if(message.classList.contains('ai-message-user')||error){
      message._nyxMessageText=String(text||'');
      content.textContent=String(text||'');
      return;
    }
    const parts=responseParts(text);
    message._nyxMessageText=parts.answer.trim();
    content.replaceChildren();
    if(parts.reasoning.trim()) appendReasoning(content,parts.reasoning.trim());
    if(parts.answer.trim()){
      const answer=document.createElement('div');
      answer.className='ai-answer';
      answer.innerHTML=markdown(parts.answer.trim());
      content.appendChild(answer);
    }
  }

  function downloadTextAttachment(attachment){
    const normalized=normalizedTextAttachment(attachment);
    if(!normalized) return;
    const url=URL.createObjectURL(new Blob([normalized.content],{type:'text/plain;charset=utf-8'}));
    const link=document.createElement('a');
    link.href=url;
    link.download=normalized.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function addMessage(role,text,{error=false,thinking=false,attachment=null}={}){
    conversation.querySelector('[data-ai-welcome]')?.remove();
    conversation.classList.remove('is-empty');
    const assistant=role!=='user';
    const message=document.createElement('article');
    message.className=`ai-message ai-message-${assistant?'assistant':'user'}`;
    message.innerHTML=`
      <div class="ai-message-avatar" ${assistant?'data-nyx-logo aria-hidden="true"':'aria-hidden="true"'}>${assistant?'':'You'}</div>
      <div class="ai-message-body">
        <div class="ai-message-meta"><strong>${assistant?'Nyx AI':'You'}</strong><div class="ai-message-actions">${messageCopyButton()}</div></div>
        <div class="ai-message-content"></div>
      </div>`;
    if(attachment?.dataUrl&&!assistant){
      const figure=document.createElement('figure');
      figure.className='ai-message-attachment';
      const image=document.createElement('img');
      image.src=attachment.dataUrl;
      image.alt=attachment.name||'Attached image';
      const caption=document.createElement('figcaption');
      caption.textContent=attachment.name||'Attached image';
      figure.append(image,caption);
      message.querySelector('.ai-message-content')?.before(figure);
    }else if(attachment?.content&&!assistant){
      const textAttachment=normalizedTextAttachment(attachment);
      if(textAttachment){
        const file=document.createElement('button');
        file.className='ai-message-attachment ai-message-text-attachment';
        file.type='button';
        file.dataset.downloadTextAttachment='';
        file.title=`Download ${textAttachment.name}`;
        file.innerHTML=`<span class="ai-text-file-icon" aria-hidden="true">TXT</span><span class="ai-text-file-copy"><strong>${escapeHtml(textAttachment.name)}</strong><small>${escapeHtml(formatAttachmentSize(textAttachment.size))} · Download</small></span>`;
        file._nyxTextAttachment=textAttachment;
        message.querySelector('.ai-message-content')?.before(file);
      }
    }
    setMessageContent(message,text,{error,thinking});
    conversation.appendChild(message);
    applyLogoTheme();
    scrollToBottom(true);
    return message;
  }

  function starterIcon(kind){
    const icons={
      project:'<path d="M4 7.5h16M7.5 4v7M16.5 4v7M5 12h14v8H5z"/>',
      explain:'<path d="M12 3a7 7 0 0 0-4 12.74V19h8v-3.26A7 7 0 0 0 12 3Z"/><path d="M9 22h6M9.5 15h5"/>',
      code:'<path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14"/>',
      ideas:'<path d="M12 3v3M4.22 6.22l2.12 2.12M3 14h3M18 14h3M17.66 8.34l2.12-2.12"/><path d="M8.5 18h7M9.5 21h5M12 8a5 5 0 0 0-3 9h6a5 5 0 0 0-3-9Z"/>'
    };
    return `<svg aria-hidden="true" viewBox="0 0 24 24">${icons[kind]||icons.ideas}</svg>`;
  }

  function starter(prompt,title,description,kind){
    return `<button class="ai-starter" type="button" data-prompt="${escapeHtml(prompt)}"><span class="ai-starter-icon">${starterIcon(kind)}</span><span class="ai-starter-copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span><svg class="ai-starter-arrow" aria-hidden="true" viewBox="0 0 20 20"><path d="m7 4 6 6-6 6"/></svg></button>`;
  }

  function welcome(){
    return `<section class="ai-welcome" data-ai-welcome>
      <div class="ai-welcome-mark" data-nyx-logo aria-hidden="true"></div>
      <p class="ai-welcome-kicker">NYX INTELLIGENCE</p>
      <h2>What can I help you create?</h2>
      <p class="ai-welcome-copy">Ask a question, explore an idea, or work through something complex. Choose a starting point or write your own prompt below.</p>
      <div class="ai-starters">
        ${starter('Help me plan and build a new project from scratch','Help me build a project','Turn an idea into clear next steps','project')}
        ${starter('Explain quantum computing in simple terms with a useful analogy','Explain a complex topic','Make difficult ideas easier to understand','explain')}
        ${starter('Review this code for bugs, clarity, and performance improvements','Review my code','Find issues and suggest improvements','code')}
        ${starter('Brainstorm ten original ideas for a creative side project','Brainstorm ideas','Generate thoughtful directions to explore','ideas')}
      </div>
    </section>`;
  }

  function threadDate(timestamp){
    const date=new Date(Number(timestamp)||Date.now());
    const today=new Date();
    if(date.toDateString()===today.toDateString()) return date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    const yesterday=new Date(today);
    yesterday.setDate(today.getDate()-1);
    if(date.toDateString()===yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([],{month:'short',day:'numeric'});
  }

  function threadIcon(){
    return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 5h14v11H9l-4 3V5Z"/></svg>';
  }

  function renderThreadList(){
    const items=[...threads].sort((left,right)=>right.updatedAt-left.updatedAt);
    const query=threadSearch.value.trim().toLowerCase();
    const visible=query?items.filter(thread=>`${thread.title}\n${thread.messages.map(item=>item.content).join('\n')}`.toLowerCase().includes(query)):items;
    threadCount.textContent=query?`${visible.length}/${items.length}`:String(items.length);
    historyEmpty.hidden=visible.length>0;
    historyEmpty.textContent=items.length?(query?'No matching chats.':'Your conversations will appear here.'):'Your conversations will appear here.';
    threadList.innerHTML=visible.map(thread=>`<div role="listitem"><button class="ai-thread-button" type="button" data-thread-id="${escapeHtml(thread.id)}" aria-current="${!temporaryMode&&thread.id===activeThreadId?'true':'false'}"><span class="ai-thread-icon">${threadIcon()}</span><span class="ai-thread-copy"><strong>${escapeHtml(thread.title)}</strong><small>${escapeHtml(threadDate(thread.updatedAt))}</small></span></button></div>`).join('');
    temporaryChat.setAttribute('aria-pressed',String(temporaryMode));
  }

  function stopRequest(){
    activeController?.abort();
    activeController=null;
    setBusy(false);
  }

  function setSidebarOpen(open){
    app.classList.toggle('is-sidebar-open',Boolean(open));
    sidebarToggle.setAttribute('aria-expanded',String(Boolean(open)));
  }

  function startNewChat({temporary=false}={}){
    stopRequest();
    clearAttachment();
    temporaryMode=temporary;
    temporaryMessages=[];
    activeThreadId='';
    if(!temporary){
      try{localStorage.removeItem(ACTIVE_THREAD_KEY)}catch{}
      syncLegacyMessages([]);
    }
    renderThreadList();
    render();
    input.value='';
    autoGrow();
    setSidebarOpen(false);
    input.focus();
  }

  function selectThread(id){
    const thread=threads.find(item=>item.id===id);
    if(!thread) return;
    stopRequest();
    clearAttachment();
    temporaryMode=false;
    temporaryMessages=[];
    activeThreadId=thread.id;
    localStorage.setItem(ACTIVE_THREAD_KEY,activeThreadId);
    syncLegacyMessages(thread.messages);
    if(modelCatalog.some(item=>item.id===thread.model)){
      model.value=thread.model;
      localStorage.setItem(MODEL_KEY,thread.model);
      syncModelControl();
    }
    renderThreadList();
    render();
    setSidebarOpen(false);
    input.focus();
  }

  const PROFILE_MINECRAFT_COLORS=Object.freeze({
    '0':'#000000','1':'#0000aa','2':'#00aa00','3':'#00aaaa',
    '4':'#aa0000','5':'#aa00aa','6':'#ffaa00','7':'#aaaaaa',
    '8':'#555555','9':'#5555ff',a:'#55ff55',b:'#55ffff',
    c:'#ff5555',d:'#ff55ff',e:'#ffff55',f:'#ffffff'
  });

  function visibleProfileName(value){
    return String(value||'').replace(/&[0-9a-fklmnor]/gi,'').trim();
  }

  function renderProfileName(element,value){
    const source=String(value||'');
    const pattern=/&([0-9a-fklmnor])/gi;
    const fragment=document.createDocumentFragment();
    let cursor=0;
    let match;
    let style={};
    const append=text=>{
      if(!text) return;
      const span=document.createElement('span');
      span.textContent=text;
      if(style.color) span.style.color=style.color;
      if(style.bold) span.style.fontWeight='900';
      if(style.italic) span.style.fontStyle='italic';
      const decorations=[];
      if(style.underline) decorations.push('underline');
      if(style.strike) decorations.push('line-through');
      if(decorations.length) span.style.textDecoration=decorations.join(' ');
      if(style.magic) span.classList.add('ai-minecraft-magic');
      fragment.append(span);
    };
    while((match=pattern.exec(source))){
      append(source.slice(cursor,match.index));
      cursor=pattern.lastIndex;
      const code=match[1].toLowerCase();
      if(PROFILE_MINECRAFT_COLORS[code]) style={color:PROFILE_MINECRAFT_COLORS[code]};
      else if(code==='l') style.bold=true;
      else if(code==='o') style.italic=true;
      else if(code==='n') style.underline=true;
      else if(code==='m') style.strike=true;
      else if(code==='k') style.magic=true;
      else if(code==='r') style={};
    }
    append(source.slice(cursor));
    element.replaceChildren(fragment);
    element.title=visibleProfileName(source)||'Profile';
  }

  function updateProfile(profile={}){
    const fallbackName=String(localStorage.getItem('nyx.userName')||'Profile').trim()||'Profile';
    const name=String(profile.displayName||fallbackName).trim()||'Profile';
    const handle=String(profile.handle||'Open your Nyx profile').trim();
    const avatar=String(profile.avatarUrl||'').trim();
    renderProfileName(profileName,name);
    profileHandle.textContent=handle;
    profileInitial.textContent=(Array.from(visibleProfileName(name))[0]||'N').toUpperCase();
    if(/^(?:https?:|blob:|data:image\/|\/)/i.test(avatar)){
      profileAvatar.src=avatar;
      profileAvatar.hidden=false;
      profileInitial.hidden=true;
    }else{
      profileAvatar.removeAttribute('src');
      profileAvatar.hidden=true;
      profileInitial.hidden=false;
    }
  }

  function requestProfile(){
    updateProfile();
    if(parent!==window) parent.postMessage({type:'nyx:ai-profile-request'},location.origin);
  }

  function updateThreadTitle(items){
    const first=items.find(item=>item.role==='user')?.content||'';
    threadTitle.textContent=temporaryMode&&!first?'Temporary chat':(first ? (first.length>58?`${first.slice(0,58)}…`:first) : 'New conversation');
  }

  function render(){
    const items=savedMessages();
    conversation.innerHTML='';
    if(!items.length){
      conversation.classList.add('is-empty');
      conversation.innerHTML=welcome();
    }else{
      conversation.classList.remove('is-empty');
      items.forEach(item=>addMessage(item.role,item.content,{attachment:item.textAttachment||null}));
    }
    updateThreadTitle(items);
    applyLogoTheme();
  }

  function modelLabel(id){
    return modelCatalog.find(item=>item.id===id)?.label||id;
  }

  function groupedModels(models){
    const groups=new Map();
    models.forEach(item=>{
      const company=item.company||'Other models';
      if(!groups.has(company)) groups.set(company,[]);
      groups.get(company).push(item);
    });
    return [...groups];
  }

  function modelOptions(models){
    return groupedModels(models).map(([company,items])=>`<optgroup label="${escapeHtml(company)}">${items.map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}${item.vision?' · Vision':''}</option>`).join('')}</optgroup>`).join('');
  }

  function modelMenuOptions(models,selected){
    return groupedModels(models).map(([company,items],groupIndex)=>{
      const groupId=`modelGroup${groupIndex}`;
      return `<section class="ai-model-group" role="group" aria-labelledby="${groupId}">
        <p class="ai-model-group-label" id="${groupId}">${escapeHtml(company)}</p>
        ${items.map(item=>`<button class="ai-model-option" type="button" role="option" data-model-id="${escapeHtml(item.id)}" aria-selected="${item.id===selected?'true':'false'}">
          <span class="ai-model-option-label">${escapeHtml(item.label)}${item.vision?' · Vision':''}</span>
          <span class="ai-model-option-check" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m5 10 3 3 7-7"/></svg></span>
        </button>`).join('')}
      </section>`;
    }).join('');
  }

  function syncModelControl(){
    const selected=model.value||DEFAULT_MODEL;
    const label=modelLabel(selected);
    modelSelected.textContent=label;
    modelTrigger.title=`Model: ${label}`;
    modelTrigger.setAttribute('aria-label',`AI model: ${label}`);
    sidebarModelName.textContent=label;
    modelOptionsHost.querySelectorAll('[data-model-id]').forEach(option=>{
      option.setAttribute('aria-selected',String(option.dataset.modelId===selected));
    });
  }

  function renderModelOptions(models,selected){
    model.innerHTML=modelOptions(models);
    model.value=selected;
    modelOptionsHost.innerHTML=modelMenuOptions(models,selected);
    const count=modelMenu.querySelector('[data-model-count]');
    if(count) count.textContent=`${models.length} available`;
    syncModelControl();
  }

  function modelOptionElements(){
    return [...modelOptionsHost.querySelectorAll('[data-model-id]')];
  }

  function closeModelMenu({restoreFocus=false}={}){
    if(modelMenu.hidden) return;
    modelMenu.hidden=true;
    modelPicker.classList.remove('is-open');
    modelTrigger.setAttribute('aria-expanded','false');
    if(restoreFocus) modelTrigger.focus();
  }

  function openModelMenu(direction=0){
    if(modelTrigger.disabled) return;
    modelMenu.hidden=false;
    modelPicker.classList.add('is-open');
    modelTrigger.setAttribute('aria-expanded','true');
    requestAnimationFrame(()=>{
      const options=modelOptionElements();
      const selectedIndex=Math.max(0,options.findIndex(option=>option.getAttribute('aria-selected')==='true'));
      const index=direction<0?options.length-1:(direction>0?0:selectedIndex);
      options[index]?.focus({preventScroll:true});
      options[index]?.scrollIntoView({block:'nearest'});
    });
  }

  function selectModel(id){
    if(!modelCatalog.some(item=>item.id===id)) return;
    model.value=id;
    model.dispatchEvent(new Event('change',{bubbles:true}));
    closeModelMenu({restoreFocus:true});
  }

  async function loadModels(){
    const status=document.querySelector('.ai-model-status');
    model.disabled=true;
    modelTrigger.disabled=true;
    modelTrigger.setAttribute('aria-busy','true');
    try{
      const response=await fetch('/api/nyx-ai/models',{headers:await aiHeaders({accept:'application/json'})});
      const data=await response.json();
      if(!response.ok) throw new Error(data?.error||`Model catalog failed (${response.status})`);
      const next=Array.isArray(data?.models)?data.models.flatMap(item=>{
        const id=String(item?.id||'').trim();
        const label=String(item?.label||id).trim();
        const company=String(item?.company||'').trim();
        return id&&label?[{id,label,company,vision:Boolean(item?.vision)||KNOWN_VISION_MODELS.has(id),reasoning:Boolean(item?.reasoning)}]:[];
      }):[];
      if(!next.length) throw new Error('No models are currently available.');
      const saved=activeThread()?.model||localStorage.getItem(MODEL_KEY)||DEFAULT_MODEL;
      const savedLabel=modelCatalog.find(item=>item.id===saved)?.label||saved;
      modelCatalog=next;
      const selected=next.some(item=>item.id===saved)?saved:(next.some(item=>item.id===DEFAULT_MODEL)?DEFAULT_MODEL:next[0].id);
      renderModelOptions(next,selected);
      if(selected===saved){
        localStorage.setItem(MODEL_KEY,selected);
        if(status){status.classList.remove('is-warning');status.title=`${next.length} models available`}
      }else if(status){
        status.classList.add('is-warning');
        status.title=`${savedLabel} is temporarily unavailable. Nyx will restore it when it returns.`;
      }
      if(personalApiKey()) updateApiKeyControl(`Your personal key is active with ${next.length} available model${next.length===1?'':'s'}.`,'success');
      return true;
    }catch(error){
      console.warn('Nyx AI model catalog could not be loaded:',error);
      modelCatalog=[];
      renderModelOptions([],"");
      modelSelected.textContent='Models unavailable';
      if(status){status.classList.add('is-warning');status.title='The model list could not be verified'}
      if(personalApiKey()) updateApiKeyControl(error?.message||'Nyx could not verify this API key.','error');
      return false;
    }finally{
      const available=modelCatalog.length>0;
      model.disabled=!available;
      modelTrigger.disabled=!available;
      modelTrigger.removeAttribute('aria-busy');
    }
  }

  function autoGrow(){
    input.style.height='auto';
    input.style.height=`${Math.min(input.scrollHeight,MAX_INPUT_HEIGHT)}px`;
    if(characterCount) characterCount.textContent=`${input.value.length} / ${input.maxLength}`;
  }

  function scrollToBottom(force=false){
    if(!force&&!followStream) return;
    requestAnimationFrame(()=>{feed.scrollTop=feed.scrollHeight});
  }

  function setBusy(busy){
    feed.setAttribute('aria-busy',String(busy));
    form.classList.toggle('is-busy',busy);
    input.disabled=busy;
    send.disabled=busy;
    imageInput.disabled=busy;
    attachImage.disabled=busy;
    shareScreen.disabled=busy;
    removeAttachment.disabled=busy;
    send.setAttribute('aria-label',busy?'Waiting for Nyx AI':'Send message');
  }

  function clearChat(){
    stopRequest();
    stopScreenSharing();
    clearAttachment();
    if(temporaryMode){
      temporaryMessages=[];
    }else if(activeThreadId){
      threads=threads.filter(thread=>thread.id!==activeThreadId);
      activeThreadId='';
      localStorage.removeItem(ACTIVE_THREAD_KEY);
      persistThreads();
    }
    syncLegacyMessages([]);
    renderThreadList();
    render();
    input.value='';
    autoGrow();
    input.focus();
  }

  async function copyText(value){
    if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(String(value||''));return}
    const helper=document.createElement('textarea');
    helper.value=String(value||'');
    helper.style.position='fixed';
    helper.style.opacity='0';
    document.body.appendChild(helper);
    helper.select();
    document.execCommand('copy');
    helper.remove();
  }

  function showCopied(button){
    const label=button.querySelector('span');
    const previous=label?.textContent||'';
    button.classList.add('is-copied');
    button.setAttribute('aria-label','Copied');
    if(label) label.textContent='Copied';
    setTimeout(()=>{
      button.classList.remove('is-copied');
      button.setAttribute('aria-label',button.hasAttribute('data-copy-code')?'Copy code':'Copy message');
      if(label) label.textContent=previous||'Copy';
    },1200);
  }

  async function submitPrompt(){
    const prompt=input.value.trim();
    let imageAttachment=attachedImage;
    const textAttachment=attachedText;
    const sharing=Boolean(screenStream);
    if((!prompt&&!imageAttachment&&!textAttachment&&!sharing)||send.disabled) return;
    if(sharing){
      try{
        screenStatus.textContent='Capturing the current frame…';
        imageAttachment=await captureSharedScreen();
      }catch(error){
        screenStatus.textContent=error?.message||'Nyx could not capture the shared screen.';
        return;
      }
    }
    const selectedModelId=model.value||DEFAULT_MODEL;
    const requestedModel=selectedModelId||DEFAULT_MODEL;
    const userText=prompt||(sharing?'Please analyze what is currently on my screen.':imageAttachment?'Please analyze this image.':'Please review the attached text file.');
    const history=savedMessages();
    if(!history.length) updateThreadTitle([{role:'user',content:userText}]);
    history.push({role:'user',content:userText,...(textAttachment?{textAttachment}: {})});
    saveMessages(history);
    addMessage('user',userText,{attachment:imageAttachment||textAttachment});
    input.value='';
    autoGrow();
    const pending=addMessage('assistant','',{thinking:true});
    activeController=new AbortController();
    setBusy(true);
    let answer='';
    let renderFrame=0;
    const renderAnswer=()=>{
      renderFrame=0;
      setMessageContent(pending,answer);
      scrollToBottom();
    };
    try{
      const preparedImage=imageAttachment?await prepareImageForModel(imageAttachment):null;
      const imageContext=preparedImage?`Original image dimensions: ${preparedImage.width}x${preparedImage.height}px.`:'';
      if(preparedImage){
        if(sharing) screenStatus.textContent=`Nyx is reading this screen frame for ${modelLabel(requestedModel)}…`;
        else setAttachmentStatus(`Nyx is reading this image for ${modelLabel(requestedModel)}…`);
      }
      const response=await fetch('/api/nyx-ai',{
        method:'POST',
        signal:activeController.signal,
        headers:await aiHeaders({'content-type':'application/json'}),
        body:JSON.stringify({model:requestedModel,message:userText,messages:history,textAttachment,imageContext,image:preparedImage,responseDepth:responseDepth(),stream:true})
      });
      if(!response.ok){
        const data=await response.json().catch(()=>({}));
        throw new Error(data?.error||`Nyx AI failed (${response.status})`);
      }
      if(!response.body) throw new Error('The selected model did not return a stream.');
      const reader=response.body.getReader();
      const decoder=new TextDecoder();
      let buffer='';
      const consumeLine=line=>{
        if(!line.startsWith('data:')) return;
        const raw=line.slice(5).trim();
        if(!raw||raw==='[DONE]') return;
        try{
          const data=JSON.parse(raw);
          const token=data?.choices?.[0]?.delta?.content||data?.choices?.[0]?.text||'';
          if(token){
            answer=data?.nyx_replace===true?String(token):answer+token;
            if(!renderFrame) renderFrame=requestAnimationFrame(renderAnswer);
          }
        }catch{}
      };
      for(;;){
        const part=await reader.read();
        if(part.done) break;
        buffer+=decoder.decode(part.value,{stream:true});
        const lines=buffer.split(/\r?\n/);
        buffer=lines.pop()||'';
        lines.forEach(consumeLine);
      }
      buffer+=decoder.decode();
      buffer.split(/\r?\n/).forEach(consumeLine);
      if(renderFrame){cancelAnimationFrame(renderFrame);renderAnswer()}
      const clean=answer.trim();
      const finalAnswer=responseParts(clean).answer.trim();
      if(!finalAnswer) throw new Error('This model did not produce a final answer. Try again or choose another available model.');
      setMessageContent(pending,clean);
      history.push({role:'assistant',content:finalAnswer});
      saveMessages(history);
      recordUsage(userText,finalAnswer);
    }catch(error){
      if(error?.name==='AbortError') return;
      setMessageContent(pending,error?.message||'Nyx AI could not complete that request.',{error:true});
    }finally{
      activeController=null;
      setBusy(false);
      clearAttachment();
      if(screenStream) screenStatus.textContent='A fresh frame is attached only when you send.';
      input.focus();
      scrollToBottom();
    }
  }

  applyWorkspaceTheme();
  addEventListener('message',event=>{
    if(event.origin!==location.origin) return;
    if(event.data?.type==='nyx:theme-sync') applyWorkspaceTheme(event.data.theme);
    if(event.data?.type==='nyx:ai-profile') updateProfile(event.data.profile||{});
    if(event.data?.type==='nyx:ai-open-key-settings') openApiKeyDialog();
  });
  addEventListener('focus',requestProfile);
  addEventListener('storage',event=>{
    if(['nyx.theme','nyx.customThemeColor'].includes(event.key)) applyWorkspaceTheme();
    if(event.key===THREADS_KEY){
      threads=storedThreads();
      if(activeThreadId&&!threads.some(thread=>thread.id===activeThreadId)) activeThreadId='';
      renderThreadList();
      render();
    }
    if(event.key==='nyx.userName') requestProfile();
  });
  feed.addEventListener('scroll',()=>{
    followStream=feed.scrollHeight-feed.scrollTop-feed.clientHeight<100;
  },{passive:true});
  feed.addEventListener('click',async event=>{
    const starter=event.target.closest('[data-prompt]');
    if(starter){
      input.value=starter.dataset.prompt||'';
      autoGrow();
      input.focus();
      form.requestSubmit();
      return;
    }
    const textDownload=event.target.closest('[data-download-text-attachment]');
    if(textDownload){
      downloadTextAttachment(textDownload._nyxTextAttachment);
      return;
    }
    const copyCode=event.target.closest('[data-copy-code]');
    if(copyCode){
      await copyText(copyCode.closest('.ai-code-block')?.querySelector('pre code')?.textContent||'');
      showCopied(copyCode);
      return;
    }
    const copyMessage=event.target.closest('[data-copy-message]');
    if(copyMessage){
      const message=copyMessage.closest('.ai-message');
      await copyText(message?._nyxMessageText||'');
      showCopied(copyMessage);
    }
  });
  form.addEventListener('submit',event=>{event.preventDefault();void submitPrompt()});
  attachImage.addEventListener('click',()=>imageInput.click());
  shareScreen.addEventListener('click',()=>{void startScreenSharing()});
  stopScreenShare.addEventListener('click',()=>{
    stopScreenSharing();
    input.focus();
  });
  imageInput.addEventListener('change',()=>{void readImageFile(imageInput.files?.[0])});
  removeAttachment.addEventListener('click',()=>{
    clearAttachment();
    input.focus();
  });
  input.addEventListener('paste',event=>{
    const image=[...(event.clipboardData?.files||[])].find(file=>String(file.type||'').startsWith('image/'));
    if(image){
      void readImageFile(image);
      return;
    }
    const pastedText=String(event.clipboardData?.getData('text/plain')||'');
    const selectedLength=Math.max(0,(input.selectionEnd||0)-(input.selectionStart||0));
    const nextLength=input.value.length-selectedLength+pastedText.length;
    if(pastedText&&nextLength>Number(input.maxLength||4000)){
      event.preventDefault();
      setTextAttachment(pastedText);
      autoGrow();
    }
  });
  form.addEventListener('dragenter',event=>{
    if([...(event.dataTransfer?.items||[])].some(item=>item.kind==='file')) form.classList.add('is-dragging');
  });
  form.addEventListener('dragover',event=>{
    if([...(event.dataTransfer?.items||[])].some(item=>item.kind==='file')) event.preventDefault();
  });
  form.addEventListener('dragleave',event=>{
    if(!form.contains(event.relatedTarget)) form.classList.remove('is-dragging');
  });
  form.addEventListener('drop',event=>{
    form.classList.remove('is-dragging');
    const file=[...(event.dataTransfer?.files||[])][0];
    if(!file) return;
    event.preventDefault();
    void readImageFile(file);
  });
  input.addEventListener('input',autoGrow);
  input.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.shiftKey&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.isComposing){
      event.preventDefault();
      form.requestSubmit();
    }
  });
  modelTrigger.addEventListener('click',()=>{
    if(modelMenu.hidden) openModelMenu();
    else closeModelMenu();
  });
  modelTrigger.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();
      openModelMenu(event.key==='ArrowDown'?1:-1);
    }else if(event.key==='Escape'){
      event.preventDefault();
      closeModelMenu();
    }
  });
  modelMenu.addEventListener('click',event=>{
    const option=event.target.closest('[data-model-id]');
    if(option) selectModel(option.dataset.modelId||'');
  });
  modelMenu.addEventListener('keydown',event=>{
    const option=event.target.closest('[data-model-id]');
    const options=modelOptionElements();
    const index=Math.max(0,options.indexOf(option));
    let target=-1;
    if(event.key==='ArrowDown') target=Math.min(options.length-1,index+1);
    else if(event.key==='ArrowUp') target=Math.max(0,index-1);
    else if(event.key==='Home') target=0;
    else if(event.key==='End') target=options.length-1;
    else if(event.key==='Enter'||event.key===' '){
      event.preventDefault();
      if(option) selectModel(option.dataset.modelId||'');
      return;
    }else if(event.key==='Escape'){
      event.preventDefault();
      closeModelMenu({restoreFocus:true});
      return;
    }else if(event.key==='Tab'){
      closeModelMenu();
      return;
    }
    if(target>=0){
      event.preventDefault();
      options[target]?.focus();
      options[target]?.scrollIntoView({block:'nearest'});
    }
  });
  document.addEventListener('pointerdown',event=>{
    if(!modelMenu.hidden&&!modelPicker.contains(event.target)) closeModelMenu();
  });
  model.addEventListener('change',()=>{
    localStorage.setItem(MODEL_KEY,model.value||DEFAULT_MODEL);
    model.title=modelLabel(model.value);
    const thread=activeThread();
    if(thread){
      thread.model=model.value||DEFAULT_MODEL;
      thread.updatedAt=Date.now();
      persistThreads();
      renderThreadList();
    }
    syncModelControl();
  });
  apiKeySettings.addEventListener('click',openApiKeyDialog);
  apiKeyClose.addEventListener('click',closeApiKeyDialog);
  apiKeyCancel.addEventListener('click',closeApiKeyDialog);
  apiKeyDialog.addEventListener('click',event=>{
    if(event.target===apiKeyDialog) closeApiKeyDialog();
  });
  apiKeyReveal.addEventListener('click',()=>{
    const reveal=apiKeyInput.type==='password';
    apiKeyInput.type=reveal?'text':'password';
    apiKeyReveal.setAttribute('aria-pressed',String(reveal));
    apiKeyReveal.setAttribute('aria-label',reveal?'Hide API key':'Show API key');
    apiKeyInput.focus();
  });
  apiKeyRemove.addEventListener('click',async()=>{
    const activeId=String(localStorage.getItem(PERSONAL_ACTIVE_PROFILE)||'');
    if(activeId) await deletePersonalProfile(activeId);
    else{
      removePersonalApiKey();
      fillPersonalProfileForm();
      updateApiKeyControl(`Personal key removed. Nyx is using ${providerSelect.options[providerSelect.selectedIndex]?.text||'its shared AI key'}.`,'success');
      await loadModels();
    }
  });
  apiKeyForm.addEventListener('submit',async event=>{
    event.preventDefault();
    const key=apiKeyInput.value.trim();
    const baseUrl=apiBaseUrl.value.trim().replace(/\/+$/,'');
    if(key.length<8||key.length>512||/[\s\x00-\x1f\x7f]/.test(key)){
      updateApiKeyControl('Enter a valid API key without spaces.','error');
      apiKeyInput.focus();
      return;
    }
    if(baseUrl){
      try{
        const parsed=new URL(baseUrl);
        if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash) throw new Error();
      }catch{
        updateApiKeyControl('Enter an HTTPS provider base URL, such as https://api.ofox.ai/v1.','error');
        apiBaseUrl.focus();
        return;
      }
    }
    const profiles=personalProfiles();
    if(!editingProfileId&&profiles.length>=8){
      updateApiKeyControl('Remove a saved provider before adding another.','error');
      return;
    }
    const id=editingProfileId||`provider_${crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)}`;
    const profile={id,key,baseUrl,label:apiProfileLabel.value.trim(),remember:apiKeyRemember.checked};
    writePersonalProfiles([...profiles.filter(item=>item.id!==id),profile]);
    localStorage.setItem(PERSONAL_ACTIVE_PROFILE,id);
    editingProfileId=id;
    storePersonalApiKey(key,baseUrl,profile.remember);
    renderPersonalProfiles();
    apiKeySave.disabled=true;
    updateApiKeyControl(`Checking your ${personalKeyProvider(key,baseUrl)} key…`);
    const valid=await loadModels();
    apiKeySave.disabled=false;
    if(valid) setTimeout(closeApiKeyDialog,450);
  });
  apiBaseOfox.addEventListener('click',()=>{
    apiBaseUrl.value='https://api.ofox.ai/v1';
    if(!apiProfileLabel.value.trim()) apiProfileLabel.value='Ofox';
    apiBaseUrl.focus();
  });
  apiProfileNew.addEventListener('click',()=>{
    fillPersonalProfileForm();
    updateApiKeyControl('Paste the new provider key and its OpenAI-compatible base URL.');
    apiProfileLabel.focus();
  });
  apiKeyProfiles.addEventListener('click',event=>{
    const removeButton=event.target.closest('[data-key-profile-remove]');
    if(removeButton){
      void deletePersonalProfile(removeButton.dataset.keyProfileRemove||'');
      return;
    }
    const selectButton=event.target.closest('[data-key-profile-select]');
    if(selectButton){
      const profile=personalProfiles().find(item=>item.id===selectButton.dataset.keyProfileSelect);
      if(profile) void activatePersonalProfile(profile);
    }
  });
  providerSelect.addEventListener('change',async()=>{
    if(personalApiKey()) return;
    localStorage.setItem(PROVIDER_KEY,providerSelect.value||'shared');
    await loadModels();
  });
  clear.addEventListener('click',clearChat);
  newChat.addEventListener('click',()=>startNewChat());
  temporaryChat.addEventListener('click',()=>startNewChat({temporary:true}));
  threadList.addEventListener('click',event=>{
    const button=event.target.closest('[data-thread-id]');
    if(button) selectThread(button.dataset.threadId||'');
  });
  threadSearch.addEventListener('input',renderThreadList);
  depthButtons.forEach(button=>button.addEventListener('click',()=>{
    localStorage.setItem(RESPONSE_DEPTH_KEY,button.dataset.responseDepth||'normal');
    syncResponseDepth();
  }));
  sidebarToggle.addEventListener('click',()=>setSidebarOpen(!app.classList.contains('is-sidebar-open')));
  sidebarClose.addEventListener('click',()=>setSidebarOpen(false));
  sidebarScrim.addEventListener('click',()=>setSidebarOpen(false));
  profileButton.addEventListener('click',()=>{
    requestProfile();
    if(parent!==window) parent.postMessage({type:'nyx:ai-open-profile'},location.origin);
    else location.href='/';
  });
  profileAvatar.addEventListener('error',()=>{
    profileAvatar.hidden=true;
    profileInitial.hidden=false;
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&app.classList.contains('is-sidebar-open')){
      event.preventDefault();
      setSidebarOpen(false);
      sidebarToggle.focus();
    }
  });
  addEventListener('pagehide',stopScreenSharing);

  initializeThreads();
  renderModelOptions(modelCatalog,model.value||DEFAULT_MODEL);
  renderThreadList();
  render();
  autoGrow();
  syncResponseDepth();
  renderUsage();
  requestProfile();
  updateApiKeyControl();
  void (async()=>{await loadProviders();await loadModels()})();
  input.focus();
})();
