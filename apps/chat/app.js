(()=>{
  'use strict';

  const API='/api/chat';
  const POLL_MS=3000;
  const BOOTSTRAP_REFRESH_MS=60000;
  const ROLE_LABELS={owner:'Owner',co_owner:'Co-owner',admin:'Admin',manager:'Manager',developer:'Developer',moderator:'Moderator',support:'Support',tester:'Tester',contributor:'Contributor',member:'Member'};
  const refs={
    app:document.querySelector('[data-chat-app]'),channelList:document.querySelector('[data-channel-list]'),channelTitle:document.querySelector('[data-channel-title]'),channelDescription:document.querySelector('[data-channel-description]'),welcomeTitle:document.querySelector('[data-welcome-title]'),welcomeDescription:document.querySelector('[data-welcome-description]'),connection:document.querySelector('[data-connection-state]'),loading:document.querySelector('[data-loading-chat]'),gate:document.querySelector('[data-signin-gate]'),scroller:document.querySelector('[data-message-scroller]'),messageList:document.querySelector('[data-message-list]'),loadOlder:document.querySelector('[data-load-older]'),form:document.querySelector('[data-message-form]'),input:document.querySelector('[data-message-input]'),count:document.querySelector('[data-message-count]'),send:document.querySelector('[data-send-button]'),notice:document.querySelector('[data-chat-notice]'),currentUser:document.querySelector('[data-current-user]'),onlineCount:document.querySelector('[data-online-count]'),onlineLabel:document.querySelector('[data-online-label]'),offlineLabel:document.querySelector('[data-offline-label]'),onlineMembers:document.querySelector('[data-online-members]'),offlineMembers:document.querySelector('[data-offline-members]'),shade:document.querySelector('[data-drawer-shade]'),memberDialog:document.querySelector('[data-member-dialog]'),memberDialogContent:document.querySelector('[data-member-dialog-content]')
  };
  const state={token:'',parentAuth:null,directAuthPromise:null,me:null,members:[],channels:[],latestActivity:{},active:'general',messages:new Map(),hasMore:new Map(),loaded:new Set(),pollTimer:0,bootstrapTimer:0,noticeTimer:0,busy:false,lastRead:readLastRead()};

  function readLastRead(){try{const value=JSON.parse(localStorage.getItem('nyx.chat.lastRead')||'{}');return value&&typeof value==='object'?value:{}}catch{return {}}}
  function saveLastRead(){try{localStorage.setItem('nyx.chat.lastRead',JSON.stringify(state.lastRead))}catch{}}
  function setConnection(label,type=''){
    refs.connection.classList.toggle('connected',type==='connected');refs.connection.classList.toggle('error',type==='error');refs.connection.querySelector('span').textContent=label;
  }
  function showNotice(message,type='error'){
    clearTimeout(state.noticeTimer);refs.notice.textContent=String(message||'Something went wrong.');refs.notice.classList.toggle('success',type==='success');refs.notice.hidden=false;state.noticeTimer=setTimeout(()=>{refs.notice.hidden=true},5000);
  }
  function closeDrawers(){refs.app.classList.remove('channels-open','members-open');refs.shade.hidden=true}
  function openDrawer(name){closeDrawers();refs.app.classList.add(`${name}-open`);refs.shade.hidden=false}
  function initials(value){return String(value||'N').trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase()||'N'}
  function avatarElement(person,online=false){
    const avatar=document.createElement('span');avatar.className=`avatar${online?' online':''}`;avatar.textContent=initials(person?.displayName);
    const source=String(person?.avatarUrl||'').trim();
    if(source){const image=document.createElement('img');image.alt='';image.referrerPolicy='no-referrer';image.src=source;image.addEventListener('error',()=>image.remove(),{once:true});avatar.append(image)}
    return avatar;
  }
  function formatTime(value,compact=false){
    const date=new Date(value||0);if(!Number.isFinite(date.getTime()))return '';
    if(compact)return date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    const today=new Date();const sameDay=date.toDateString()===today.toDateString();
    return sameDay?date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):date.toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  }
  function roleLabel(role){return ROLE_LABELS[String(role||'member')]||'Member'}
  function isModerator(){return state.me?.canModerate===true}

  async function parentToken(){
    if(window.parent===window)return null;
    const requestId=`chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise(resolve=>{
      let settled=false;
      const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);window.removeEventListener('message',receive);resolve(value)};
      const receive=event=>{if(event.source!==window.parent||event.origin!==location.origin||event.data?.type!=='nyx:account-token-response'||event.data?.requestId!==requestId)return;finish({available:true,token:String(event.data.token||'')})};
      const timer=setTimeout(()=>finish(null),2500);window.addEventListener('message',receive);window.parent.postMessage({type:'nyx:account-token-request',requestId},location.origin);
    });
  }
  async function directAuth(){
    if(state.directAuthPromise)return state.directAuthPromise;
    state.directAuthPromise=(async()=>{
      const config=await fetchJson('/api/founder-profile/auth-config',{cache:'no-store'},false);
      if(!config?.enabled)return null;
      const [{initializeApp,getApps},{getAuth,setPersistence,browserLocalPersistence}]=await Promise.all([
        import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js')
      ]);
      const app=getApps().find(item=>item.name==='nyx-founder-owner')||initializeApp({apiKey:config.apiKey,authDomain:`${config.projectId}.firebaseapp.com`,projectId:config.projectId},'nyx-founder-owner');
      const auth=getAuth(app);try{await setPersistence(auth,browserLocalPersistence)}catch{}
      if(typeof auth.authStateReady==='function')await auth.authStateReady();return auth;
    })();
    try{return await state.directAuthPromise}catch(error){state.directAuthPromise=null;throw error}
  }
  async function accountToken(force=false){
    const parent=await parentToken();
    if(parent?.available){state.parentAuth=true;state.token=parent.token;return state.token}
    state.parentAuth=false;const auth=await directAuth();state.token=auth?.currentUser?await auth.currentUser.getIdToken(force):'';return state.token;
  }
  async function fetchJson(path,options={},authorized=true,retry=true){
    const headers=new Headers(options.headers||{});
    if(authorized){const token=await accountToken(!retry);if(!token){const error=new Error('Sign in to use Nyx Chat.');error.status=401;throw error}headers.set('Authorization',`Bearer ${token}`)}
    const response=await fetch(path,{...options,headers});
    const type=response.headers.get('content-type')||'';let payload=null;
    if(type.includes('application/json'))payload=await response.json();else{const body=(await response.text()).trim();payload={error:body&&body.length<300?body:`Nyx received an unexpected response (${response.status}).`}}
    if(!response.ok){if(response.status===401&&authorized&&retry)return fetchJson(path,options,true,false);const error=new Error(payload?.error||`Request failed (${response.status}).`);error.status=response.status;error.retryAfter=Number(response.headers.get('retry-after')||0);throw error}
    return payload;
  }

  function renderChannels(){
    refs.channelList.replaceChildren();
    state.channels.forEach(channel=>{
      const button=document.createElement('button');button.type='button';button.className=`channel-button${channel.id===state.active?' active':''}`;button.dataset.channel=channel.id;
      const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','#icon-hash');icon.append(use);
      const label=document.createElement('span');label.textContent=channel.name;const dot=document.createElement('i');dot.setAttribute('aria-hidden','true');button.append(icon,label,dot);
      const latest=Number(state.latestActivity[channel.id]||0);const read=Number(state.lastRead[channel.id]||0);button.classList.toggle('unread',channel.id!==state.active&&latest>read);
      button.addEventListener('click',()=>void switchChannel(channel.id));refs.channelList.append(button);
    });
  }
  function renderCurrentUser(){
    refs.currentUser.replaceChildren();if(!state.me){refs.currentUser.hidden=true;return}
    refs.currentUser.append(avatarElement(state.me,true));const copy=document.createElement('span');const name=document.createElement('strong');name.textContent=state.me.displayName;const handle=document.createElement('small');handle.textContent=`${state.me.handle} · ${state.me.roleLabel||roleLabel(state.me.role)}`;copy.append(name,handle);refs.currentUser.append(copy);refs.currentUser.hidden=false;
  }
  function renderMembers(){
    const online=state.members.filter(member=>member.online);const offline=state.members.filter(member=>!member.online);
    refs.onlineCount.querySelector('b').textContent=String(online.length);refs.onlineLabel.textContent=String(online.length);refs.offlineLabel.textContent=String(offline.length);
    const render=(root,values)=>{root.replaceChildren();values.forEach(member=>{const button=document.createElement('button');button.type='button';button.className=`member-button${member.online?'':' offline'}`;button.append(avatarElement(member,member.online));const copy=document.createElement('span');const name=document.createElement('strong');name.textContent=member.displayName;const detail=document.createElement('small');detail.textContent=member.self?'You':member.roleLabel||roleLabel(member.role);copy.append(name,detail);button.append(copy);button.addEventListener('click',()=>openMember(member));root.append(button)})};
    render(refs.onlineMembers,online);render(refs.offlineMembers,offline);
  }
  function openMember(member){
    refs.memberDialogContent.replaceChildren();const banner=document.createElement('div');banner.className='member-card-banner';const body=document.createElement('div');body.className='member-card-body';body.append(avatarElement(member,member.online));const name=document.createElement('h2');name.textContent=member.displayName;const handle=document.createElement('p');handle.textContent=member.handle;const facts=document.createElement('div');facts.className='member-card-facts';const role=document.createElement('span');role.textContent=member.roleLabel||roleLabel(member.role);const status=document.createElement('span');status.className=member.online?'online':'offline';status.textContent=member.online?'Online':'Offline';facts.append(role,status);body.append(name,handle,facts);refs.memberDialogContent.append(banner,body);refs.memberDialog.showModal();closeDrawers();
  }

  function mergeMessages(channel,incoming,{prepend=false}={}){
    const current=state.messages.get(channel)||[];const byId=new Map(current.map(message=>[message.id,message]));incoming.forEach(message=>byId.set(message.id,message));const merged=[...byId.values()].sort((a,b)=>Number(a.createdAtMs||0)-Number(b.createdAtMs||0));state.messages.set(channel,merged);return merged;
  }
  function renderMessages(){
    const messages=state.messages.get(state.active)||[];refs.messageList.replaceChildren();let previous=null;
    messages.forEach(message=>{
      const grouped=previous&&previous.author?.uid===message.author?.uid&&Number(message.createdAtMs)-Number(previous.createdAtMs)<5*60*1000;
      const article=document.createElement('article');article.className=`message role-${String(message.author?.role||'member')}${grouped?' grouped':''}`;article.dataset.messageId=message.id;
      article.append(avatarElement(message.author));
      const content=document.createElement('div');content.className='message-content';const meta=document.createElement('div');meta.className='message-meta';const author=document.createElement('span');author.className='message-author';author.textContent=message.author?.displayName||'Nyx member';meta.append(author);
      if(message.author?.role&&message.author.role!=='member'){const badge=document.createElement('span');badge.className='message-role';badge.textContent=roleLabel(message.author.role);meta.append(badge)}
      const time=document.createElement('time');time.className='message-time';time.dateTime=message.createdAt||'';time.textContent=formatTime(message.createdAtMs);meta.append(time);
      const text=document.createElement('p');text.className='message-text';text.textContent=message.text;content.append(meta,text);article.append(content);
      if(grouped){const compact=document.createElement('time');compact.className='message-time-compact';compact.textContent=formatTime(message.createdAtMs,true);article.append(compact)}
      if(message.author?.uid===state.me?.uid||isModerator()){const remove=document.createElement('button');remove.type='button';remove.className='message-delete';remove.title='Delete message';remove.setAttribute('aria-label','Delete message');const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','#icon-trash');svg.append(use);remove.append(svg);remove.addEventListener('click',()=>void deleteMessage(message));article.append(remove)}
      refs.messageList.append(article);previous=message;
    });
    refs.loadOlder.hidden=!state.hasMore.get(state.active);
  }
  function markRead(){
    const messages=state.messages.get(state.active)||[];const latest=Math.max(Number(state.latestActivity[state.active]||0),...messages.map(message=>Number(message.createdAtMs||0)),Date.now());state.lastRead[state.active]=latest;saveLastRead();renderChannels();
  }
  async function loadMessages({initial=false,older=false,poll=false}={}){
    if(!state.me)return;const channel=state.active;const current=state.messages.get(channel)||[];let query=`?channel=${encodeURIComponent(channel)}`;
    if(older&&current.length)query+=`&before=${Math.max(1,Number(current[0].createdAtMs||0))}`;else if(poll){const newest=current.length?Number(current[current.length-1].createdAtMs||0):1;query+=`&after=${Math.max(1,newest-1)}`}
    const wasNearBottom=refs.scroller.scrollHeight-refs.scroller.scrollTop-refs.scroller.clientHeight<100;const beforeHeight=refs.scroller.scrollHeight;
    const payload=await fetchJson(`${API}/messages${query}`,{cache:'no-store'});if(channel!==state.active)return;
    mergeMessages(channel,payload.messages||[],{prepend:older});if(!poll)state.hasMore.set(channel,payload.hasMore===true);state.loaded.add(channel);renderMessages();
    if(older)refs.scroller.scrollTop=Math.max(0,refs.scroller.scrollHeight-beforeHeight);else if(initial||wasNearBottom)requestAnimationFrame(()=>{refs.scroller.scrollTop=refs.scroller.scrollHeight});
    const newest=(state.messages.get(channel)||[]).at(-1);if(newest)state.latestActivity[channel]=Math.max(Number(state.latestActivity[channel]||0),Number(newest.createdAtMs||0));if(!document.hidden)markRead();setConnection('Live','connected');
  }
  async function switchChannel(channel){
    if(!state.channels.some(item=>item.id===channel)||channel===state.active){closeDrawers();return}
    state.active=channel;const selected=state.channels.find(item=>item.id===channel);refs.channelTitle.textContent=selected.name;refs.channelDescription.textContent=selected.description;refs.welcomeTitle.textContent=`Welcome to #${selected.name.toLowerCase().replace(/\s+/g,'-')}`;refs.welcomeDescription.textContent=`This is the start of the ${selected.name} channel.`;refs.input.placeholder=`Message #${selected.name.toLowerCase().replace(/\s+/g,'-')}`;renderChannels();renderMessages();closeDrawers();
    if(!state.loaded.has(channel)){setConnection('Loading');try{await loadMessages({initial:true})}catch(error){setConnection('Offline','error');showNotice(error.message)}}else{markRead();requestAnimationFrame(()=>{refs.scroller.scrollTop=refs.scroller.scrollHeight})}
  }

  async function sendMessage(event){
    event.preventDefault();if(state.busy)return;const text=refs.input.value.trim();if(!text)return;state.busy=true;refs.send.disabled=true;
    try{
      const requestId=(crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g,'');const payload=await fetchJson(`${API}/messages`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel:state.active,text,requestId})});refs.input.value='';updateComposer();mergeMessages(state.active,[payload.message]);state.latestActivity[state.active]=Number(payload.message?.createdAtMs||Date.now());renderMessages();markRead();requestAnimationFrame(()=>{refs.scroller.scrollTop=refs.scroller.scrollHeight});
    }catch(error){showNotice(error.message)}finally{state.busy=false;refs.send.disabled=false;refs.input.focus()}
  }
  async function deleteMessage(message){
    if(!confirm('Delete this message?'))return;
    try{await fetchJson(`${API}/messages/${encodeURIComponent(state.active)}/${encodeURIComponent(message.id)}`,{method:'DELETE'});state.messages.set(state.active,(state.messages.get(state.active)||[]).filter(item=>item.id!==message.id));renderMessages();showNotice('Message deleted.','success')}catch(error){showNotice(error.message)}
  }
  function updateComposer(){
    const length=refs.input.value.length;refs.count.textContent=`${length} / 1000`;refs.input.style.height='auto';refs.input.style.height=`${Math.min(130,refs.input.scrollHeight)}px`;refs.send.disabled=state.busy||!refs.input.value.trim();
  }

  async function refreshBootstrap({initial=false}={}){
    const payload=await fetchJson(`${API}/bootstrap`,{cache:'no-store'});state.me=payload.me||null;state.members=Array.isArray(payload.members)?payload.members:[];state.channels=Array.isArray(payload.channels)?payload.channels:[];state.latestActivity=payload.latestActivity||{};
    if(!state.channels.some(channel=>channel.id===state.active))state.active=state.channels[0]?.id||'general';const selected=state.channels.find(channel=>channel.id===state.active);if(selected){refs.channelTitle.textContent=selected.name;refs.channelDescription.textContent=selected.description;refs.welcomeTitle.textContent=`Welcome to #${selected.name.toLowerCase().replace(/\s+/g,'-')}`;refs.welcomeDescription.textContent=`This is the start of the ${selected.name} channel.`;refs.input.placeholder=`Message #${selected.name.toLowerCase().replace(/\s+/g,'-')}`}
    renderChannels();renderMembers();renderCurrentUser();if(initial)await loadMessages({initial:true});
  }
  function showSignin(){
    clearInterval(state.pollTimer);clearInterval(state.bootstrapTimer);refs.loading.hidden=true;refs.scroller.hidden=true;refs.form.hidden=true;refs.gate.hidden=false;refs.currentUser.hidden=true;setConnection('Sign in','error');
  }
  async function boot(){
    refs.loading.hidden=false;refs.gate.hidden=true;refs.scroller.hidden=true;refs.form.hidden=true;setConnection('Connecting');
    try{
      await accountToken();if(!state.token){showSignin();return}await refreshBootstrap({initial:true});refs.loading.hidden=true;refs.scroller.hidden=false;refs.form.hidden=false;refs.gate.hidden=true;updateComposer();setConnection('Live','connected');
      clearInterval(state.pollTimer);state.pollTimer=setInterval(()=>{if(!document.hidden&&!state.busy)void loadMessages({poll:true}).catch(error=>{setConnection('Retrying','error');if(error.status===401)showSignin()})},POLL_MS);
      clearInterval(state.bootstrapTimer);state.bootstrapTimer=setInterval(()=>{if(!document.hidden)void refreshBootstrap().catch(()=>{})},BOOTSTRAP_REFRESH_MS);
    }catch(error){if(error.status===401)showSignin();else{refs.loading.hidden=true;refs.gate.hidden=false;refs.gate.querySelector('h2').textContent='Nyx Chat could not open';refs.gate.querySelector('p').textContent=error.message||'Try again shortly.';setConnection('Unavailable','error')}}
  }

  document.querySelectorAll('[data-back-to-nyx]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();if(window.parent!==window)window.parent.postMessage({type:'nyx:close-tab'},location.origin);else location.href='/'}));
  document.querySelector('[data-channels-toggle]')?.addEventListener('click',()=>openDrawer('channels'));document.querySelector('[data-members-toggle]')?.addEventListener('click',()=>openDrawer('members'));document.querySelector('[data-sidebar-close]')?.addEventListener('click',closeDrawers);document.querySelector('[data-members-close]')?.addEventListener('click',closeDrawers);refs.shade.addEventListener('click',closeDrawers);
  document.querySelector('[data-retry-auth]')?.addEventListener('click',()=>void boot());refs.loadOlder.addEventListener('click',()=>void loadMessages({older:true}).catch(error=>showNotice(error.message)));refs.form.addEventListener('submit',sendMessage);refs.input.addEventListener('input',updateComposer);refs.input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();refs.form.requestSubmit()}});
  refs.memberDialog.querySelector('[data-member-dialog-close]')?.addEventListener('click',()=>refs.memberDialog.close());refs.memberDialog.addEventListener('click',event=>{if(event.target===refs.memberDialog)refs.memberDialog.close()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.me){void loadMessages({poll:true}).catch(()=>{});void refreshBootstrap().catch(()=>{})}});window.addEventListener('beforeunload',()=>{clearInterval(state.pollTimer);clearInterval(state.bootstrapTimer)});
  void boot();
})();
